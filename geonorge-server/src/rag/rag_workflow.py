"""
RAG workflow for GeoNorge, wrapping the existing workflow components.
"""
from typing import Dict, Callable, Any, List, Literal, Annotated, Sequence
from typing_extensions import TypedDict
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, END, StateGraph
from langgraph.prebuilt import ToolNode
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from langgraph.graph.message import add_messages
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from helpers.websocket import send_websocket_action
from .models.state import ConversationState
from retrieval import GeoNorgeVectorRetriever

from .utils.common import register_websockets_dict
from .models import ConversationState
from .utils.image_processor import insert_image_rag_response

def tools_condition(state: Dict) -> str:
    """
    Determines if the agent wants to use a tool or if it has a final response.
    
    Args:
        state: The current state object with messages
        
    Returns:
        String indicating if the agent wants to use a tool ("tools") or is finished (END)
    """
    from langchain_core.messages import AIMessage
    import json
    
    # Debug current state
    print(f"DEBUG tools_condition: Checking for tool calls in state")
    messages = state.get("messages", [])
    if not messages:
        print("DEBUG tools_condition: No messages in state")
        return END
        
    # Get the last message
    last_message = messages[-1]
    print(f"DEBUG tools_condition: Last message type: {type(last_message)}")
    
    # Debug the message structure
    if hasattr(last_message, "__dict__"):
        print(f"DEBUG tools_condition: Message attributes: {last_message.__dict__.keys()}")
    
    # Check if it has tool calls - try multiple approaches
    has_tool_calls = False
    
    # Try direct tool_calls attribute
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        print(f"DEBUG tools_condition: Found tool_calls directly: {last_message.tool_calls}")
        has_tool_calls = True
    
    # Try additional_kwargs for OpenAI format
    elif hasattr(last_message, "additional_kwargs") and last_message.additional_kwargs.get("tool_calls"):
        print(f"DEBUG tools_condition: Found tool_calls in additional_kwargs: {last_message.additional_kwargs.get('tool_calls')}")
        has_tool_calls = True
    
    # For AIMessage with content containing JSON that might be a function call
    elif isinstance(last_message, AIMessage) and hasattr(last_message, "content"):
        content = last_message.content
        try:
            # See if content is parseable as JSON and contains a function_call
            if isinstance(content, str) and ('tool_call' in content.lower() or 'function_call' in content.lower()):
                print(f"DEBUG tools_condition: Content might contain a tool call: {content[:100]}...")
                has_tool_calls = True
        except:
            pass
    
    if has_tool_calls:
        print("DEBUG tools_condition: Returning 'tools'")
        return "tools"
    
    # No tool calls, so we're done
    print("DEBUG tools_condition: No tool calls found, returning END")
    return END

