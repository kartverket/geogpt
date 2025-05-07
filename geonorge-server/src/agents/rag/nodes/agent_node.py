import json
from typing import Dict, List # Added List

from llm import LLMManager 
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from helpers.websocket import send_websocket_message, send_websocket_action

# Relative imports based on the new location geonorge-server/src/agents/rag/nodes/agent_node.py
from ...utils.common import active_websockets 
from ...utils.message_utils import standardize_message, standardize_state, get_last_message_by_role 
from ..state import AgentState 

async def agent_node_logic(state: AgentState, llm_with_tools_bound, tools_list: List) -> Dict:
    """
    Custom agent logic node.
    Receives the state, a pre-bound LLM with tools, and the list of tools.
    """
    print("DEBUG agent_node_logic: Starting agent processing")
    
    # Standardize state (original state is AgentState TypedDict, convert to plain dict for manipulation)
    # standardize_state expects a dict or AgentState, and returns a dict.
    state_dict = standardize_state(state) 
    
    messages = state_dict.get("messages", [])
    chat_history = state_dict.get("chat_history", "")
    websocket_id = state_dict.get("websocket_id", "")
    original_query = state_dict.get("original_query", "")
    
    websocket = active_websockets.get(websocket_id) if websocket_id else None
    if websocket:
        print(f"DEBUG agent_node_logic: Found websocket for ID {websocket_id}")
    else:
        print(f"DEBUG agent_node_logic: No websocket found for ID {websocket_id}")
    
    if not messages:
        print("DEBUG agent_node_logic: No messages in state")
        # Return a dict that matches AgentState structure for message update
        return {"messages": [], "chat_history": chat_history, "websocket_id": websocket_id, "original_query": original_query}

    formatted_messages = []
    for msg in messages:
        std_msg = standardize_message(msg) # standardize_message returns a dict
        if std_msg["role"] == "system":
            formatted_messages.append(SystemMessage(content=std_msg["content"]))
        elif std_msg["role"] == "human":
            formatted_messages.append(HumanMessage(content=std_msg["content"]))
        elif std_msg["role"] == "assistant":
            if "additional_kwargs" in std_msg and "tool_calls" in std_msg["additional_kwargs"]:
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
                
    if not original_query:
        human_message_content = get_last_message_by_role(messages, "human") # messages is List[BaseMessage] or List[Dict]
        if human_message_content:
            original_query = human_message_content
            print(f"DEBUG agent_node_logic: Storing original query: {original_query}")
    
    chat_history_context = ""
    if chat_history:
        chat_history_context = f"\n\nTidligere samtale:\n{chat_history}"
    else:
        if len(formatted_messages) > 1:
            history_pairs = []
            i = 0
            while i < len(formatted_messages) - 1:
                current_msg = formatted_messages[i]
                if isinstance(current_msg, HumanMessage) and hasattr(current_msg, 'content'):
                    human_content = current_msg.content
                    j = i + 1
                    ai_content = None
                    found_ai_response = False
                    while j < len(formatted_messages) - 1:
                        msg_j = formatted_messages[j]
                        if isinstance(msg_j, AIMessage):
                            has_tool_calls = (hasattr(msg_j, "tool_calls") and msg_j.tool_calls) or \
                                             (hasattr(msg_j, "additional_kwargs") and "tool_calls" in msg_j.additional_kwargs)
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
        for i, msg in enumerate(formatted_messages):
            if isinstance(msg, SystemMessage):
                formatted_messages[i] = SystemMessage(content=system_content)
                break
    
    filtered_messages = []
    for msg in formatted_messages:
        if hasattr(msg, 'content') and msg.content is None:
            print(f"DEBUG agent_node_logic: Skipping message with None content: {type(msg)}")
            continue
        if hasattr(msg, 'content') and msg.content == "" and isinstance(msg, AIMessage):
            print(f"DEBUG agent_node_logic: Fixing empty content AI message")
            msg.content = " "
        filtered_messages.append(msg)
    
    print(f"DEBUG agent_node_logic: Using {len(tools_list)} tools") # Use passed tools_list
    for i, tool in enumerate(tools_list):
        print(f"DEBUG agent_node_logic: Tool {i} - {tool.name}: {tool.description}")
        
    try:
        print(f"DEBUG agent_node_logic: Invoking LLM with {len(filtered_messages)} messages")
        if websocket:
            print(f"DEBUG agent_node_logic: Checking LLM response for tool calls before streaming")
            response_chunks = []
            full_response_content = ""
            final_chunk = None
            async for chunk in llm_with_tools_bound.astream(filtered_messages):
                final_chunk = chunk
                if hasattr(chunk, 'content'):
                    response_chunks.append(chunk.content)
                    full_response_content += chunk.content

            if not final_chunk:
                    raise ValueError("Streaming finished without receiving any chunks.")

            has_tool_calls = (hasattr(final_chunk, "tool_calls") and final_chunk.tool_calls) or \
                                (hasattr(final_chunk, "additional_kwargs") and "tool_calls" in final_chunk.additional_kwargs)

            if has_tool_calls:
                response = final_chunk 
                print(f"DEBUG agent_node_logic: LLM response contains tool calls. Skipping streaming.")
            else:
                print(f"DEBUG agent_node_logic: LLM response is final answer. Starting stream.")
                response = AIMessage(content=full_response_content)
                await send_websocket_message("chatStream", {"payload": "", "isNewMessage": True}, websocket)
                for content_chunk in response_chunks:
                        if content_chunk:
                            print(f"DEBUG agent_node_logic: Streaming chunk: {content_chunk[:20]}...")
                            await send_websocket_message("chatStream", {"payload": content_chunk}, websocket)
                print(f"DEBUG agent_node_logic: Sending streamComplete and formatMarkdown for final answer.")
                await send_websocket_action("streamComplete", websocket)
                await send_websocket_action("formatMarkdown", websocket)
                print(f"DEBUG agent_node_logic: LLM response is final answer. Content: {full_response_content[:50]}...")
        else:
            print(f"DEBUG agent_node_logic: No websocket for streaming, using regular invoke")
            response = await llm_with_tools_bound.ainvoke(filtered_messages)
        
        print(f"DEBUG agent_node_logic: Got response type: {type(response)}")
        if hasattr(response, "tool_calls") and response.tool_calls:
            print(f"DEBUG agent_node_logic: Found {len(response.tool_calls)} tool calls")
        elif hasattr(response, "additional_kwargs") and "tool_calls" in response.additional_kwargs:
            print(f"DEBUG agent_node_logic: Found {len(response.additional_kwargs['tool_calls'])} tool calls in additional_kwargs")
            
        return {
            "messages": messages + [response],
            "chat_history": chat_history, # Pass through existing chat_history
            "websocket_id": websocket_id,
            "original_query": original_query
        }
    except Exception as e:
        print(f"ERROR in agent_node_logic: {e}")
        import traceback
        traceback.print_exc()
        return {
            "messages": messages + [AIMessage(content="Beklager, jeg kunne ikke prosessere spørsmålet ditt. Kan du prøve på nytt?")],
            "chat_history": chat_history,
            "websocket_id": websocket_id,
            "original_query": original_query
        } 