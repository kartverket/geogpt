"""
Query rewrite node for the RAG workflow.
"""
from typing import Dict
from langchain_core.messages import HumanMessage
from ..state import AgentState

async def rewrite_query(state: AgentState) -> Dict:
    """
    Transform the query to produce a better question for retrieval.
    """
    from llm import LLMManager
    
    messages = state["messages"]
    
    # Find the latest HumanMessage
    last_user_message = None
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            last_user_message = msg
            break
    
    # If we couldn't find a human message, return state unchanged
    if not last_user_message:
        return state
    
    # Get the content from the message
    question = ""
    if hasattr(last_user_message, 'content'):
        question = last_user_message.content
    else:
        # We couldn't get the content, return state unchanged
        return state
        
    # Create the prompt for query reformulation
    prompt_msg = HumanMessage(
        content=f""" \n 
    Look at the input and try to reason about the underlying semantic intent / meaning. \n 
    Here is the initial question:
    \n ------- \n
    {question} 
    \n ------- \n
    Formulate the question to ONLY be a SINGLE sentence for better geographical data retrieval: """
    )
    
    # Use our LLM manager to get the model
    llm_manager = LLMManager()
    model = llm_manager.get_main_llm()
    response = await model.ainvoke([prompt_msg])
    
    # Create new messages list, filtering out the original message
    new_messages = []
    for msg in messages:
        if msg != last_user_message:
            new_messages.append(msg)
    
    # Add the improved query
    new_messages.append(HumanMessage(content=response.content))

    # Increment rewrite attempts
    rewrite_attempts = state.get("rewrite_attempts", 0) + 1

    # Preserve other state fields when returning the update
    return {
        "messages": new_messages,
        "websocket_id": state.get("websocket_id"),
        "chat_history": state.get("chat_history"),
        "original_query": state.get("original_query"),
        "metadata_context": state.get("metadata_context", []), # Preserve metadata
        "rewrite_attempts": rewrite_attempts
    } 