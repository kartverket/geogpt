"""
Tool execution node for the RAG workflow.
"""
from typing import Dict
from langchain_core.messages import ToolMessage
from ..state import AgentState
import json

async def handle_tool_calls(state: AgentState, retrieval_tool, dataset_info_tool) -> Dict:
    """Execute the tools called by the agent."""
    
    print("DEBUG handle_tool_calls: Starting tool execution")
    
    messages = state.get("messages", [])
    original_query = state.get("original_query", "")
    
    print(f"DEBUG handle_tool_calls: Original query: {original_query}")
    
    if not messages:
        print("DEBUG handle_tool_calls: No messages in state")
        return state
        
    # Get the last message
    last_message = messages[-1]
    print(f"DEBUG handle_tool_calls: Last message type: {type(last_message)}")
    
    print("DEBUG handle_tool_calls: Using direct tool execution")
    
    # Extract tool calls from the message
    tool_calls = []
    
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        tool_calls = last_message.tool_calls
    elif hasattr(last_message, "additional_kwargs") and "tool_calls" in last_message.additional_kwargs:
        tool_calls = last_message.additional_kwargs["tool_calls"]
    
    if not tool_calls:
        print("DEBUG handle_tool_calls: No tool calls found")
        return state
        
    print(f"DEBUG handle_tool_calls: Found {len(tool_calls)} tool calls")
    
    # Create a dict of available tools
    tools = [retrieval_tool, dataset_info_tool]
    tool_dict = {tool.name: tool for tool in tools}
    
    # Execute each tool
    tool_results = []
    # Initialize metadata_context to store vector DB results for image insertion
    metadata_context = []
    
    for tool_call in tool_calls:
        try:
            # Extract tool call info
            tool_name = None
            tool_args = None
            tool_id = ""
            
            # Handle different tool call formats
            if isinstance(tool_call, dict):
                if "name" in tool_call:
                    tool_name = tool_call["name"]
                    tool_args = tool_call.get("args", {})
                    tool_id = tool_call.get("id", "")
                elif "function" in tool_call:
                    tool_name = tool_call["function"].get("name", "")
                    try:
                        tool_args = json.loads(tool_call["function"].get("arguments", "{}"))
                    except:
                        tool_args = {}
                    tool_id = tool_call.get("id", "")
            else:
                if hasattr(tool_call, "name"):
                    tool_name = tool_call.name
                    tool_args = getattr(tool_call, "args", {})
                    tool_id = getattr(tool_call, "id", "")
                    
            if not tool_name:
                print("DEBUG handle_tool_calls: Could not extract tool name, skipping")
                continue
            
            print(f"DEBUG handle_tool_calls: Executing {tool_name} with args: {tool_args}")
            
            # Get the tool and execute it
            if tool_name in tool_dict:
                tool = tool_dict[tool_name]
                
                # Execute the tool based on the tool type
                if tool_name == "retrieve_geo_information":
                    # Extract query param
                    query = None
                    if isinstance(tool_args, dict):
                        query = tool_args.get("query")
                    elif isinstance(tool_args, str):
                        query = tool_args
                        
                    if not query:
                        print("DEBUG handle_tool_calls: No query parameter found")
                        raise ValueError("Missing query parameter")
                    
                    # Use the query from arguments for metadata retrieval, fallback to original_query from state if needed
                    metadata_query = query if query else original_query
                    print(f"DEBUG handle_tool_calls: Using metadata query: {metadata_query}")
                    
                    # Call the tool with the query
                    result = tool.func(query)
                    
                    # Get vector DB response for metadata context (for image insertion)
                    try:
                        import asyncio
                        vdb_response = []
                        # Get vector DB results for image metadata
                        async def _get_metadata():
                            from helpers.vector_database import get_vdb_response
                            return await get_vdb_response(metadata_query)
                            
                        loop = asyncio.get_event_loop()
                        vdb_response = loop.run_until_complete(_get_metadata())
                        if vdb_response:
                            print(f"DEBUG handle_tool_calls: Found {len(vdb_response)} metadata items for image insertion")
                            metadata_context.extend(vdb_response)
                    except Exception as e:
                        print(f"ERROR in handle_tool_calls getting metadata: {e}")
                    
                    # Create a tool message with the result and original query
                    tool_results.append(ToolMessage(
                        content=str(result),
                        name=tool_name,
                        tool_call_id=tool_id,
                        additional_kwargs={
                            "original_query": query,
                            "metadata_query": metadata_query
                        }
                    ))
                    
                elif tool_name == "search_dataset":
                    # Extract dataset_query param
                    dataset_query = None
                    if isinstance(tool_args, dict):
                        dataset_query = tool_args.get("dataset_query")
                    elif isinstance(tool_args, str):
                        dataset_query = tool_args
                        
                    if not dataset_query:
                        print("DEBUG handle_tool_calls: No dataset_query parameter found")
                        raise ValueError("Missing dataset_query parameter")
                    
                    # Use the dataset_query from arguments for metadata retrieval, fallback to original_query from state if needed
                    metadata_query = dataset_query if dataset_query else original_query
                    print(f"DEBUG handle_tool_calls: Using metadata query: {metadata_query}")
                    
                    # Call the tool with the dataset_query
                    result = tool.func(dataset_query)
                    
                    # Get vector DB response for metadata context (for image insertion)
                    try:
                        import asyncio
                        # Get vector DB results for image metadata
                        async def _get_metadata():
                            from helpers.vector_database import get_vdb_response
                            return await get_vdb_response(metadata_query)
                            
                        loop = asyncio.get_event_loop()
                        vdb_response = loop.run_until_complete(_get_metadata())
                        if vdb_response:
                            print(f"DEBUG handle_tool_calls: Found {len(vdb_response)} metadata items for image insertion")
                            metadata_context.extend(vdb_response)
                    except Exception as e:
                        print(f"ERROR in handle_tool_calls getting metadata: {e}")
                    
                    # Create a tool message with the result and original query
                    tool_results.append(ToolMessage(
                        content=str(result),
                        name=tool_name,
                        tool_call_id=tool_id,
                        additional_kwargs={
                            "original_query": dataset_query,
                            "metadata_query": metadata_query
                        }
                    ))
                else:
                    raise ValueError(f"Unknown tool: {tool_name}")
            else:
                print(f"ERROR: Tool {tool_name} not found")
        except Exception as tool_error:
            print(f"ERROR executing tool {tool_name}: {tool_error}")
            import traceback
            traceback.print_exc()
            tool_results.append(ToolMessage(
                content=f"Error executing tool {tool_name}: {str(tool_error)}",
                name=tool_name if tool_name else "unknown_tool",
                tool_call_id=tool_id
            ))
    
    # Add tool results to messages
    new_messages = list(messages)
    new_messages.extend(tool_results)
    
    # Preserve existing state fields and update messages
    print(f"DEBUG handle_tool_calls: Returning metadata_context with {len(metadata_context)} items before state update.")
    # Return only the modified fields for LangGraph to merge
    return {
        "messages": tool_results, # Return only the ToolMessages added
        "metadata_context": metadata_context,
        "rewrite_attempts": state.get("rewrite_attempts", 0) # Pass through rewrite_attempts
    } 