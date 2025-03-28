import json
from typing import Any, Dict


async def send_websocket_message(action, payload, websocket) -> None:
    """Send a WebSocket message with the specified action and payload"""
    message = {
        'action': action,
        'payload': payload
    }
    if websocket is None:
        print(f"Warning: Attempted to send message with action '{action}' to None websocket")
        return
    
    try:
        message_str = json.dumps(message)
        print(f"DEBUG WEBSOCKET SEND: Action='{action}', Type={type(action)}, JSON={message_str[:100]}")
        
        await websocket.send(message_str)
        print(f"DEBUG WEBSOCKET SENT SUCCESS: Action='{action}'")
    except Exception as e:
        print(f"ERROR: Failed to send websocket message with action {action}: {e}")
        import traceback
        traceback.print_exc()

async def send_websocket_action(action, websocket):
    """Send a WebSocket message with just an action (no payload)"""
    if websocket is None:
        print(f"Warning: Attempted to send action '{action}' to None websocket")
        return
        
    try:
        message = {'action': action}
        message_str = json.dumps(message)
        print(f"DEBUG WEBSOCKET SEND ACTION: Action='{action}', Type={type(action)}, JSON={message_str}")
        
        await websocket.send(message_str)
        print(f"DEBUG WEBSOCKET SENT ACTION SUCCESS: Action='{action}'")
    except Exception as e:
        print(f"ERROR: Failed to send websocket action {action}: {e}")
        import traceback
        traceback.print_exc()