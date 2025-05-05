"""
Common utility functions used across the RAG workflow.
"""

# Global state for websockets
active_websockets = {}

def register_websockets_dict(websockets_dict):
    """
    Register websockets dictionary from the chain class.
    
    Args:
        websockets_dict: The active websockets dictionary from the chain
    """
    global active_websockets
    
    # Important: Copy each websocket from the input dict to our global dict
    # instead of just reassigning the reference
    for key, value in websockets_dict.items():
        active_websockets[key] = value
        
    print(f"DEBUG: Registered {len(websockets_dict)} websocket(s)")
    print(f"DEBUG: After registration, active_websockets has {len(active_websockets)} websocket(s)")
    if active_websockets:
        print(f"DEBUG: Active websocket IDs: {list(active_websockets.keys())}")

def get_websocket(websocket_id):
    """
    Get a websocket by ID with debug logging.
    
    Args:
        websocket_id: The ID of the websocket
        
    Returns:
        The websocket object or None
    """
    global active_websockets
    websocket = active_websockets.get(websocket_id)
    print(f"DEBUG: Getting websocket with ID {websocket_id}, found: {websocket is not None}")
    print(f"DEBUG: Current active websockets: {list(active_websockets.keys())}")
    return websocket

def format_history(messages):
    """
    Format message history for use in prompts.
    
    Args:
        messages: List of chat messages
        
    Returns:
        Formatted history string
    """
    history = []
    for msg in messages:
        # Handle both dictionary messages and Message objects
        if hasattr(msg, 'type') and hasattr(msg, 'content'):
            # This is a Message object (e.g., HumanMessage, AIMessage)
            role = msg.type.lower() if hasattr(msg, 'type') else "unknown"
            content = msg.content if msg.content is not None else ""
        elif isinstance(msg, dict):
            # This is a dictionary message
            role = msg.get("role", "").lower()
            content = msg.get("content", "")
        else:
            # Unknown message type, try to handle gracefully
            role = "unknown"
            content = str(msg) if msg is not None else ""
            
        # Format based on role
        if role == "human" or role == "user":
            history.append(f"User: {content}")
        elif role == "ai" or role == "assistant":
            history.append(f"Assistant: {content}")
        else:
            history.append(f"{role.capitalize()}: {content}")
            
    return "\n".join(history) 