class AgentState(TypedDict):
    """State for the agent-based RAG workflow."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    websocket_id: str
    intent: str
    retrieval_results: List[Dict]
    documents_relevant: bool
    dataset_info: Dict

# Create wrapper function that handles state conversion
def with_state_handling(node_func: Callable) -> Callable:
    """Wrap a node function with state handling logic."""
    async def wrapped(state: Any) -> Dict:
        print(f"DEBUG RAG {node_func.__name__}: state type = {type(state)}")
        
        # Handle different state input types
        if isinstance(state, ConversationState):
            return await node_func(state.to_dict())
        elif isinstance(state, dict):
            return await node_func(state)
        else:
            try:
                if hasattr(state, "to_dict"):
                    state_dict = state.to_dict()
                else:
                    return await node_func(state_dict)
            except Exception as e:
                print(f"DEBUG: Error converting state in {node_func.__name__}: {e}")
                # Fallback state
                fallback_state = {
                    "messages": [{"role": "human", "content": "Hjelp meg med geografiske data"}],
                    "websocket_id": getattr(state, "websocket_id", ""),
                    "chat_history": ""
                }
                return await node_func(fallback_state)
    
    wrapped.__name__ = node_func.__name__
    wrapped.__doc__ = node_func.__doc__
    
    return wrapped


class GeoNorgeRAGWorkflow:
    """
    RAG workflow for GeoNorge chatbot, implemented using LangGraph.
    
    This class wraps the existing conversation workflow, routing requests to the
    appropriate nodes based on intent and query validation.
    """
    
    def __init__(self):
        print("Initializing GeoNorgeRAGWorkflow...")
        self.memory = MemorySaver()
        self.retriever = GeoNorgeVectorRetriever()
        self.active_websockets = {}
        
        # Patch the event loop to allow nested calls
        try:
            import nest_asyncio
            nest_asyncio.apply()
            print("Applied nest_asyncio patch to event loop")
        except ImportError:
            print("WARNING: nest_asyncio not found. Install with: pip install nest_asyncio")
            print("This may cause issues with running async functions in sync contexts")
        except Exception as e:
            print(f"WARNING: Failed to apply nest_asyncio patch: {e}")
            print("This may cause issues with running async functions in sync contexts")
        
        # Register the websockets dictionary with the nodes module
        register_websockets_dict(self.active_websockets)
        
        # Initialize tools first
        print("Initializing retrieval tools...")
        
        try:
            self.retrieval_tool = self._create_retrieval_tool()
            print(f"Created retrieval tool: {self.retrieval_tool.name}")
        except Exception as e:
            print(f"ERROR creating retrieval tool: {e}")
            from langchain.tools import StructuredTool
            # Create a fallback tool
            self.retrieval_tool = StructuredTool.from_function(
                func=lambda query: "Beklager, jeg kunne ikke søke etter informasjon på grunn av en teknisk feil.",
                name="retrieve_geo_information",
                description="Search and retrieve geographical information from GeoNorge database based on a query."
            )
        
        try:
            self.dataset_info_tool = self._create_dataset_info_tool()
            print(f"Created dataset info tool: {self.dataset_info_tool.name}")
        except Exception as e:
            print(f"ERROR creating dataset tool: {e}")
            from langchain.tools import StructuredTool
            # Create a fallback tool
            self.dataset_info_tool = StructuredTool.from_function(
                func=lambda query: "Beklager, jeg kunne ikke søke etter datasett på grunn av en teknisk feil.",
                name="search_dataset",
                description="Search for datasets using vector search based on a query about the dataset content."
            )
        
        # Verify tools were created successfully
        print(f"Created tools successfully: {self.retrieval_tool.name}, {self.dataset_info_tool.name}")
        
        # Build the conversation workflow
        print("Building conversation workflow...")
        self.workflow = self._build_conversation_workflow()
        print("RAG workflow initialization complete.")

    def _create_retrieval_tool(self):
        """Create a tool for retrieval operations using GeoNorgeVectorRetriever."""
        from langchain.tools import StructuredTool

        def retrieve_geo_information(query: str) -> str:
            """Search and retrieve geographical information from GeoNorge database."""
            import asyncio
            
            # Create a dedicated async function to run in the main thread
            async def _retrieve_data():
                try:
                    # Use the retriever to get relevant documents
                    documents, vdb_response = await self.retriever.get_relevant_documents(query)
                    
                    # Format the documents into a string for the LLM
                    formatted_docs = "\n\n".join([doc.page_content for doc in documents])
                    
                    # Return the formatted documents and metadata
                    return formatted_docs
                except Exception as e:
                    print(f"ERROR in retrieve_geo_information: {e}")
                    import traceback
                    traceback.print_exc()
                    return "Beklager, jeg kunne ikke hente informasjon. Det oppstod en feil i søket."
            
            # Create event loop and run until complete
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(_retrieve_data())
                return result
            except Exception as e:
                print(f"ERROR in retrieve_geo_information: {e}")
                return "Beklager, jeg kunne ikke hente informasjon fra databasen."
            finally:
                loop.close()
            
        return StructuredTool.from_function(
            func=retrieve_geo_information,
            name="retrieve_geo_information",
            description="Search and retrieve geographical information from GeoNorge database based on vector search."
        )
        
    def _create_dataset_info_tool(self):
        """Create a tool for vector-based dataset search."""
        from langchain.tools import StructuredTool
        from helpers.vector_database import get_vdb_response
        
        def search_dataset(dataset_query: str) -> str:
            """Find dataset information using vector search."""
            import asyncio
            
            # Create a dedicated async function to run in the main thread
            async def _search_data():
                try:
                    # Use the vector database directly to find datasets matching the query
                    vdb_response = await get_vdb_response(dataset_query)
                    
                    if not vdb_response:
                        return "Ingen datasett funnet som matcher søket ditt."
                    
                    # Format the response into readable text
                    formatted_response = "Her er datasettene som matcher søket ditt:\\n\\n"
                    
                    for idx, row in enumerate(vdb_response, 1):  # Limit removed
                        uuid = row[0]
                        title = row[1]
                        abstract = row[2] if len(row) > 2 and row[2] else "Ingen beskrivelse tilgjengelig"
                        
                        # Create source URL
                        url_formatted_title = title.replace(' ', '-')
                        source_url = f"https://kartkatalog.geonorge.no/metadata/{url_formatted_title}/{uuid}"
                        
                        # Add to formatted response
                        formatted_response += f"{idx}. **{title}**\n"
                        formatted_response += f"Beskrivelse: {abstract}\n"
                        formatted_response += f"Mer informasjon: {source_url}\n\n"
                    
                    return formatted_response
                    
                except Exception as e:
                    print(f"ERROR in search_dataset: {e}")
                    import traceback
                    traceback.print_exc()
                    return "Beklager, jeg kunne ikke søke etter datasett. Det oppstod en feil i søket."
            
            # Create event loop and run until complete
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(_search_data())
                return result
            except Exception as e:
                print(f"ERROR in search_dataset: {e}")
                return "Beklager, jeg kunne ikke søke etter datasett."
            finally:
                loop.close()
            
        return StructuredTool.from_function(
            func=search_dataset,
            name="search_dataset",
            description="Search for datasets using vector search based on a query about the dataset content."
        )

    async def agent_node(self, state: AgentState) -> Dict:
        """
        Custom agent implementation that decides what action to take based on the query.
        
        This replaces the traditional ReAct agent with a custom implementation.
        """
        from llm import LLMManager
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
        from helpers.websocket import send_websocket_message
        from .utils.common import active_websockets
        import json
        
        print("DEBUG agent_node: Starting agent processing")
        
        # Get messages and chat history from state
        messages = state.get("messages", [])
        chat_history = state.get("chat_history", "")
        websocket_id = state.get("websocket_id", "")
        
        # Keep track of original query for dataset retrieval
        original_query = state.get("original_query", "")
        
        # Get the websocket from active_websockets if available
        websocket = None
        if websocket_id:
            print(f"DEBUG agent_node: Looking for websocket with ID {websocket_id}")
            websocket = active_websockets.get(websocket_id)
            if websocket:
                print(f"DEBUG agent_node: Found websocket for ID {websocket_id}")
            else:
                print(f"DEBUG agent_node: No websocket found for ID {websocket_id}")
        
        if not messages:
            print("DEBUG agent_node: No messages in state")
            return state
        
        # Convert dict messages to proper Message objects if needed
        formatted_messages = []
        for msg in messages:
            if isinstance(msg, (SystemMessage, HumanMessage, AIMessage)):
                # Already a proper message object
                formatted_messages.append(msg)
            elif isinstance(msg, dict):
                # Convert dict to proper message object
                role = msg.get("role", "")
                content = msg.get("content", "")
                
                if role == "system":
                    formatted_messages.append(SystemMessage(content=content))
                elif role == "human" or role == "user":
                    formatted_messages.append(HumanMessage(content=content))
                elif role == "assistant" or role == "ai":
                    # Handle tool calls if present
                    if "additional_kwargs" in msg and "tool_calls" in msg["additional_kwargs"]:
                        # Create AIMessage with tool calls
                        formatted_messages.append(AIMessage(
                            content=content,
                            additional_kwargs={"tool_calls": msg["additional_kwargs"]["tool_calls"]}
                        ))
                    else:
                        formatted_messages.append(AIMessage(content=content))
        
        # Store original query if this is first human message and no original query exists
        if not original_query and len(formatted_messages) > 0:
            for msg in formatted_messages:
                if isinstance(msg, HumanMessage):
                    original_query = msg.content
                    print(f"DEBUG agent_node: Storing original query: {original_query}")
                    break
        
        # Use the chat_history from state if it exists, otherwise build it from messages
        chat_history_context = ""
        if chat_history:
            # Use existing chat history from state
            chat_history_context = f"\n\nTidligere samtale:\n{chat_history}"
        else:
            # Fall back to extracting history from messages
            if len(formatted_messages) > 1:
                history_pairs = []
                # Iterate through messages up to the second-to-last one
                i = 0
                while i < len(formatted_messages) - 1: # Stop before the last message
                    current_msg = formatted_messages[i]
                    # Find the next Human message
                    if isinstance(current_msg, HumanMessage) and hasattr(current_msg, 'content'):
                        human_content = current_msg.content
                        # Look for the next corresponding non-tool-call AI message
                        j = i + 1
                        ai_content = None
                        found_ai_response = False
                        while j < len(formatted_messages) - 1: # Stop before the last message
                            msg_j = formatted_messages[j]
                            if isinstance(msg_j, AIMessage):
                                 # Check if this AIMessage has tool calls
                                 has_tool_calls = (hasattr(msg_j, "tool_calls") and msg_j.tool_calls) or \
                                                  (hasattr(msg_j, "additional_kwargs") and "tool_calls" in msg_j.additional_kwargs)
                                 # Check if it has content and no tool calls
                                 if not has_tool_calls and hasattr(msg_j, 'content') and msg_j.content and msg_j.content.strip():
                                     ai_content = msg_j.content
                                     found_ai_response = True
                                     break # Found the corresponding AI response
                            # Move to the next message to continue search for AI response
                            j += 1

                        if human_content and found_ai_response:
                            history_pairs.append(f"Human: {human_content}\nAssistant: {ai_content}")
                            # Start searching for the next Human message from after the found AI message
                            i = j + 1
                        else:
                            # No corresponding AI message found for this Human message before the end,
                            # or human_content was empty. Move to the next potential Human message.
                            i += 1
                    else:
                        # Not a Human message, move to the next
                        i += 1

                if history_pairs:
                    chat_history_context = "\n\nTidligere samtale:\n" + "\n\n".join(history_pairs)
        
        system_content = f"""Du er en EKSPERT assistent for Geonorge, spesialisert på å finne geodata og datasett.
        Ditt mål er å gi brukeren det mest nøyaktige og oppdaterte svaret ved å bruke verktøyene dine så ofte som mulig.

        Du har tilgang til følgende verktøy:

        1. retrieve_geo_information: Bruk dette verktøyet for å hente oppdatert geografisk informasjon. Bruk dette verktøyet for å finne spesifikke datasett.
        2. search_dataset: Ikke bruk dette verktøyet.

        Slik skal du svare:
        - Bruk alltid et verktøy hvis det kan gi et mer presist eller oppdatert svar enn det du kan uten.
        - Hvis det er usikkerhet, bruk et verktøy fremfor å svare basert på samtalen alene.
        - Ikke spør brukeren om tillatelse – kall umiddelbart det mest relevante verktøyet.

        Husk:
        - Hvis du kan svare direkte, gjør det, men bare hvis du er helt sikker på at verktøyene ikke vil gi et bedre svar. 
        - AVSTÅ fra å svare på spørsmål som ikke er relevante for GIS, Geonorge, Geodata, datasett, eller andre GIS-relaterte emner.
        - Når brukeren ber om alternativer, relaterte emner eller bruker annen kontekstavhengig oppfølging, formuler et *nytt, spesifikt søk* for verktøyet basert på *hele samtalen*, ikke bare ved å legge til ord.
        - Hvis brukeren refererer til tidligere samtaler, bruk denne konteksten:  
        {chat_history_context if chat_history_context else original_query}

        Gjør ditt beste for å gi grundige og informative svar ved hjelp av dine verktøy."""
        
        has_system = any(isinstance(msg, SystemMessage) for msg in formatted_messages)
        if not has_system:
            formatted_messages.insert(0, SystemMessage(content=system_content))
        else:
            # Replace the existing system message with our updated one that includes chat history
            for i, msg in enumerate(formatted_messages):
                if isinstance(msg, SystemMessage):
                    formatted_messages[i] = SystemMessage(content=system_content)
                    break
        
        # Filter out messages with empty or None content
        filtered_messages = []
        for msg in formatted_messages:
            if hasattr(msg, 'content') and msg.content is None:
                print(f"DEBUG agent_node: Skipping message with None content: {type(msg)}")
                continue
                
            if hasattr(msg, 'content') and msg.content == "" and isinstance(msg, AIMessage):
                print(f"DEBUG agent_node: Fixing empty content AI message")
                msg.content = " "  # Replace empty content with space
                
            filtered_messages.append(msg)
        
        # Get the LLM and bind tools
        llm_manager = LLMManager()
        llm = llm_manager.get_main_llm()
        
        # Create the tools
        tools = [self.retrieval_tool, self.dataset_info_tool]
        llm_with_tools = llm.bind_tools(tools)
        
        # Print debugging info
        print(f"DEBUG agent_node: Using {len(tools)} tools")
        for i, tool in enumerate(tools):
            print(f"DEBUG agent_node: Tool {i} - {tool.name}: {tool.description}")
            
        # Call the model with the formatted messages
        try:
            print(f"DEBUG agent_node: Invoking LLM with {len(filtered_messages)} messages")
            
            # Check if we have a websocket to stream the response
            if websocket:
                print(f"DEBUG agent_node: Checking LLM response for tool calls before streaming")
                
                # Stream response token by token to get the final chunk
                response_chunks = []
                full_response_content = ""
                final_chunk = None
                async for chunk in llm_with_tools.astream(filtered_messages):
                    final_chunk = chunk  # Keep track of the last chunk object
                    # Accumulate content even if it might be tool calls initially
                    if hasattr(chunk, 'content'):
                        response_chunks.append(chunk.content)
                        full_response_content += chunk.content

                if not final_chunk:
                     raise ValueError("Streaming finished without receiving any chunks.")

                # Determine if the final response object contains tool calls
                has_tool_calls = (hasattr(final_chunk, "tool_calls") and final_chunk.tool_calls) or \
                                 (hasattr(final_chunk, "additional_kwargs") and "tool_calls" in final_chunk.additional_kwargs)

                if has_tool_calls:
                    # LLM wants to use tools, set response object and DO NOT stream/send completion signals yet
                    response = final_chunk 
                    print(f"DEBUG agent_node: LLM response contains tool calls. Skipping streaming from agent_node.")
                else:
                    # LLM provided a final answer, now we can stream it
                    print(f"DEBUG agent_node: LLM response is final answer. Starting stream.")
                    response = AIMessage(content=full_response_content) # Create AIMessage from streamed content
                    
                    # Send initial empty message to start streaming
                    await send_websocket_message("chatStream", {"payload": "", "isNewMessage": True}, websocket)
                    
                    # Send the collected chunks
                    for content_chunk in response_chunks:
                         if content_chunk: # Avoid sending empty chunks
                            print(f"DEBUG agent_node: Streaming chunk: {content_chunk[:20]}...")
                            await send_websocket_message("chatStream", {"payload": content_chunk}, websocket)

                    # Send stream complete actions ONLY when it's a final answer
                    print(f"DEBUG agent_node: Sending streamComplete and formatMarkdown for final answer.")
                    await send_websocket_action("streamComplete", websocket)
                    await send_websocket_action("formatMarkdown", websocket)
                    print(f"DEBUG agent_node: LLM response is final answer. Content: {full_response_content[:50]}...")

            else:
                # If no websocket, just invoke the model normally
                print(f"DEBUG agent_node: No websocket for streaming, using regular invoke")
                response = await llm_with_tools.ainvoke(filtered_messages)
            
            print(f"DEBUG agent_node: Got response type: {type(response)}")
            
            # Check for tool calls
            if hasattr(response, "tool_calls") and response.tool_calls:
                print(f"DEBUG agent_node: Found {len(response.tool_calls)} tool calls")
            elif hasattr(response, "additional_kwargs") and "tool_calls" in response.additional_kwargs:
                print(f"DEBUG agent_node: Found {len(response.additional_kwargs['tool_calls'])} tool calls in additional_kwargs")
                
            # Return updated state with the agent's response and original query
            return {
                "messages": messages + [response], 
                "chat_history": state.get("chat_history", ""), 
                "websocket_id": websocket_id,
                "original_query": original_query
            }
            
        except Exception as e:
            print(f"ERROR in agent_node: {e}")
            import traceback
            traceback.print_exc()
            
            # Return a fallback message
            from langchain_core.messages import AIMessage
            return {
                "messages": messages + [AIMessage(content="Beklager, jeg kunne ikke prosessere spørsmålet ditt. Kan du prøve på nytt?")], 
                "chat_history": state.get("chat_history", ""), 
                "websocket_id": websocket_id,
                "original_query": original_query
            }
    
    async def handle_tool_calls(self, state: AgentState) -> Dict:
        """Execute the tools called by the agent."""
        from langchain_core.messages import ToolMessage
        import json
        
        print("DEBUG handle_tool_calls: Starting tool execution")
        
        messages = state.get("messages", [])
        original_query = state.get("original_query", "")
        
        print(f"DEBUG handle_tool_calls: Original query: {original_query}")
        
        if not messages:
            print("DEBUG handle_tool_calls: No messages in state")
            return state
            
        # Get the last message
        last_message = messages[-1]
        print(f"DEBUG handle_tool_calls: Last message type: {type(last_message)}")
        
        print("DEBUG handle_tool_calls: Using direct tool execution")
        
        # Extract tool calls from the message
        tool_calls = []
        
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            tool_calls = last_message.tool_calls
        elif hasattr(last_message, "additional_kwargs") and "tool_calls" in last_message.additional_kwargs:
            tool_calls = last_message.additional_kwargs["tool_calls"]
        
        if not tool_calls:
            print("DEBUG handle_tool_calls: No tool calls found")
            return state
            
        print(f"DEBUG handle_tool_calls: Found {len(tool_calls)} tool calls")
        
        # Create a dict of available tools
        tools = [self.retrieval_tool, self.dataset_info_tool]
        tool_dict = {tool.name: tool for tool in tools}
        
        # Execute each tool
        tool_results = []
        # Initialize metadata_context to store vector DB results for image insertion
        metadata_context = []
        
        for tool_call in tool_calls:
            try:
                # Extract tool call info
                tool_name = None
                tool_args = None
                tool_id = ""
                
                # Handle different tool call formats
                if isinstance(tool_call, dict):
                    if "name" in tool_call:
                        tool_name = tool_call["name"]
                        tool_args = tool_call.get("args", {})
                        tool_id = tool_call.get("id", "")
                    elif "function" in tool_call:
                        tool_name = tool_call["function"].get("name", "")
                        try:
                            tool_args = json.loads(tool_call["function"].get("arguments", "{}"))
                        except:
                            tool_args = {}
                        tool_id = tool_call.get("id", "")
                else:
                    if hasattr(tool_call, "name"):
                        tool_name = tool_call.name
                        tool_args = getattr(tool_call, "args", {})
                        tool_id = getattr(tool_call, "id", "")
                        
                if not tool_name:
                    print("DEBUG handle_tool_calls: Could not extract tool name, skipping")
                    continue
                
                print(f"DEBUG handle_tool_calls: Executing {tool_name} with args: {tool_args}")
                
                # Get the tool and execute it
                if tool_name in tool_dict:
                    tool = tool_dict[tool_name]
                    
                    # Execute the tool based on the tool type
                    if tool_name == "retrieve_geo_information":
                        # Extract query param
                        query = None
                        if isinstance(tool_args, dict):
                            query = tool_args.get("query")
                        elif isinstance(tool_args, str):
                            query = tool_args
                            
                        if not query:
                            print("DEBUG handle_tool_calls: No query parameter found")
                            raise ValueError("Missing query parameter")
                        
                        # Use the query from arguments for metadata retrieval, fallback to original_query from state if needed
                        metadata_query = query if query else original_query
                        print(f"DEBUG handle_tool_calls: Using metadata query: {metadata_query}")
                        
                        # Call the tool with the query
                        result = tool.func(query)
                        
                        # Get vector DB response for metadata context (for image insertion)
                        try:
                            import asyncio
                            vdb_response = []
                            # Get vector DB results for image metadata
                            async def _get_metadata():
                                from helpers.vector_database import get_vdb_response
                                return await get_vdb_response(metadata_query)
                                
                            loop = asyncio.get_event_loop()
                            vdb_response = loop.run_until_complete(_get_metadata())
                            if vdb_response:
                                print(f"DEBUG handle_tool_calls: Found {len(vdb_response)} metadata items for image insertion")
                                metadata_context.extend(vdb_response)
                        except Exception as e:
                            print(f"ERROR in handle_tool_calls getting metadata: {e}")
                        
                        # Create a tool message with the result and original query
                        tool_results.append(ToolMessage(
                            content=str(result),
                            name=tool_name,
                            tool_call_id=tool_id,
                            additional_kwargs={
                                "original_query": query,
                                "metadata_query": metadata_query
                            }
                        ))
                        
                    elif tool_name == "search_dataset":
                        # Extract dataset_query param
                        dataset_query = None
                        if isinstance(tool_args, dict):
                            dataset_query = tool_args.get("dataset_query")
                        elif isinstance(tool_args, str):
                            dataset_query = tool_args
                            
                        if not dataset_query:
                            print("DEBUG handle_tool_calls: No dataset_query parameter found")
                            raise ValueError("Missing dataset_query parameter")
                        
                        # Use the dataset_query from arguments for metadata retrieval, fallback to original_query from state if needed
                        metadata_query = dataset_query if dataset_query else original_query
                        print(f"DEBUG handle_tool_calls: Using metadata query: {metadata_query}")
                        
                        # Call the tool with the dataset_query
                        result = tool.func(dataset_query)
                        
                        # Get vector DB response for metadata context (for image insertion)
                        try:
                            import asyncio
                            # Get vector DB results for image metadata
                            async def _get_metadata():
                                from helpers.vector_database import get_vdb_response
                                return await get_vdb_response(metadata_query)
                                
                            loop = asyncio.get_event_loop()
                            vdb_response = loop.run_until_complete(_get_metadata())
                            if vdb_response:
                                print(f"DEBUG handle_tool_calls: Found {len(vdb_response)} metadata items for image insertion")
                                metadata_context.extend(vdb_response)
                        except Exception as e:
                            print(f"ERROR in handle_tool_calls getting metadata: {e}")
                        
                        # Create a tool message with the result and original query
                        tool_results.append(ToolMessage(
                            content=str(result),
                            name=tool_name,
                            tool_call_id=tool_id,
                            additional_kwargs={
                                "original_query": dataset_query,
                                "metadata_query": metadata_query
                            }
                        ))
                    else:
                        raise ValueError(f"Unknown tool: {tool_name}")
                else:
                    print(f"ERROR: Tool {tool_name} not found")
            except Exception as tool_error:
                print(f"ERROR executing tool {tool_name}: {tool_error}")
                import traceback
                traceback.print_exc()
                tool_results.append(ToolMessage(
                    content=f"Error executing tool {tool_name}: {str(tool_error)}",
                    name=tool_name if tool_name else "unknown_tool",
                    tool_call_id=tool_id
                ))
        
        # Add tool results to messages
        new_messages = list(messages)
        new_messages.extend(tool_results)
        
        # Preserve existing state fields and update messages
        print(f"DEBUG handle_tool_calls: Returning metadata_context with {len(metadata_context)} items before state update.")
        # Return only the modified fields for LangGraph to merge
        return {
            "messages": tool_results, # Return only the ToolMessages added
            "metadata_context": metadata_context
        }
    
    async def rewrite_query(self, state: AgentState) -> Dict:
        """
        Transform the query to produce a better question for retrieval.
        """
        from llm import LLMManager
        
        messages = state["messages"]
        
        # Find the latest HumanMessage
        last_user_message = None
        for msg in reversed(messages):
            if isinstance(msg, HumanMessage):
                last_user_message = msg
                break
        
        # If we couldn't find a human message, return state unchanged
        if not last_user_message:
            return state
        
        # Get the content from the message
        question = ""
        if hasattr(last_user_message, 'content'):
            question = last_user_message.content
        else:
            # We couldn't get the content, return state unchanged
            return state
            
        # Create the prompt for query reformulation
        prompt_msg = HumanMessage(
            content=f""" \n 
        Look at the input and try to reason about the underlying semantic intent / meaning. \n 
        Here is the initial question:
        \n ------- \n
        {question} 
        \n ------- \n
        Formulate the question to ONLY be a SINGLE sentence for better geographical data retrieval: """
        )
        
        # Use our LLM manager to get the model
        llm_manager = LLMManager()
        model = llm_manager.get_main_llm()
        response = await model.ainvoke([prompt_msg])
        
        # Create new messages list, filtering out the original message
        new_messages = []
        for msg in messages:
            if msg != last_user_message:
                new_messages.append(msg)
        
        # Add the improved query
        new_messages.append(HumanMessage(content=response.content))

        # Preserve other state fields when returning the update
        return {
            "messages": new_messages,
            "websocket_id": state.get("websocket_id"),
            "chat_history": state.get("chat_history"),
            "original_query": state.get("original_query"),
            "metadata_context": state.get("metadata_context", []) # Preserve metadata
        }
        
    async def assess_relevance(self, state: AgentState) -> Literal["generate", "rewrite"]:
        """
        Determines whether the retrieved documents are relevant to the question.
        Similar to the grade_documents function in the tutorial.
        """
        from llm import LLMManager
        
        messages = state["messages"]
        
        # Check if we have at least one message
        if not messages:
            return "rewrite"
            
        last_message = messages[-1]
        
        # Check if the last message is a ToolMessage
        if not isinstance(last_message, ToolMessage):
            # Try to find any tool message
            tool_message = None
            for msg in reversed(messages):
                if isinstance(msg, ToolMessage):
                    tool_message = msg
                    break
                    
            if not tool_message:
                # No tool message found, so we need to rewrite
                return "rewrite"
            else:
                # Use the found tool message instead
                last_message = tool_message
        
        # Get the content of the last message
        context = ""
        if hasattr(last_message, 'content'):
            context = last_message.content
        
        # If we don't have context, default to rewrite
        if not context:
            print("DEBUG assess_relevance: No context found, defaulting to rewrite")
            return "rewrite"
        
        # Shortcut for fallback message - if it contains specific text about not finding datasets
        if "Beklager, jeg fant ingen relevante datasett" in context:
            return "rewrite"
        
        # Check if context is too short to be useful (less than 100 characters)
        if len(context) < 100:
            return "rewrite"
        
        # Get the original query from the tool message if available
        original_query = None
        if hasattr(last_message, 'additional_kwargs'):
            original_query = last_message.additional_kwargs.get('original_query')
            print(f"DEBUG assess_relevance: Found original query from tool: {original_query}")
        
        # If no original query in tool message, try to find it from the tool call that led to this result
        if not original_query:
            for msg in reversed(messages):
                if hasattr(msg, 'additional_kwargs') and 'tool_calls' in msg.additional_kwargs:
                    for tool_call in msg.additional_kwargs['tool_calls']:
                        if isinstance(tool_call, dict) and 'function' in tool_call:
                            try:
                                args = json.loads(tool_call['function'].get('arguments', '{}'))
                                original_query = args.get('query') or args.get('dataset_query')
                                if original_query:
                                    print(f"DEBUG assess_relevance: Found original query from tool call: {original_query}")
                                    break
                            except:
                                continue
                    if original_query:
                        break
        
        # If we still don't have a query, use the most recent human message as fallback
        if not original_query:
            print("DEBUG assess_relevance: No original query found, using most recent human message")
            for msg in reversed(messages):
                if isinstance(msg, HumanMessage) and hasattr(msg, 'content'):
                    original_query = msg.content
                    print(f"DEBUG assess_relevance: Using fallback query: {original_query[:50]}...")
                    break
        
        # If we still don't have a query, default to rewrite
        if not original_query:
            print("DEBUG assess_relevance: No query found at all, defaulting to rewrite")
            return "rewrite"
        
        # Create the relevance assessment prompt
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """Du er en vurderer som skal avgjøre om informasjonen er relevant for brukerens spørsmål.
            
            Vurder BARE om informasjonen er relevant, ikke om den er fullstendig.
            Gi 'yes' hvis informasjonen er relevant for spørsmålet, ellers 'no'.
            Vær konservativ og si 'yes' selv om bare deler av informasjonen er relevant."""),
            ("human", f"""
            Her er informasjonen som ble hentet:
            {context}
            
            Her er brukerens spørsmål:
            {original_query}
            
            Er denne informasjonen relevant for spørsmålet? Svar kun med 'yes' eller 'no'.
            """)
        ])
        
        try:
            # Get LLM and invoke the prompt
            llm_manager = LLMManager()
            llm = llm_manager.get_main_llm()
            
            chain = prompt | llm | StrOutputParser()
            
            result = await chain.ainvoke({})
            result = result.lower().strip()
            print(f"DEBUG assess_relevance: Relevance assessment result: {result}")
            
            # Check if the result contains "yes"
            if "yes" in result:
                return "generate"
            else:
                return "rewrite"
        except Exception as e:
            print(f"ERROR in assess_relevance: {e}")
            # Default to generate on error
            return "generate"
            
    async def generate_final_response(self, state: AgentState) -> Dict:
        """
        Generate a final response based on the retrieved information.
        """
        from langchain_core.prompts import PromptTemplate
        from llm import LLMManager
        from helpers.websocket import send_websocket_message, send_websocket_action
        from .utils.common import active_websockets, get_websocket
        import json
        
        messages = state["messages"]
        websocket_id = state.get("websocket_id", "")
        original_query = state.get("original_query", "")
        
        print(f"DEBUG generate_final_response: Starting with websocket_id: {websocket_id}")
        print(f"DEBUG generate_final_response: Original query: {original_query}")
        
        websocket = None
        
        # Get the websocket - first try directly from the active_websockets dictionary
        if websocket_id:
            print(f"DEBUG: Trying to get websocket with ID {websocket_id} from active_websockets")
            print(f"DEBUG: Active websockets: {list(active_websockets.keys())}")
            
            # Try to get the websocket from active_websockets
            websocket = active_websockets.get(websocket_id)
            
            if websocket:
                print(f"DEBUG: Successfully found websocket for ID {websocket_id}")
            else:
                print(f"DEBUG: No websocket found for ID {websocket_id} in active_websockets")
                print(f"DEBUG: Will continue without streaming capability")
        else:
            print(f"DEBUG: No websocket_id provided in state")
            print(f"DEBUG: State keys: {state.keys()}")
            
        # First try to get the metadata query from the tool message
        metadata_query = None
        query_for_response = None
        tool_message = None
        
        # Find the most recent tool message
        for msg in reversed(messages):
            if isinstance(msg, ToolMessage):
                tool_message = msg
                break
                
        if tool_message:
            # Try to get the query from additional_kwargs
            if hasattr(tool_message, 'additional_kwargs'):
                # Use the queries stored in the tool message's kwargs
                metadata_query = tool_message.additional_kwargs.get('metadata_query')
                if not metadata_query: # Fallback if 'metadata_query' wasn't explicitly set
                    metadata_query = tool_message.additional_query.get('original_query')
                query_for_response = tool_message.additional_kwargs.get('original_query')
                
                print(f"DEBUG generate_final_response: Found query from tool: {query_for_response}")
                print(f"DEBUG generate_final_response: Using metadata query: {metadata_query}")
                
        # If we still don't have a query, fall back to the most recent human message
        if not query_for_response:
            print("DEBUG generate_final_response: No query found, falling back to most recent human message")
            for msg in reversed(messages):
                if isinstance(msg, HumanMessage) and hasattr(msg, 'content'):
                    # Use the content of the last human message
                    query_for_response = msg.content
                    print(f"DEBUG generate_final_response: Using fallback query: {query_for_response[:50]}...")
                    break
                    
        if not query_for_response:
            print("WARNING: Could not find any query to use")
            query_for_response = "Jeg trenger informasjon om geografiske data"
        
        # Get the retrieved information from the tool message
        retrieved_info = ""
        tool_type = "retrieve_geo_information"  # default type
        
        if tool_message and hasattr(tool_message, 'content'):
            retrieved_info = tool_message.content
            
            # Check which tool was used
            if hasattr(tool_message, 'name'):
                if tool_message.name == "search_dataset":
                    tool_type = "search_dataset"
                else:
                    tool_type = "retrieve_geo_information"
        
        # If we couldn't find tool message info, try a fallback approach
        if not retrieved_info:
            print("WARNING: No ToolMessage found, trying fallback retrieval")
            for msg in reversed(messages):
                if hasattr(msg, 'content') and isinstance(msg.content, str) and len(msg.content) > 100:
                    # Longer content might be retrieved information
                    retrieved_info = msg.content
                    break
        
        print(f"DEBUG generate_final_response: Using query '{query_for_response}' with retrieved info of length {len(retrieved_info)}")
        
        # Create the appropriate RAG prompt based on which tool was used
        if tool_type == "search_dataset":
            # The search_dataset tool already formats the response, just summarize it
            prompt = PromptTemplate(
                template="""Du er en EKSPERT for geografiske datasett i Norge. 
                Brukeren søkte etter datasett, og her er søkeresultatene:
                
                {context}
                
                Bruk informasjonen fra søkeresultatene til å svare på spørsmålet og foreslå datasett til brukeren: {question}
                
                Inkluder tittel, kort beskrivelse og lenke til hvert datasett i svaret. 
                Du MÅ legge til formatering med bold (**) for titler.

                
                Svar:""",
                input_variables=["question", "context"],
            )
        else:
            # Standard RAG prompt for general geographical information
            prompt = PromptTemplate(
                template="""Du er en assistent som svarer på spørsmål om geografiske data i Norge.
                
                Bruk informasjonen fra den forhåndsinnhentede konteksten for å svare på spørsmålet.
                Hvis du ikke finner svaret i konteksten, si at du ikke har nok informasjon og foreslå alternative måter brukeren kan spørre.
                Hold svaret konsist og fokusert på norske geografiske data.
                Du MÅ legge til formatering med bold (**) for titler.
                
                Spørsmål: {question} 
                
                Kontekst:
                {context}
                
                Svar:""",
                input_variables=["question", "context"],
            )
        
        # Create and run the generation chain
        llm_manager = LLMManager()
        llm = llm_manager.get_main_llm()
        chain = prompt | llm | StrOutputParser()

        # Send the response through websocket
        if websocket:
            # Check if we're in a mixed query workflow or standalone RAG workflow
            is_mixed_workflow = state.get("in_merged_workflow", False)
            
            # Only send the chat response if this is not part of a mixed workflow
            # For mixed workflows, the supervisor will handle sending the combined message
            if not is_mixed_workflow:
                print(f"DEBUG generate_final_response: Starting token-by-token streaming")
                # Send initial empty message to start streaming
                print(f"DEBUG: Sending initial chatStream message")
                await send_websocket_message("chatStream", {"payload": "", "isNewMessage": True}, websocket)
                
                # Stream response token by token
                response_chunks = []
                print(f"DEBUG: Starting to stream tokens")
                try:
                    async for chunk in (prompt | llm).astream({"question": query_for_response, "context": retrieved_info}):
                        if hasattr(chunk, 'content'):
                            response_chunks.append(chunk.content)
                            print(f"DEBUG: Streaming chunk: {chunk.content[:20]}...")
                            await send_websocket_message("chatStream", {"payload": chunk.content}, websocket)
                    
                    # Get full response from chunks
                    response = "".join(response_chunks)
                    print(f"DEBUG generate_final_response: Completed streaming for question: {query_for_response[:50]}...")
                    
                    # Send stream complete action
                    print(f"DEBUG: Sending streamComplete action directly")
                    await send_websocket_action("streamComplete", websocket)
                    print(f"DEBUG: Sending formatMarkdown action directly")
                    await send_websocket_action("formatMarkdown", websocket)
                    
                    # Now that the response is complete, try to insert image if we have metadata context
                    metadata_context = state.get("metadata_context", [])
                    print(f"DEBUG: Metadata context: {metadata_context}")
                    if metadata_context:
                        print(f"DEBUG: Found metadata context with {len(metadata_context)} items")
                        try:
                            await insert_image_rag_response(response, metadata_context, websocket)
                            print("DEBUG: Successfully inserted image after response")
                        except Exception as e:
                            print(f"ERROR: Failed to insert image: {e}")
                            import traceback
                            traceback.print_exc()
                    else:
                        print("DEBUG: No metadata context found for image insertion")
                        # Try to get fresh metadata for this query as fallback
                        try:
                            import asyncio
                            from helpers.vector_database import get_vdb_response
                            
                            # Use original query for metadata if we're responding to a search suggestion
                            query_for_metadata = metadata_query if metadata_query else query_for_response
                            
                            async def _get_metadata():
                                return await get_vdb_response(query_for_metadata)
                                
                            loop = asyncio.get_event_loop()
                            fallback_metadata = loop.run_until_complete(_get_metadata())
                            
                            if fallback_metadata:
                                print(f"DEBUG: Found fallback metadata with {(fallback_metadata)} items")
                                await insert_image_rag_response(response, fallback_metadata, websocket)
                                print("DEBUG: Successfully inserted image using fallback metadata")
                        except Exception as e:
                            print(f"ERROR: Failed to get or use fallback metadata: {e}")
                    
                    print(f"DEBUG: Marked response as streamed in state")
                    
                except Exception as e:
                    print(f"ERROR in generate_final_response: {e}")
                    # Default to generate on error
                    response = await chain.ainvoke({"question": query_for_response, "context": retrieved_info})
            else:
                print(f"DEBUG generate_final_response: Suppressing chat response in mixed workflow mode")
                # Still generate the response for the supervisor to use
                response = await chain.ainvoke({"question": query_for_response, "context": retrieved_info})
        else:
            print(f"DEBUG generate_final_response: No websocket available to send response")
            # Generate response without streaming
            response = await chain.ainvoke({"question": query_for_response, "context": retrieved_info})
        
        return {"messages": [AIMessage(content=response)]}

    def _build_conversation_workflow(self):
        """Build the enhanced conversation workflow with agentic capabilities."""
        workflow = StateGraph(AgentState)
        
        # Add nodes
        workflow.add_node("agent", self.agent_node)
        workflow.add_node("tool_execution", self.handle_tool_calls)
        workflow.add_node("rewrite", self.rewrite_query)
        workflow.add_node("assess_relevance", self.assess_relevance)
        workflow.add_node("generate", self.generate_final_response)
        
        # Define the flow with conditional edges
        workflow.add_edge(START, "agent")
        
        # Route based on agent decision
        workflow.add_conditional_edges(
            "agent",
            tools_condition,
            {
                "tools": "tool_execution",
                END: END,
            }
        )
        
        # After tool execution, assess relevance
        workflow.add_conditional_edges(
            "tool_execution",
            self.assess_relevance,
            {
                "generate": "generate",
                "rewrite": "rewrite"
            }
        )
        
        # After rewriting, go back to agent
        workflow.add_edge("rewrite", "agent")
        
        # Final response generation
        workflow.add_edge("generate", END)
        
        return workflow.compile(checkpointer=self.memory) 