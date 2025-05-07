import json
from typing import Literal, Dict 

from llm import LLMManager
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from ...utils.message_utils import standardize_message, standardize_state, get_last_message_by_role
from ..state import AgentState

async def assess_relevance_logic(state: AgentState) -> Literal["generate", "rewrite"]:
    """
    Determines whether the retrieved documents are relevant to the question.
    Relies on finding the query used in the tool call that generated the most recent ToolMessage.
    """
    state_dict = standardize_state(state) # standardize_state expects AgentState or dict, returns dict
    messages = state_dict.get("messages", [])
    
    if not messages:
        print("DEBUG assess_relevance_logic: No messages, defaulting to rewrite")
        return "rewrite"
            
    last_tool_message = None
    last_tool_message_index = -1
    
    for i in range(len(messages) - 1, -1, -1):
        # standardize_message expects a BaseMessage or dict, returns dict
        msg = standardize_message(messages[i]) 
        if msg["role"] == "tool":
            last_tool_message = msg
            last_tool_message_index = i
            break
    
    if not last_tool_message:
        print("DEBUG assess_relevance_logic: No ToolMessage found, defaulting to rewrite")
        return "rewrite"
            
    context = last_tool_message.get("content", "")
    
    if not context:
        print("DEBUG assess_relevance_logic: No context found in ToolMessage, defaulting to rewrite")
        return "rewrite"
    
    if "Beklager, jeg fant ingen relevante datasett" in context or "Beklager, jeg kunne ikke hente informasjon" in context:
        print("DEBUG assess_relevance_logic: Tool returned fallback message, defaulting to rewrite")
        return "rewrite"
    
    if len(context) < 100:
        print(f"DEBUG assess_relevance_logic: Context too short ({len(context)} chars), defaulting to rewrite")
        return "rewrite"
    
    original_query = None
    tool_call_id = last_tool_message.get("tool_call_id", "")
    
    if tool_call_id:
        for i in range(last_tool_message_index - 1, -1, -1):
            msg = standardize_message(messages[i])
            if msg["role"] == "assistant" and "additional_kwargs" in msg and "tool_calls" in msg["additional_kwargs"]:
                tool_calls_in_ai = msg["additional_kwargs"]["tool_calls"]
                for tc in tool_calls_in_ai:
                    current_tc_id = tc.get('id', "")
                    current_tc_args = tc.get('function', {}).get('arguments', "{}")
                    if current_tc_id == tool_call_id:
                        try:
                            args_dict = json.loads(current_tc_args) if isinstance(current_tc_args, str) else current_tc_args
                            original_query = args_dict.get('query') or args_dict.get('dataset_query')
                            if original_query:
                                print(f"DEBUG assess_relevance_logic: Found query '{original_query[:50]}...' from AIMessage tool call {tool_call_id}")
                                break 
                        except json.JSONDecodeError:
                            print(f"DEBUG assess_relevance_logic: Could not parse args as JSON: {current_tc_args}")
                if original_query:
                    break 

    if not original_query:
        print("DEBUG assess_relevance_logic: Could not find query via tool_call_id, falling back to last HumanMessage")
        # get_last_message_by_role expects list of BaseMessage or dicts, and returns content string or None
        original_query = get_last_message_by_role(messages, "human") 
        if original_query:
            print(f"DEBUG assess_relevance_logic: Using fallback query from HumanMessage: {original_query[:50]}...")
    
    if not original_query:
        print("DEBUG assess_relevance_logic: No query found at all, defaulting to rewrite")
        return "rewrite"

    prompt = ChatPromptTemplate.from_messages([
        ("system", """Du er en vurderer som skal avgjøre om informasjonen er relevant for brukerens spørsmål.
        
Vurder BARE om informasjonen er relevant, ikke om den er fullstendig.
        Gi 'yes' hvis informasjonen er relevant for spørsmålet, ellers 'no'.
        Vær konservativ og si 'yes' selv om bare deler av informasjonen er relevant."""),
        ("human", f"""
        Her er informasjonen som ble hentet:
        {context}
        
        Her er brukerens spørsmål:
        {original_query}
        
        Er denne informasjonen relevant for spørsmålet? Svar kun med 'yes' eller 'no'.
        """)
    ])
    
    try:
        llm_manager = LLMManager()
        llm = llm_manager.get_main_llm()
        chain = prompt | llm | StrOutputParser()
        result = await chain.ainvoke({})
        result = result.lower().strip()
        print(f"DEBUG assess_relevance_logic: Relevance assessment result: {result}")
        
        if "yes" in result:
            return "generate"
        else:
            return "rewrite"
    except Exception as e:
        print(f"ERROR in assess_relevance_logic: {e}")
        return "generate" # Default to generate on error 