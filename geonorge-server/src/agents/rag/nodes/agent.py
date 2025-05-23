"""
Agent node for the RAG workflow.
"""
from typing import Dict
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from helpers.websocket import send_websocket_message, send_websocket_action
from ..state import AgentState
from ...utils.common import active_websockets

async def agent_node(state: AgentState, retrieval_tool, dataset_info_tool) -> Dict:
    """
    Custom agent implementation that decides what action to take based on the query.
    
    This replaces the traditional React agent with a custom implementation.
    """
    from llm import LLMManager
    # import json # Removed - already imported globally if needed elsewhere, not directly used here beyond message parsing

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
    
    # Suppress streaming in merged workflows
    in_merged_workflow = state.get("in_merged_workflow", False)
    if in_merged_workflow:
        print("DEBUG agent_node: In merged workflow, disabling websocket streaming")
        websocket = None
    
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
    
    system_content = f"""Du er en EKSPERT assistent for Geonorge, kalt GeoGPT, spesialisert på å finne geodata og datasett.

    Du har tilgang til følgende verktøy:

    1. retrieve_geo_information: Bruk dette verktøyet spesifikt for å søke etter datasett i GeoNorge-databasen. Søket er basert på en vektor-søk av brukerens beskrivelse av hva datasettet skal inneholde.

    Husk:
    - Hvis bruker spør om hva GeoGPT er, eller hva du tilbyr. Fortell om at du er en assistent som kan hjelpe med å finne geodata og datasett fra Geonorge. Gi eksempler på hva du kan hjelpe med, og hvordan du kan hjelpe.
    - AVSTÅ fra å svare på spørsmål som ikke er relevante for GIS, Geonorge, Geodata, datasett, eller andre GIS-relaterte emner.
    - Når brukeren ber om alternativer, relaterte emner eller bruker annen kontekstavhengig oppfølging, formuler et *nytt, spesifikt søk* for verktøyet basert på *hele samtalen*, ikke bare ved å legge til ord.
    - Bruk markdown for å formatere svarene dine.
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
    tools = [retrieval_tool, dataset_info_tool]
    llm_with_tools = llm.bind_tools(tools)
    
    # Print debugging info
    print(f"DEBUG agent_node: Using {len(tools)} tools")
    for i, tool in enumerate(tools):
        print(f"DEBUG agent_node: Tool {i} - {tool.name}: {tool.description}")
        
    # Call the model with the formatted messages
    try:
        print(f"DEBUG agent_node: Invoking LLM with {len(filtered_messages)} messages")
        
        # Check if we have a websocket to stream the response
        if websocket and not in_merged_workflow:
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
            "original_query": original_query,
            "rewrite_attempts": state.get("rewrite_attempts", 0)
        }
        
    except Exception as e:
        print(f"ERROR in agent_node: {e}")
        import traceback
        traceback.print_exc()
        
        # Return a fallback message
        return {
            "messages": messages + [AIMessage(content="Beklager, jeg kunne ikke prosessere spørsmålet ditt. Kan du prøve på nytt?")], 
            "chat_history": state.get("chat_history", ""), 
            "websocket_id": websocket_id,
            "original_query": original_query,
            "rewrite_attempts": state.get("rewrite_attempts", 0)
        } 