# websocket_utils.py
import json
from typing import Any

async def send_websocket_message(action: str, payload: Any, websocket):
    """
    Send a JSON with structure { action: <str>, payload: <anything> }.
    """
    message = {
        "action": action,
        "payload": payload,
    }
    await websocket.send(json.dumps(message))

async def send_websocket_action(action: str, websocket):
    """
    Send a JSON with { action: <str> } only.
    """
    message = {
        "action": action,
    }
    await websocket.send(json.dumps(message))