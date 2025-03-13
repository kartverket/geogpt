import json

async def send_websocket_message(action, payload, websocket):
    """Send a WebSocket message with the specified action and payload"""
    message = {
        'action': action,
        'payload': payload
    }
    await websocket.send(json.dumps(message))

async def send_websocket_action(action, websocket):
    """Send a WebSocket action without payload"""
    message = {
        'action': action,
        'payload': None
    }
    await websocket.send(json.dumps(message))