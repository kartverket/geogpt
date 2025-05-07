"""
State definition and handling for the map agent workflow.
"""
from typing import Dict, List, Optional, Tuple, TypedDict, Sequence
from langchain_core.messages import BaseMessage
from ..utils.message_utils import standardize_state


# Define a state class for map interactions
class MapState(TypedDict, total=False):
    """
    Manages the state of a map interaction session.
    """
    messages: Sequence[BaseMessage]
    chat_history: str
    map_center: Tuple[float, float]
    zoom_level: int
    markers: List[Dict]
    websocket_id: Optional[str]
    action_taken: Optional[List[str]]
    add_marker_at_location: bool
    add_marker_at_address: Optional[bool]
    in_merged_workflow: bool
    found_address_text: Optional[str]
    node_execution_error: Optional[str] # Add for error handling within wrapper

def with_map_state_handling(node_func):
    """Wrap a map node function with state standardization and default value logic."""
    async def wrapped(state):
        print(f"DEBUG Map {node_func.__name__}: state type = {type(state)}")

        # Standardize incoming state to a dictionary (if not already)
        current_state = {}
        if not isinstance(state, dict):
            # Convert based on expected attributes or raise error
            for k in MapState.__annotations__.keys():
                if hasattr(state, k):
                    current_state[k] = getattr(state, k)
            # Handle potential special keys like NEXT if necessary
            if hasattr(state, "NEXT"): current_state["NEXT"] = state.NEXT
        else:
            current_state = state.copy() # Work with a copy

        ws_id = current_state.get("websocket_id")
        in_merged = current_state.get("in_merged_workflow", False)
        print(f"DEBUG Map {node_func.__name__}: ws_id={ws_id}, in_merged={in_merged}")

        # Ensure state has default values ONLY if they don't exist
        if "map_center" not in current_state:
            current_state["map_center"] = (59.9139, 10.7522)
        if "zoom_level" not in current_state:
            current_state["zoom_level"] = 14
        if "markers" not in current_state:
            current_state["markers"] = []
        if "action_taken" not in current_state:
            current_state["action_taken"] = []
        # Ensure add_marker_at_location exists for tool checks
        if "add_marker_at_location" not in current_state:
            current_state["add_marker_at_location"] = False # Default to False
        # Ensure add_marker_at_address exists for tool checks
        if "add_marker_at_address" not in current_state:
            current_state["add_marker_at_address"] = None # Default to None
        # Ensure found_address_text exists
        if "found_address_text" not in current_state:
            current_state["found_address_text"] = None # Default to None

        # Set/Ensure in_merged_workflow flag is present if needed downstream
        # Overwrite if present in input, otherwise default to False
        current_state["in_merged_workflow"] = current_state.get("in_merged_workflow", False)

        # Process the state with the node function
        # The state passed here is managed by LangGraph's checkpointer between steps
        result_state = current_state # Default to current state if node func fails
        try:
            result_state = await node_func(current_state)
        except Exception as e:
            print(f"ERROR: Exception caught within wrapped node '{node_func.__name__}': {e}")
            import traceback
            traceback.print_exc()
            # Keep the current state as the result to allow the graph to continue if possible
            # Ensure result_state is a dictionary
            result_state = standardize_state(current_state)
            # Optionally add an error marker to the state
            result_state['node_execution_error'] = f"Error in {node_func.__name__}: {e}"

        # No need to update any persistent store here.
        # LangGraph handles passing state to the next node via the checkpointer.

        # Ensure the return value is always a dictionary
        return standardize_state(result_state)

    # Preserve original function name and docstring
    wrapped.__name__ = node_func.__name__
    wrapped.__doc__ = node_func.__doc__
    return wrapped 