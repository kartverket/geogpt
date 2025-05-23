"""
Relevance assessment node for the RAG workflow.
"""
from typing import Literal
from langchain_core.messages import HumanMessage, ToolMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from ..state import AgentState
import json

async def assess_relevance(state: AgentState) -> Literal["generate", "rewrite"]:
    """
    Determines whether the retrieved documents are relevant to the question.
    Similar to the grade_documents function in the tutorial.
    """
    from llm import LLMManager
    
    messages = state["messages"]
    
    # Check if we have at least one message
    if not messages:
        return "rewrite"
        
    last_message = messages[-1]
    
    # Check if the last message is a ToolMessage
    if not isinstance(last_message, ToolMessage):
        # Try to find any tool message
        tool_message = None
        for msg in reversed(messages):
            if isinstance(msg, ToolMessage):
                tool_message = msg
                break
                
        if not tool_message:
            # No tool message found, so we need to rewrite
            return "rewrite"
        else:
            # Use the found tool message instead
            last_message = tool_message
    
    # Get the content of the last message
    context = ""
    if hasattr(last_message, 'content'):
        context = last_message.content
    
    # If we don't have context, default to rewrite
    if not context:
        print("DEBUG assess_relevance: No context found, defaulting to rewrite")
        return "rewrite"
    
    # Shortcut for fallback message - if it contains specific text about not finding datasets
    if "Beklager, jeg fant ingen relevante datasett" in context:
        return "rewrite"
    
    # Check if context is too short to be useful (less than 100 characters)
    if len(context) < 100:
        return "rewrite"
    
    # Get the original query from the tool message if available
    original_query = None
    if hasattr(last_message, 'additional_kwargs'):
        original_query = last_message.additional_kwargs.get('original_query')
        print(f"DEBUG assess_relevance: Found original query from tool: {original_query}")
    
    # If no original query in tool message, try to find it from the tool call that led to this result
    if not original_query:
        for msg in reversed(messages):
            if hasattr(msg, 'additional_kwargs') and 'tool_calls' in msg.additional_kwargs:
                for tool_call in msg.additional_kwargs['tool_calls']:
                    if isinstance(tool_call, dict) and 'function' in tool_call:
                        try:
                            args = json.loads(tool_call['function'].get('arguments', '{}'))
                            original_query = args.get('query') or args.get('dataset_query')
                            if original_query:
                                print(f"DEBUG assess_relevance: Found original query from tool call: {original_query}")
                                break
                        except:
                            continue
                if original_query:
                    break
    
    # If we still don't have a query, use the most recent human message as fallback
    if not original_query:
        print("DEBUG assess_relevance: No original query found, using most recent human message")
        for msg in reversed(messages):
            if isinstance(msg, HumanMessage) and hasattr(msg, 'content'):
                original_query = msg.content
                print(f"DEBUG assess_relevance: Using fallback query: {original_query[:50]}...")
                break
    
    # If we still don't have a query, default to rewrite
    if not original_query:
        print("DEBUG assess_relevance: No query found at all, defaulting to rewrite")
        return "rewrite"
    
    # Create the relevance assessment prompt
    
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
        # Get LLM and invoke the prompt
        llm_manager = LLMManager()
        llm = llm_manager.get_main_llm()
        
        chain = prompt | llm | StrOutputParser()
        
        result = await chain.ainvoke({})
        result = result.lower().strip()
        print(f"DEBUG assess_relevance: Relevance assessment result: {result}")
        
        # Check rewrite attempts
        rewrite_attempts = state.get("rewrite_attempts", 0)
        print(f"DEBUG assess_relevance: Rewrite attempts: {rewrite_attempts}")

        if "yes" in result:
            return "generate"
        else:
            if rewrite_attempts >= 2:
                print("DEBUG assess_relevance: Max rewrite attempts reached, proceeding to generate.")
                return "generate" # Max attempts reached, force generation
            return "rewrite"
    except Exception as e:
        print(f"ERROR in assess_relevance: {e}")
        # Default to generate on error
        return "generate" 