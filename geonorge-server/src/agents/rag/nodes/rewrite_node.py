from typing import Dict
from llm import LLMManager
from langchain_core.messages import HumanMessage, BaseMessage # Added BaseMessage for isinstance check if needed
from ..state import AgentState

async def rewrite_query_logic(state: AgentState) -> Dict:
    """
    Transform the query to produce a better question for retrieval.
    """
    messages = state.get("messages", []) # Use .get for safety if state might not be fully populated
    
    last_user_message = None
    for msg in reversed(messages):
        # Ensure msg is a HumanMessage instance before accessing content
        if isinstance(msg, HumanMessage):
            last_user_message = msg
            break
    
    if not last_user_message:
        return state # Return original state if no human message
    
    question = ""
    if hasattr(last_user_message, 'content') and last_user_message.content: # Check content exists
        question = last_user_message.content
    else:
        return state # Return original state if no content
            
    prompt_msg = HumanMessage(
        content=f""" \n 
    Look at the input and try to reason about the underlying semantic intent / meaning. \n 
    Here is the initial question:
    \n ------- \n
    {question} 
    \n ------- \n
    Formulate the question to ONLY be a SINGLE sentence for better geographical data retrieval: """
    )
    
    llm_manager = LLMManager()
    model = llm_manager.get_main_llm()
    response = await model.ainvoke([prompt_msg])
    
    new_messages = []
    for msg in messages:
        if msg != last_user_message:
            new_messages.append(msg)
    
    new_messages.append(HumanMessage(content=response.content))

    # Preserve other state fields when returning the update
    # Create a new dictionary from the old state and update messages
    updated_state_dict = {key: value for key, value in state.items()} # Works if state is a dict
    updated_state_dict["messages"] = new_messages
    
    return updated_state_dict 