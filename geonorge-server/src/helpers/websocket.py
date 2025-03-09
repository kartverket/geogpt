import json
from typing import Any, Dict


async def send_websocket_message(action, payload, websocket) -> None:
    """Send a WebSocket message with the specified action and payload"""
    message = {
        'action': action,
        'payload': payload
    }
    if websocket is None:
        print("Warning: Attempted to send message to None websocket")
        return
    
    try:
        await websocket.send(json.dumps(message))
    except Exception as e:
        print(f"Error sending websocket message: {e}")

async def send_websocket_action(action, websocket):
    """Send a WebSocket message with just an action (no payload)"""
    if websocket is None:
        print("Warning: Attempted to send action to None websocket")
        return
        
    try:
        message = {'action': action}
        await websocket.send(json.dumps(message))
    except Exception as e:
        print(f"Error sending websocket action: {e}")