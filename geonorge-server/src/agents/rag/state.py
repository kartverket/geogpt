from typing import Dict, List, Literal, Annotated, Sequence
from typing_extensions import TypedDict
from langgraph.graph import END
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, AIMessage

# Original content from rag_workflow.py
def tools_condition(state: Dict) -> Literal["tools", END]:
    """
    Determines if the agent wants to use a tool or if it has a final response.
    Checks the last message directly for tool calls before standardization.
    """
    print(f"DEBUG tools_condition: Checking for tool calls in state")

    # Get messages list from state
    messages = state.get("messages", [])
    if not messages:
        print("DEBUG tools_condition: No messages in state, returning END")
        return END

    # --- Check the actual last message object ---
    last_message_obj = messages[-1]
    has_tool_calls = False

    if isinstance(last_message_obj, AIMessage):
        # LangChain AIMessage object
        if last_message_obj.tool_calls and len(last_message_obj.tool_calls) > 0:
            print(f"DEBUG tools_condition: Found tool_calls in AIMessage object: {last_message_obj.tool_calls}")
            has_tool_calls = True
        elif last_message_obj.additional_kwargs and "tool_calls" in last_message_obj.additional_kwargs and last_message_obj.additional_kwargs["tool_calls"]:
             print(f"DEBUG tools_condition: Found tool_calls in AIMessage additional_kwargs: {last_message_obj.additional_kwargs['tool_calls']}")
             has_tool_calls = True
    elif isinstance(last_message_obj, dict):
        # Dictionary representation
        if last_message_obj.get("role") == "assistant":
             if "tool_calls" in last_message_obj and last_message_obj["tool_calls"]:
                 print(f"DEBUG tools_condition: Found tool_calls key in dict: {last_message_obj['tool_calls']}")
                 has_tool_calls = True
             elif "additional_kwargs" in last_message_obj and "tool_calls" in last_message_obj["additional_kwargs"] and last_message_obj["additional_kwargs"]["tool_calls"]:
                 print(f"DEBUG tools_condition: Found tool_calls in dict additional_kwargs: {last_message_obj['additional_kwargs']['tool_calls']}")
                 has_tool_calls = True

    # --- End direct check ---

    if has_tool_calls:
        print("DEBUG tools_condition: Returning 'tools'")
        return "tools"
    else:
        # Optional: Log why no tool calls were detected
        if isinstance(last_message_obj, AIMessage):
            print(f"DEBUG tools_condition: No tool_calls found in AIMessage (tool_calls={getattr(last_message_obj, 'tool_calls', None)}, kwargs={getattr(last_message_obj, 'additional_kwargs', {}).get('tool_calls')})")
        elif isinstance(last_message_obj, dict):
            print(f"DEBUG tools_condition: No tool_calls found in dict (tool_calls key: {'tool_calls' in last_message_obj}, kwargs key: {'additional_kwargs' in last_message_obj and 'tool_calls' in last_message_obj['additional_kwargs']})")
        else:
            print(f"DEBUG tools_condition: Last message is neither AIMessage nor dict ({type(last_message_obj)}), cannot check for tool calls.")

        print("DEBUG tools_condition: No tool calls detected, returning END")
        return END

class AgentState(TypedDict):
    """State for the agent-based RAG workflow."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    websocket_id: str
    intent: str
    retrieval_results: List[Dict]
    documents_relevant: bool
    dataset_info: Dict 