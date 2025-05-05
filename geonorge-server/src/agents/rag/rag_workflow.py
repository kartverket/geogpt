"""
RAG workflow for GeoNorge, wrapping the existing workflow components.
"""
from typing import Dict, Callable, Any, List, Literal, Annotated, Sequence
from typing_extensions import TypedDict
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, END, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from langgraph.graph.message import add_messages
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from helpers.websocket import send_websocket_action
from retrieval import GeoNorgeVectorRetriever

from .utils.common import register_websockets_dict
from .utils.image_processor import insert_image_rag_response
from .message_utils import standardize_message, standardize_state, get_last_message_by_role

def tools_condition(state: Dict) -> Literal["tools", END]:
    """
    Determines if the agent wants to use a tool or if it has a final response.
    Checks the last message directly for tool calls before standardization.
    """
    print(f"DEBUG tools_condition: Checking for tool calls in state")

    # Get messages list from state
    messages = state.get("messages", [])
    if not messages:
        print("DEBUG tools_condition: No messages in state, returning END")
        return END

    # --- Check the actual last message object ---
    last_message_obj = messages[-1]
    has_tool_calls = False

    if isinstance(last_message_obj, AIMessage):
        # LangChain AIMessage object
        if last_message_obj.tool_calls and len(last_message_obj.tool_calls) > 0:
            print(f"DEBUG tools_condition: Found tool_calls in AIMessage object: {last_message_obj.tool_calls}")
            has_tool_calls = True
        elif last_message_obj.additional_kwargs and "tool_calls" in last_message_obj.additional_kwargs and last_message_obj.additional_kwargs["tool_calls"]:
             print(f"DEBUG tools_condition: Found tool_calls in AIMessage additional_kwargs: {last_message_obj.additional_kwargs['tool_calls']}")
             has_tool_calls = True
    elif isinstance(last_message_obj, dict):
        # Dictionary representation
        if last_message_obj.get("role") == "assistant":
             if "tool_calls" in last_message_obj and last_message_obj["tool_calls"]:
                 print(f"DEBUG tools_condition: Found tool_calls key in dict: {last_message_obj['tool_calls']}")
                 has_tool_calls = True
             elif "additional_kwargs" in last_message_obj and "tool_calls" in last_message_obj["additional_kwargs"] and last_message_obj["additional_kwargs"]["tool_calls"]:
                 print(f"DEBUG tools_condition: Found tool_calls in dict additional_kwargs: {last_message_obj['additional_kwargs']['tool_calls']}")
                 has_tool_calls = True

    # --- End direct check ---

    if has_tool_calls:
        print("DEBUG tools_condition: Returning 'tools'")
        return "tools"
    else:
        # Optional: Log why no tool calls were detected
        if isinstance(last_message_obj, AIMessage):
            print(f"DEBUG tools_condition: No tool_calls found in AIMessage (tool_calls={getattr(last_message_obj, 'tool_calls', None)}, kwargs={getattr(last_message_obj, 'additional_kwargs', {}).get('tool_calls')})")
        elif isinstance(last_message_obj, dict):
            print(f"DEBUG tools_condition: No tool_calls found in dict (tool_calls key: {'tool_calls' in last_message_obj}, kwargs key: {'additional_kwargs' in last_message_obj and 'tool_calls' in last_message_obj['additional_kwargs']})")
        else:
            print(f"DEBUG tools_condition: Last message is neither AIMessage nor dict ({type(last_message_obj)}), cannot check for tool calls.")

        print("DEBUG tools_condition: No tool calls detected, returning END")
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
        
        # Use standardized state conversion
        state_dict = standardize_state(state)
        
        # If no messages in state, apply fallback
        if "messages" not in state_dict or not state_dict["messages"]:
            print(f"DEBUG: No messages in state for {node_func.__name__}, adding fallback message")
            state_dict["messages"] = [{"role": "human", "content": "Hjelp meg med geografiske data"}]
        
        # Call the node function with standardized state
        return await node_func(state_dict)
    
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

        # Define the list of tools for ToolNode
        self.tools = [self.retrieval_tool, self.dataset_info_tool]
        self.tool_node = ToolNode(self.tools)
        print("Initialized ToolNode with available tools.")

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
            
            async def _retrieve_data():
                try:
                    # Only retrieve documents, no metadata context handling here
                    documents, _ = await self.retriever.get_relevant_documents(query)
                    formatted_docs = "\n\n".join([doc.page_content for doc in documents])
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
        from helpers.vector_database import get_vdb_response # Keep import for now, will move later
        
        def search_dataset(dataset_query: str) -> str:
            """Find dataset information using vector search. Returns formatted string."""
            import asyncio
            
            async def _search_data():
                try:
                    # Only retrieve dataset info, no metadata context handling here
                    vdb_response = await get_vdb_response(dataset_query)
                    
                    if not vdb_response:
                        return "Ingen datasett funnet som matcher søket ditt."
                    
                    formatted_response = "Her er datasettene som matcher søket ditt:\\n\\n"
                    for idx, row in enumerate(vdb_response, 1):
                        uuid = row[0]
                        title = row[1]
                        abstract = row[2] if len(row) > 2 and row[2] else "Ingen beskrivelse tilgjengelig"
                        url_formatted_title = title.replace(' ', '-')
                        source_url = f"https://kartkatalog.geonorge.no/metadata/{url_formatted_title}/{uuid}"
                        formatted_response += f"{idx}. **{title}**\\n"
                        formatted_response += f"Beskrivelse: {abstract}\\n"
                        formatted_response += f"Mer informasjon: {source_url}\\n\\n"
                    
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
            description="Search for datasets using vector search based on a query about the dataset content. Returns a formatted string."
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
        
        # Standardize state
        state_dict = standardize_state(state)
        
        # Get messages and chat history from state
        messages = state_dict.get("messages", [])
        chat_history = state_dict.get("chat_history", "")
        websocket_id = state_dict.get("websocket_id", "")
        
        # Keep track of original query for dataset retrieval
        original_query = state_dict.get("original_query", "")
        
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
            return state_dict
        
        # Convert all messages to standard LangChain Message objects
        formatted_messages = []
        for msg in messages:
            std_msg = standardize_message(msg)
            
            # Convert standard dict format to LangChain Message objects
            if std_msg["role"] == "system":
                formatted_messages.append(SystemMessage(content=std_msg["content"]))
            elif std_msg["role"] == "human":
                formatted_messages.append(HumanMessage(content=std_msg["content"]))
            elif std_msg["role"] == "assistant":
                # Handle tool calls if present
                if "additional_kwargs" in std_msg and "tool_calls" in std_msg["additional_kwargs"]:
                    # Create AIMessage with tool calls
                    formatted_messages.append(AIMessage(
                        content=std_msg["content"],
                        additional_kwargs={"tool_calls": std_msg["additional_kwargs"]["tool_calls"]}
                    ))
                else:
                    formatted_messages.append(AIMessage(content=std_msg["content"]))
            elif std_msg["role"] == "tool":
                formatted_messages.append(ToolMessage(
                    content=std_msg["content"],
                    tool_call_id=std_msg.get("tool_call_id", "")
                ))
                
        # Store original query if this is first human message and no original query exists
        if not original_query:
            human_message_content = get_last_message_by_role(messages, "human")
            if human_message_content:
                original_query = human_message_content
                print(f"DEBUG agent_node: Storing original query: {original_query}")
        
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
                "chat_history": state_dict.get("chat_history", ""),
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
                "chat_history": state_dict.get("chat_history", ""),
                "websocket_id": websocket_id,
                "original_query": original_query
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
        }
        
    async def assess_relevance(self, state: AgentState) -> Literal["generate", "rewrite"]:
        """
        Determines whether the retrieved documents are relevant to the question.
        Relies on finding the query used in the tool call that generated the most recent ToolMessage.
        """
        from llm import LLMManager
        import json # Needed for parsing tool arguments

        # Standardize the state
        state_dict = standardize_state(state)
        messages = state_dict.get("messages", [])
        
        # Check if we have at least one message
        if not messages:
            print("DEBUG assess_relevance: No messages, defaulting to rewrite")
            return "rewrite"
            
        # Find the last ToolMessage using standardized roles
        last_tool_message = None
        last_tool_message_index = -1
        
        for i in range(len(messages) - 1, -1, -1):
            msg = standardize_message(messages[i])
            if msg["role"] == "tool":
                last_tool_message = msg
                last_tool_message_index = i
                break
        
        if not last_tool_message:
            print("DEBUG assess_relevance: No ToolMessage found, defaulting to rewrite")
            return "rewrite"
            
        # Get the content from the standardized message
        context = last_tool_message.get("content", "")
        
        # If we don't have context, default to rewrite
        if not context:
            print("DEBUG assess_relevance: No context found in ToolMessage, defaulting to rewrite")
            return "rewrite"
        
        # Shortcut for fallback message
        if "Beklager, jeg fant ingen relevante datasett" in context or "Beklager, jeg kunne ikke hente informasjon" in context:
            print("DEBUG assess_relevance: Tool returned fallback message, defaulting to rewrite")
            return "rewrite"
        
        # Check if context is too short to be useful (e.g., less than 100 characters)
        if len(context) < 100:
            print(f"DEBUG assess_relevance: Context too short ({len(context)} chars), defaulting to rewrite")
            return "rewrite"
        
        # --- Find the original query associated with this ToolMessage --- 
        original_query = None
        tool_call_id = last_tool_message.get("tool_call_id", "")
        
        if tool_call_id:
            # Search backwards for the AIMessage that invoked this tool_call_id
            for i in range(last_tool_message_index - 1, -1, -1):
                msg = standardize_message(messages[i])
                if msg["role"] == "assistant" and "additional_kwargs" in msg and "tool_calls" in msg["additional_kwargs"]:
                    tool_calls_in_ai = msg["additional_kwargs"]["tool_calls"]
                    
                    # Find the specific tool call by ID
                    for tc in tool_calls_in_ai:
                        current_tc_id = tc.get('id', "")
                        current_tc_args = tc.get('function', {}).get('arguments', "{}")
                        
                        if current_tc_id == tool_call_id:
                            # Found the matching tool call, extract the query
                            try:
                                args_dict = json.loads(current_tc_args) if isinstance(current_tc_args, str) else current_tc_args
                                original_query = args_dict.get('query') or args_dict.get('dataset_query')
                                
                                if original_query:
                                    print(f"DEBUG assess_relevance: Found query '{original_query[:50]}...' from AIMessage tool call {tool_call_id}")
                                    break # Stop searching tool calls in this AI message
                            except json.JSONDecodeError:
                                print(f"DEBUG assess_relevance: Could not parse args as JSON: {current_tc_args}")
                            
                    if original_query:
                        break # Stop searching previous messages

        # Fallback: If query not found via tool_call_id, use the most recent human message
        if not original_query:
            print("DEBUG assess_relevance: Could not find query via tool_call_id, falling back to last HumanMessage")
            original_query = get_last_message_by_role(messages, "human")
            if original_query:
                print(f"DEBUG assess_relevance: Using fallback query from HumanMessage: {original_query[:50]}...")
        
        # Final fallback if no query is found at all
        if not original_query:
            print("DEBUG assess_relevance: No query found at all, defaulting to rewrite")
            return "rewrite"
        # --- End finding original query --- 

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
        Fetches metadata for image insertion based on the query used in the tool call.
        """
        from langchain_core.prompts import PromptTemplate
        from llm import LLMManager
        from helpers.websocket import send_websocket_message, send_websocket_action
        from .utils.common import active_websockets # Keep get_websocket if needed elsewhere
        from helpers.vector_database import get_vdb_response # Need this here now
        import json
        import asyncio
        
        # Standardize the state
        state_dict = standardize_state(state)
        messages = state_dict.get("messages", [])
        websocket_id = state_dict.get("websocket_id", "")
        
        print(f"DEBUG generate_final_response: Starting with websocket_id: {websocket_id}")
        
        websocket = active_websockets.get(websocket_id) if websocket_id else None
        if websocket:
            print(f"DEBUG generate_final_response: Found websocket for ID {websocket_id}")
        else:
             print(f"DEBUG generate_final_response: No websocket found for ID {websocket_id}, continuing without streaming.")
             
        # --- Find the most recent ToolMessage and its associated query --- 
        last_tool_message = None
        last_tool_message_index = -1
        tool_type = "retrieve_geo_information" # Default
        query_for_response = None # The query user asked that led to this tool use
        metadata_query = None # The specific query used in the tool call args
        retrieved_info = ""
        
        # Find the last tool message using standardized messages
        for i in range(len(messages) - 1, -1, -1):
            msg = standardize_message(messages[i])
            if msg["role"] == "tool":
                last_tool_message = msg
                last_tool_message_index = i
                retrieved_info = msg.get("content", "")
                tool_type = msg.get("name", "retrieve_geo_information")
                break # Found the latest tool message
        
        if not last_tool_message:
             print("WARNING generate_final_response: No ToolMessage found. Cannot generate response.")
             # Attempt to find *any* long message content as fallback context
             for msg in messages:
                 std_msg = standardize_message(msg)
                 if std_msg.get("content", "") and len(std_msg["content"]) > 100:
                     retrieved_info = std_msg["content"]
                     print("WARNING generate_final_response: Using fallback context from a non-ToolMessage.")
                     break
             # Fallback query
             query_for_response = get_last_message_by_role(messages, "human") 
             metadata_query = query_for_response # Use same query for metadata as fallback
             
             if not query_for_response:
                 query_for_response = "Jeg trenger informasjon om geografiske data" # Ultimate fallback
                 metadata_query = query_for_response
        else:
            # Found a ToolMessage, now find the query that invoked it
            tool_call_id = last_tool_message.get("tool_call_id", "")
            if tool_call_id:
                # Search for the assistant message with matching tool call
                for i in range(last_tool_message_index - 1, -1, -1):
                    msg = standardize_message(messages[i])
                    if msg["role"] == "assistant" and "additional_kwargs" in msg and "tool_calls" in msg["additional_kwargs"]:
                        tool_calls_in_ai = msg["additional_kwargs"]["tool_calls"]
                        
                        for tc in tool_calls_in_ai:
                            # Extract ID and arguments based on standard OpenAI format
                            current_tc_id = tc.get('id', "")
                            function_data = tc.get('function', {})
                            current_tc_args = function_data.get('arguments', "{}")
                                
                            if current_tc_id == tool_call_id:
                                try:
                                    # Parse the arguments JSON string or use the object directly
                                    args_dict = json.loads(current_tc_args) if isinstance(current_tc_args, str) else current_tc_args
                                    metadata_query = args_dict.get('query') or args_dict.get('dataset_query')
                                    query_for_response = metadata_query # Assume they are the same unless refined later
                                    
                                    if metadata_query:
                                        print(f"DEBUG generate_final_response: Found query '{metadata_query[:50]}...' from AIMessage tool call {tool_call_id}")
                                        break
                                except Exception as e:
                                    print(f"ERROR generate_final_response: Could not parse args: {e}")
                                    
                        if metadata_query: 
                            break # Stop searching previous messages if found
            
            # Fallback if query not found via tool_call_id
            if not metadata_query:
                print("DEBUG generate_final_response: Could not find query via tool_call_id, falling back to last HumanMessage")
                query_for_response = get_last_message_by_role(messages, "human")
                metadata_query = query_for_response
        
        # Final fallback
        if not query_for_response:
            query_for_response = "Jeg trenger informasjon om geografiske data"
        if not metadata_query:
             metadata_query = query_for_response
             
        print(f"DEBUG generate_final_response: Using query_for_response '{query_for_response[:50]}...', metadata_query '{metadata_query[:50]}...', tool_type '{tool_type}', context length {len(retrieved_info)}")
        
        # --- Fetch metadata context for image insertion --- 
        metadata_context_for_image = []
        try:
            print(f"DEBUG generate_final_response: Fetching VDB response for metadata query: {metadata_query}")
            # Ensure we have a running event loop
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError: # No running loop
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
            # Run the async function to get metadata
            async def _get_metadata(): 
                return await get_vdb_response(metadata_query)
            
            # Check if loop is already running (e.g., in FastAPI context)
            if loop.is_running():
                 # If already running, create a task and wait for it
                 # This handles cases where generate_final_response is called within an existing async context
                 task = loop.create_task(_get_metadata())
                 metadata_context_for_image = await task # Await the task completion
            else:
                 # If not running, use run_until_complete
                 metadata_context_for_image = loop.run_until_complete(_get_metadata())
                 
            if metadata_context_for_image:
                print(f"DEBUG generate_final_response: Successfully fetched {len(metadata_context_for_image)} metadata items.")
            else:
                 print(f"DEBUG generate_final_response: No metadata items found for query: {metadata_query}")
        except Exception as e:
            print(f"ERROR generate_final_response: Failed to fetch metadata: {e}")
            import traceback
            traceback.print_exc()
        # --- End fetching metadata --- 

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
                Ikke legg til kartoperasjoner i svaret.

                
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

                IKKE legg til kartoperasjoner i svaret. Eksempel på ting som ikke skal være i svaret: "Jeg kan ikke utføre kartoperasjoner.". Fortell brukeren de kan legge til kartlag fra datasettet ved å trykke på "VIS" knappen på bildet. 
                
                Bruk informasjonen fra søkeresultatene til å svare på spørsmålet og foreslå datasett til brukeren: {question}
                
                Kontekst:
                {context}
                
                Svar:""",
                input_variables=["question", "context"],
            )
        
        # Create and run the generation chain
        llm_manager = LLMManager()
        llm = llm_manager.get_main_llm()
        chain = prompt | llm | StrOutputParser()

        final_response_content = ""
        
        # Send the response through websocket or generate directly
        if websocket:
            # Check if we're in a mixed query workflow or standalone RAG workflow
            is_mixed_workflow = state.get("in_merged_workflow", False)
            
            # Only send the chat response if this is not part of a mixed workflow
            # For mixed workflows, the supervisor will handle sending the combined message
            if not is_mixed_workflow:
                print(f"DEBUG generate_final_response: Starting token-by-token streaming (standalone RAG)")
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
                            # print(f"DEBUG: Streaming chunk: {chunk.content[:20]}...") # Less verbose logging
                            await send_websocket_message("chatStream", {"payload": chunk.content}, websocket)
                    
                    # Get full response from chunks
                    final_response_content = "".join(response_chunks)
                    print(f"DEBUG generate_final_response: Completed streaming for question: {query_for_response[:50]}...")
                    
                    # Send stream complete action
                    print(f"DEBUG: Sending streamComplete action directly")
                    await send_websocket_action("streamComplete", websocket)
                    print(f"DEBUG: Sending formatMarkdown action directly")
                    await send_websocket_action("formatMarkdown", websocket)
                    
                    # Perform image insertion ONLY if streaming directly (not in mixed workflow)
                    if metadata_context_for_image:
                        print(f"DEBUG: Found metadata context with {len(metadata_context_for_image)} items for standalone response")
                        try:
                            await insert_image_rag_response(final_response_content, metadata_context_for_image, websocket)
                            print("DEBUG: Successfully inserted image after standalone response")
                        except Exception as e:
                            print(f"ERROR: Failed to insert image: {e}")
                            import traceback
                            traceback.print_exc()
                    else:
                        print("DEBUG: No metadata context found or fetched for image insertion in standalone response")

                    # Mark response as streamed (though this state might not be used elsewhere now)
                    # state_dict["response_streamed"] = True 
                    print(f"DEBUG: Marked response as streamed in state (standalone)")
                    
                except Exception as e:
                    print(f"ERROR in generate_final_response streaming: {e}")
                    # Fallback to non-streaming generation if streaming fails
                    final_response_content = await chain.ainvoke({"question": query_for_response, "context": retrieved_info})
            else:
                # In mixed workflow: Generate content but DO NOT stream or insert image here.
                print(f"DEBUG generate_final_response: Suppressing chat response and image insertion in mixed workflow mode")
                final_response_content = await chain.ainvoke({"question": query_for_response, "context": retrieved_info})
                # Image insertion and streaming will be handled by the supervisor/merging node.
        else:
            # No websocket available: Generate response without streaming or image insertion.
            print(f"DEBUG generate_final_response: No websocket available to send response")
            final_response_content = await chain.ainvoke({"question": query_for_response, "context": retrieved_info})
        
        # Create the final AIMessage with metadata in additional_kwargs
        final_ai_message = AIMessage(
            content=final_response_content,
            additional_kwargs={
                "metadata_context": metadata_context_for_image # Add metadata here
            }
        )
        
        # Return the final message and ensure websocket_id is passed
        return {
            "messages": [final_ai_message],
            "websocket_id": websocket_id, # Ensure websocket_id is returned
            "in_merged_workflow": state.get("in_merged_workflow", False) # Pass the flag along
        }

    def _build_conversation_workflow(self):
        """Build the enhanced conversation workflow with agentic capabilities."""
        workflow = StateGraph(AgentState)
        
        # Add nodes
        workflow.add_node("agent", self.agent_node)
        workflow.add_node("tool_execution", self.tool_node)
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
                "__end__": END,
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
        
        return workflow.compile(
            checkpointer=self.memory,
            name="rag_expert"  # Add name for supervisor
        ) 