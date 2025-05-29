"""
Utility functions specifically for agent node operations.
"""
from typing import Dict, List, Optional
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from helpers.websocket import send_websocket_message, send_websocket_action

def extract_original_query(formatted_messages: List) -> str:
    """
    Extract the original query from the first human message in the conversation.
    
    Args:
        formatted_messages: List of formatted message objects
        
    Returns:
        The original query string or empty string if not found
    """
    for msg in formatted_messages:
        if isinstance(msg, HumanMessage) and msg.content:
            return msg.content
    return ""

def build_chat_history_context(chat_history: str, formatted_messages: List) -> str:
    """
    Build chat history context from either existing history or message list.
    
    Args:
        chat_history: Existing chat history string from state
        formatted_messages: List of formatted message objects
        
    Returns:
        Formatted chat history context string
    """
    if chat_history:
        return f"\n\nTidligere samtale:\n{chat_history}"
    
    # Fall back to extracting history from messages
    if len(formatted_messages) <= 1:
        return ""
    
    history_pairs = []
    i = 0
    
    # Iterate through messages up to the second-to-last one
    while i < len(formatted_messages) - 1:
        current_msg = formatted_messages[i]
        
        # Find the next Human message
        if isinstance(current_msg, HumanMessage) and hasattr(current_msg, 'content'):
            human_content = current_msg.content
            
            # Look for the next corresponding non-tool-call AI message
            j = i + 1
            ai_content = None
            found_ai_response = False
            
            while j < len(formatted_messages) - 1:
                msg_j = formatted_messages[j]
                if isinstance(msg_j, AIMessage):
                    # Check if this AIMessage has tool calls
                    has_tool_calls = (hasattr(msg_j, "tool_calls") and msg_j.tool_calls) or \
                                     (hasattr(msg_j, "additional_kwargs") and "tool_calls" in msg_j.additional_kwargs)
                    
                    # Check if it has content and no tool calls
                    if not has_tool_calls and hasattr(msg_j, 'content') and msg_j.content and msg_j.content.strip():
                        ai_content = msg_j.content
                        found_ai_response = True
                        break
                j += 1
            
            if human_content and found_ai_response:
                history_pairs.append(f"Human: {human_content}\nAssistant: {ai_content}")
                i = j + 1
            else:
                i += 1
        else:
            i += 1
    
    if history_pairs:
        return "\n\nTidligere samtale:\n" + "\n\n".join(history_pairs)
    
    return ""

def create_system_message_content(chat_history_context: str, original_query: str) -> str:
    """
    Create the system message content with chat history context.
    
    Args:
        chat_history_context: Formatted chat history context
        original_query: The original query from the user
        
    Returns:
        Complete system message content
    """
    context_info = chat_history_context if chat_history_context else original_query
    
    return f"""Du er en EKSPERT assistent for Geonorge, kalt GeoGPT, spesialisert på å finne geodata og datasett.

    Du har tilgang til følgende verktøy:

    1. retrieve_geo_information: Bruk dette verktøyet spesifikt for å søke etter datasett i GeoNorge-databasen. Søket er basert på en vektor-søk av brukerens beskrivelse av hva datasettet skal inneholde.

    Husk:
    - Hvis bruker spør om hva GeoGPT er, eller hva du tilbyr. Fortell om at du er en assistent som kan hjelpe med å finne geodata og datasett fra Geonorge. Gi eksempler på hva du kan hjelpe med, og hvordan du kan hjelpe.
    - AVSTÅ fra å svare på spørsmål som ikke er relevante for GIS, Geonorge, Geodata, datasett, eller andre GIS-relaterte emner.
    - Når brukeren ber om alternativer, relaterte emner eller bruker annen kontekstavhengig oppfølging, formuler et *nytt, spesifikt søk* for verktøyet basert på *hele samtalen*, ikke bare ved å legge til ord.
    - Bruk markdown for å formatere svarene dine.
    - Hvis brukeren refererer til tidligere samtaler, bruk denne konteksten:  
    {context_info}

    Gjør ditt beste for å gi grundige og informative svar ved hjelp av dine verktøy."""

def update_system_message(formatted_messages: List, system_content: str) -> None:
    """
    Add or update the system message in the formatted messages list.
    
    Args:
        formatted_messages: List of formatted message objects (modified in place)
        system_content: The system message content
    """
    has_system = any(isinstance(msg, SystemMessage) for msg in formatted_messages)
    
    if not has_system:
        formatted_messages.insert(0, SystemMessage(content=system_content))
    else:
        # Replace the existing system message
        for i, msg in enumerate(formatted_messages):
            if isinstance(msg, SystemMessage):
                formatted_messages[i] = SystemMessage(content=system_content)
                break

def filter_empty_messages(formatted_messages: List) -> List:
    """
    Filter out messages with empty or None content, fixing empty AI messages.
    
    Args:
        formatted_messages: List of formatted message objects
        
    Returns:
        Filtered list of messages
    """
    filtered_messages = []
    
    for msg in formatted_messages:
        if hasattr(msg, 'content') and msg.content is None:
            print(f"DEBUG agent_utils: Skipping message with None content: {type(msg)}")
            continue
            
        if hasattr(msg, 'content') and msg.content == "" and isinstance(msg, AIMessage):
            print(f"DEBUG agent_utils: Fixing empty content AI message")
            msg.content = " "  # Replace empty content with space
            
        filtered_messages.append(msg)
    
    return filtered_messages

async def handle_websocket_streaming(llm_with_tools, filtered_messages, websocket, in_merged_workflow: bool) -> AIMessage:
    """
    Handle websocket streaming for LLM responses.
    
    Args:
        llm_with_tools: The LLM instance with tools bound
        filtered_messages: List of filtered messages to send to LLM
        websocket: The websocket connection for streaming
        in_merged_workflow: Whether we're in a merged workflow (affects streaming)
        
    Returns:
        AIMessage with the LLM response
    """
    if websocket and not in_merged_workflow:
        print(f"DEBUG agent_utils: Checking LLM response for tool calls before streaming")
        
        # Stream response token by token to get the final chunk
        response_chunks = []
        full_response_content = ""
        final_chunk = None
        
        async for chunk in llm_with_tools.astream(filtered_messages):
            final_chunk = chunk
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
            print(f"DEBUG agent_utils: LLM response contains tool calls. Skipping streaming.")
            return final_chunk
        else:
            # LLM provided a final answer, stream it
            print(f"DEBUG agent_utils: LLM response is final answer. Starting stream.")
            
            # Send initial empty message to start streaming
            await send_websocket_message("chatStream", {"payload": "", "isNewMessage": True}, websocket)
            
            # Send the collected chunks
            for content_chunk in response_chunks:
                if content_chunk:  # Avoid sending empty chunks
                    print(f"DEBUG agent_utils: Streaming chunk: {content_chunk[:20]}...")
                    await send_websocket_message("chatStream", {"payload": content_chunk}, websocket)

            # Send stream complete actions ONLY when it's a final answer
            print(f"DEBUG agent_utils: Sending streamComplete and formatMarkdown for final answer.")
            await send_websocket_action("streamComplete", websocket)
            await send_websocket_action("formatMarkdown", websocket)
            
            return AIMessage(content=full_response_content)
    else:
        # If no websocket, just invoke the model normally
        print(f"DEBUG agent_utils: No websocket for streaming, using regular invoke")
        return await llm_with_tools.ainvoke(filtered_messages) 