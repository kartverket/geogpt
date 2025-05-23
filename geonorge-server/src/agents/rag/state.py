"""
State definition and helper functions for the RAG workflow.
"""
from typing import Dict, Callable, Any, List, Annotated, Sequence
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage, AIMessage
from langgraph.graph.message import add_messages
from langgraph.graph import END

def tools_condition(state: Dict) -> str:
    """
    Determines if the agent wants to use a tool or if it has a final response.
    
    Args:
        state: The current state object with messages
        
    Returns:
        String indicating if the agent wants to use a tool ("tools") or is finished (END)
    """
    from langchain_core.messages import AIMessage
    # import json # Removed redundant import
    
    # Debug current state
    print(f"DEBUG tools_condition: Checking for tool calls in state")
    messages = state.get("messages", [])
    if not messages:
        print("DEBUG tools_condition: No messages in state")
        return END
        
    # Get the last message
    last_message = messages[-1]
    print(f"DEBUG tools_condition: Last message type: {type(last_message)}")
    
    # Debug the message structure
    if hasattr(last_message, "__dict__"):
        print(f"DEBUG tools_condition: Message attributes: {last_message.__dict__.keys()}")
    
    # Check if it has tool calls - try multiple approaches
    has_tool_calls = False
    
    # Try direct tool_calls attribute
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        print(f"DEBUG tools_condition: Found tool_calls directly: {last_message.tool_calls}")
        has_tool_calls = True
    
    # Try additional_kwargs for OpenAI format
    elif hasattr(last_message, "additional_kwargs") and last_message.additional_kwargs.get("tool_calls"):
        print(f"DEBUG tools_condition: Found tool_calls in additional_kwargs: {last_message.additional_kwargs.get('tool_calls')}")
        has_tool_calls = True
    
    # For AIMessage with content containing JSON that might be a function call
    elif isinstance(last_message, AIMessage) and hasattr(last_message, "content"):
        content = last_message.content
        try:
            # See if content is parseable as JSON and contains a function_call
            if isinstance(content, str) and ('tool_call' in content.lower() or 'function_call' in content.lower()):
                print(f"DEBUG tools_condition: Content might contain a tool call: {content[:100]}...")
                has_tool_calls = True
        except:
            pass
    
    if has_tool_calls:
        print("DEBUG tools_condition: Returning 'tools'")
        return "tools"
    
    # No tool calls, so we're done
    print("DEBUG tools_condition: No tool calls found, returning END")
    return END

class AgentState(TypedDict, total=False):
    """State for the agent-based RAG workflow."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    websocket_id: str # Will be optional due to total=False if not provided
    chat_history: str
    original_query: str
    metadata_context: List[Any]
    in_merged_workflow: bool 
    rewrite_attempts: int 

# Create wrapper function that handles state conversion
def with_state_handling(node_func: Callable) -> Callable:
    """Wrap a node function with state handling logic."""
    async def wrapped(state: Any) -> Dict:
        print(f"DEBUG RAG {node_func.__name__}: state type = {type(state)}")
        
        # Handle different state input types
        if isinstance(state, dict): # Simplified: directly check for dict
            return await node_func(state)
        else:
            try:
                if hasattr(state, "to_dict"):
                    state_dict = state.to_dict()
                    return await node_func(state_dict) # Pass the converted dict
                else:
                    # If it's not a dict and doesn't have to_dict, try to use as is if it's already a compatible state
                    # This case might indicate an unexpected state type, but we'll let the node_func handle it
                    # or it might be already an AgentState (though unlikely given the typical flow)
                    print(f"DEBUG RAG {node_func.__name__}: state is not dict and has no to_dict, passing as is.")
                    return await node_func(state) # Pass the original state
            except Exception as e:
                print(f"DEBUG: Error converting state in {node_func.__name__}: {e}")
                # Fallback state
                fallback_state = {
                    "messages": [{"role": "human", "content": "Hjelp meg med geografiske data"}],
                    "websocket_id": getattr(state, "websocket_id", ""),
                    "chat_history": ""
                }
                return await node_func(fallback_state)
    
    wrapped.__name__ = node_func.__name__
    wrapped.__doc__ = node_func.__doc__
    
    return wrapped 