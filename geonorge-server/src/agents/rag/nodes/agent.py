"""
Agent node for the RAG workflow.
"""
from typing import Dict
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from helpers.websocket import send_websocket_message, send_websocket_action
from ..state import AgentState
from ...utils.common import active_websockets
from ...utils.message_utils import convert_dict_to_message_objects
from ...utils.agent_utils import (
    extract_original_query,
    build_chat_history_context,
    create_system_message_content,
    update_system_message,
    filter_empty_messages,
    handle_websocket_streaming
)

async def agent_node(state: AgentState, retrieval_tool, dataset_info_tool) -> Dict:
    """
    Custom agent implementation that decides what action to take based on the query.
    
    This replaces the traditional React agent with a custom implementation.
    """
    from llm import LLMManager

    print("DEBUG agent_node: Starting agent processing")
    
    # Get messages and chat history from state
    messages = state.get("messages", [])
    chat_history = state.get("chat_history", "")
    websocket_id = state.get("websocket_id", "")
    original_query = state.get("original_query", "")
    
    # Get the websocket from active_websockets if available
    websocket = None
    if websocket_id:
        print(f"DEBUG agent_node: Looking for websocket with ID {websocket_id}")
        websocket = active_websockets.get(websocket_id)
        if websocket:
            print(f"DEBUG agent_node: Found websocket for ID {websocket_id}")
        else:
            print(f"DEBUG agent_node: No websocket found for ID {websocket_id}")
    
    # Suppress streaming in merged workflows
    in_merged_workflow = state.get("in_merged_workflow", False)
    if in_merged_workflow:
        print("DEBUG agent_node: In merged workflow, disabling websocket streaming")
        websocket = None
    
    if not messages:
        print("DEBUG agent_node: No messages in state")
        return state
    
    # Convert dict messages to proper Message objects
    formatted_messages = convert_dict_to_message_objects(messages)
    
    # Extract original query if not already stored
    if not original_query:
        original_query = extract_original_query(formatted_messages)
        if original_query:
            print(f"DEBUG agent_node: Storing original query: {original_query}")
    
    # Build chat history context
    chat_history_context = build_chat_history_context(chat_history, formatted_messages)
    
    # Create and update system message
    system_content = create_system_message_content(chat_history_context, original_query)
    update_system_message(formatted_messages, system_content)
    
    # Filter out messages with empty or None content
    filtered_messages = filter_empty_messages(formatted_messages)
    
    # Get the LLM and bind tools
    llm_manager = LLMManager()
    llm = llm_manager.get_main_llm()
    
    # Create the tools
    tools = [retrieval_tool, dataset_info_tool]
    llm_with_tools = llm.bind_tools(tools)
    
    # Print debugging info
    print(f"DEBUG agent_node: Using {len(tools)} tools")
    for i, tool in enumerate(tools):
        print(f"DEBUG agent_node: Tool {i} - {tool.name}: {tool.description}")
        
    # Call the model with the formatted messages
    try:
        print(f"DEBUG agent_node: Invoking LLM with {len(filtered_messages)} messages")
        
        # Handle websocket streaming or regular invocation
        response = await handle_websocket_streaming(
            llm_with_tools, 
            filtered_messages, 
            websocket, 
            in_merged_workflow
        )
        
        print(f"DEBUG agent_node: Got response type: {type(response)}")
        
        # Check for tool calls
        if hasattr(response, "tool_calls") and response.tool_calls:
            print(f"DEBUG agent_node: Found {len(response.tool_calls)} tool calls")
        elif hasattr(response, "additional_kwargs") and "tool_calls" in response.additional_kwargs:
            print(f"DEBUG agent_node: Found {len(response.additional_kwargs['tool_calls'])} tool calls in additional_kwargs")
            
        # Return updated state with the agent's response and original query
        return {
            "messages": messages + [response], 
            "chat_history": state.get("chat_history", ""), 
            "websocket_id": websocket_id,
            "original_query": original_query,
            "rewrite_attempts": state.get("rewrite_attempts", 0)
        }
        
    except Exception as e:
        print(f"ERROR in agent_node: {e}")
        import traceback
        traceback.print_exc()
        
        # Return a fallback message
        return {
            "messages": messages + [AIMessage(content="Beklager, jeg kunne ikke prosessere spørsmålet ditt. Kan du prøve på nytt?")], 
            "chat_history": state.get("chat_history", ""), 
            "websocket_id": websocket_id,
            "original_query": original_query,
            "rewrite_attempts": state.get("rewrite_attempts", 0)
        } 