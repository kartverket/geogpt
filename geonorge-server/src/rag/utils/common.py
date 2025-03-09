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
    active_websockets = websockets_dict

def format_history(messages: list) -> str:
    """
    Format the message history into a string for LLM context.
    
    Args:
        messages: List of message dictionaries with 'role' and 'content' keys
        
    Returns:
        Formatted conversation history as a string
    """
    return "\n".join(f'{m["role"]}: {m["content"]}' for m in messages) 