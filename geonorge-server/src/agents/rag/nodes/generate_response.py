"""
Response generation node for the RAG workflow.
"""
from typing import Dict
from ..models import ConversationState
from langchain.prompts import ChatPromptTemplate
from helpers.websocket import send_websocket_message
from llm import LLMManager
from ..utils.common import active_websockets, format_history
from ..utils.templates import RESPONSE_TEMPLATES, NO_RESULTS_TEMPLATE


# Initialize LLM manager
llm_manager = LLMManager()
llm = llm_manager.get_main_llm()


async def generate_response(state: Dict) -> Dict:
    """
    Generate contextual responses based on intent and state.
    
    This node generates the final response to the user based on the intent,
    context, and any dataset information that has been gathered. It uses
    appropriate templates based on the user's intent and streams the
    response to the user via the websocket.
    
    Args:
        state: Current conversation state
        
    Returns:
        Updated conversation state with the generated response
    """
    current_state = ConversationState(**state)
    websocket_id = current_state.websocket_id
    print(f"Generate response for websocket_id: {websocket_id}")
    
    # Get the websocket from the shared dictionary
    websocket = active_websockets.get(websocket_id)
    print(f"Retrieved websocket from active_websockets: {websocket is not None}")

    # Define intents that don't require context from the vector database
    context_free_intents = ["system_info", "clarification", "download_request"]
    is_context_free_intent = current_state.current_intent in context_free_intents
    
    # Check if we're dealing with a no results case
    no_results = False
    if not is_context_free_intent and current_state.context and "jeg fant ingen relevante datasett" in current_state.context:
        no_results = True
        response_template = NO_RESULTS_TEMPLATE
    else:
        # Use the appropriate template based on intent
        response_template = RESPONSE_TEMPLATES.get(
            current_state.current_intent, 
            RESPONSE_TEMPLATES["initial_search"]
        )

    # Create the prompt
    prompt = ChatPromptTemplate.from_messages([
        ("system", response_template),
        ("user", """Spørsmål: {input}                   

        Tidligere samtale:
        {chat_history}

        Kontekst:
        {context}

        Oppfølgingskontekst:
        {follow_up_context}
        """)
    ])

    # Stream the response to the user
    response_chunks = []
    await send_websocket_message("chatStream", {"isNewMessage": True}, websocket)

    # For context-free intents, we don't need to pass context
    if is_context_free_intent:
        stream_input = {
            "input": current_state.messages[-1]["content"],
            "chat_history": current_state.chat_history,
            "context": "",  # Empty context for context-free intents
            "follow_up_context": ""
        }
        print(f"Generating response for {current_state.current_intent} intent without context")
    else:
        stream_input = {
            "input": current_state.messages[-1]["content"],
            "chat_history": current_state.chat_history,
            "context": current_state.context,
            "follow_up_context": str(current_state.follow_up_context)
        }

    async for chunk in (prompt | llm).astream(stream_input):
        if hasattr(chunk, 'content'):
            response_chunks.append(chunk.content)
            await send_websocket_message("chatStream", {"payload": chunk.content}, websocket)

    # Update the conversation state with the full response
    full_response = "".join(response_chunks)
    current_state.messages.append({"role": "assistant", "content": full_response})
    current_state.chat_history = format_history(current_state.messages)

    return current_state.to_dict() 