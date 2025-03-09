"""
Invalid query handler node for the RAG workflow.
"""
from typing import Dict
from helpers.websocket import send_websocket_message
from ..models import ConversationState
from ..utils.common import active_websockets, format_history


async def handle_invalid_query(state: Dict) -> Dict:
    """
    Handle non-geographic queries.
    
    This node responds to queries that are not related to geographic data,
    explaining the limitations of the system and requesting the user to
    reformulate their question.
    
    Args:
        state: Current conversation state
        
    Returns:
        Updated conversation state
    """
    current_state = ConversationState(**state)
    websocket_id = current_state.websocket_id
    print(f"Handle invalid query for websocket_id: {websocket_id}")
    
    # Get the websocket from the shared dictionary
    websocket = active_websockets.get(websocket_id)
    print(f"Retrieved websocket from active_websockets: {websocket is not None}")
    
    response = "Beklager, jeg kan bare svare på spørsmål om geografiske data, kart og Geonorge tjenester. Kan du omformulere spørsmålet ditt til å handle om dette?"
    await send_websocket_message("chatStream", {"payload": response, "isNewMessage": True}, websocket)
    
    current_state.messages.append({"role": "assistant", "content": response})
    current_state.chat_history = format_history(current_state.messages)
    return current_state.to_dict() 