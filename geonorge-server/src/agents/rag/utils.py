from typing import Callable, Any, Dict

# Assuming standardize_state is accessible or imported appropriately
# If standardize_state comes from ..utils.message_utils as in rag_workflow.py,
# the import in this new utils.py (geonorge-server/src/agents/rag/utils.py)
# would be: from ..utils.message_utils import standardize_state

from ..utils.message_utils import standardize_state # Corrected import path

def with_state_handling(node_func: Callable) -> Callable:
    """Wrap a node function with state handling logic."""
    async def wrapped(state: Any) -> Dict:
        print(f"DEBUG RAG {node_func.__name__}: state type = {type(state)}")
        
        # Use standardized state conversion
        state_dict = standardize_state(state)
        
        # If no messages in state, apply fallback
        if "messages" not in state_dict or not state_dict["messages"]:
            print(f"DEBUG: No messages in state for {node_func.__name__}, adding fallback message")
            state_dict["messages"] = [{"role": "human", "content": "Hjelp meg med geografiske data"}]
        
        # Call the node function with standardized state
        return await node_func(state_dict)
    
    wrapped.__name__ = node_func.__name__
    wrapped.__doc__ = node_func.__doc__
    
    return wrapped 