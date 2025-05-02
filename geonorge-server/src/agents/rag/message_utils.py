"""
Utility functions for standardizing message and state handling across workflows.
"""
from typing import Dict, List, Optional, Any, Union
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
import uuid

# Helper function to ensure message dictionaries have required fields for conversion
def fix_message_dict_for_conversion(message: Dict) -> Dict:
    """
    Fix message dictionaries to ensure they have all required fields
    for proper conversion to LangChain message objects.
    
    Args:
        message: A dictionary representing a message
        
    Returns:
        A fixed dictionary with necessary fields for conversion
    """
    # Make a copy to avoid modifying the original
    fixed_msg = dict(message)
    
    # Fix tool messages to ensure they have tool_call_id
    if fixed_msg.get("role") == "tool" and "tool_call_id" not in fixed_msg:
        # Generate a random ID for the tool call
        fixed_msg["tool_call_id"] = f"auto_generated_{str(uuid.uuid4())[:8]}"
        print(f"DEBUG: Added missing tool_call_id: {fixed_msg['tool_call_id']} to tool message")
    
    # Ensure content exists
    if "content" not in fixed_msg or fixed_msg["content"] is None:
        fixed_msg["content"] = ""
        print(f"DEBUG: Added missing content field for {fixed_msg.get('role', 'unknown')} message")
    
    return fixed_msg

# New utility function to standardize message handling
def standardize_message(message: Union[Dict, BaseMessage]) -> Dict:
    """
    Convert any message type to a standard dictionary format.
    
    Args:
        message: Either a dictionary or a LangChain message object
        
    Returns:
        A standardized message dictionary with role and content
    """
    # If it's already a dictionary, ensure it has the right format
    if isinstance(message, dict):
        return fix_message_dict_for_conversion(message)
        
    # If it's a LangChain message object
    try:
        if isinstance(message, BaseMessage):
            # Create a dictionary based on message type
            if isinstance(message, HumanMessage):
                msg_dict = {"role": "human", "content": message.content}
            elif isinstance(message, AIMessage):
                msg_dict = {"role": "assistant", "content": message.content}
                # Add tool calls if present
                if hasattr(message, "additional_kwargs") and "tool_calls" in message.additional_kwargs:
                    msg_dict["additional_kwargs"] = {"tool_calls": message.additional_kwargs["tool_calls"]}
            elif isinstance(message, SystemMessage):
                msg_dict = {"role": "system", "content": message.content}
            elif isinstance(message, ToolMessage):
                msg_dict = {
                    "role": "tool", 
                    "content": message.content,
                    "tool_call_id": getattr(message, "tool_call_id", f"auto_generated_{str(uuid.uuid4())[:8]}")
                }
            else:
                # Generic handling for other message types
                msg_dict = {"role": "unknown", "content": str(message.content)}
                
            # Copy any additional kwargs
            if hasattr(message, "additional_kwargs"):
                if "additional_kwargs" not in msg_dict:
                    msg_dict["additional_kwargs"] = {}
                for k, v in message.additional_kwargs.items():
                    msg_dict["additional_kwargs"][k] = v
                    
            return msg_dict
        
        # Alternative access via attributes for non-standard objects
        if hasattr(message, "type"):
            role = "assistant" if message.type == "ai" else "human" if message.type == "human" else "system" if message.type == "system" else "tool"
            msg_dict = {"role": role, "content": message.content if hasattr(message, "content") else ""}
            
            # Handle tool messages specially
            if role == "tool" and hasattr(message, "tool_call_id"):
                msg_dict["tool_call_id"] = message.tool_call_id
            elif role == "tool":
                msg_dict["tool_call_id"] = f"auto_generated_{str(uuid.uuid4())[:8]}"
                
            # Copy additional kwargs if present
            if hasattr(message, "additional_kwargs"):
                msg_dict["additional_kwargs"] = message.additional_kwargs
                
            return msg_dict
        
        # Direct role access
        if hasattr(message, "role"):
            msg_dict = {"role": message.role, "content": message.content if hasattr(message, "content") else ""}
            
            # Handle tool messages
            if message.role == "tool" and hasattr(message, "tool_call_id"):
                msg_dict["tool_call_id"] = message.tool_call_id
            elif message.role == "tool":
                msg_dict["tool_call_id"] = f"auto_generated_{str(uuid.uuid4())[:8]}"
                
            # Copy additional kwargs if present
            if hasattr(message, "additional_kwargs"):
                msg_dict["additional_kwargs"] = message.additional_kwargs
                
            return msg_dict
    except Exception as e:
        print(f"DEBUG: Error standardizing message: {e}")
    
    # Fallback for unknown types
    return {"role": "unknown", "content": str(message)}

# Function to standardize state to dictionary format
def standardize_state(state) -> Dict:
    """Convert any state object to a dictionary with consistent keys."""
    if isinstance(state, dict):
        return state
        
    try:
        if hasattr(state, "to_dict"):
            return state.to_dict()
        
        # Convert to dictionary by copying attributes
        state_dict = {}
        for attr in dir(state):
            # Skip private and special attributes
            if not attr.startswith('_') and not callable(getattr(state, attr)):
                state_dict[attr] = getattr(state, attr)
        return state_dict
    except Exception as e:
        print(f"DEBUG: Error converting state to dict: {e}")
        return {}

# Function to standardize messages in state
def standardize_messages(state_dict: Dict) -> Dict:
    """Standardize all messages in the state dictionary."""
    if "messages" not in state_dict:
        return state_dict
        
    standardized_msgs = []
    for msg in state_dict["messages"]:
        standardized_msgs.append(standardize_message(msg))
        
    state_dict["messages"] = standardized_msgs
    return state_dict

# Function to extract message content by role
def get_last_message_by_role(messages: List[Dict], role: str) -> Optional[str]:
    """Get the content of the last message with the specified role."""
    for msg in reversed(messages):
        std_msg = standardize_message(msg)
        if std_msg["role"] == role and "tool_call_id" not in std_msg:
            return std_msg["content"]
    return None 