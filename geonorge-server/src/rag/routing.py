"""
Routing functions for the RAG workflow.
"""
from typing import Dict, Any
from .models.state import ConversationState


def should_route_to_invalid(state: Any) -> str:
    """Determine if query is invalid and should be routed to invalid handler."""
    if isinstance(state, dict):
        query = state.get("transformed_query", "").strip()
    elif isinstance(state, ConversationState):
        query = state.transformed_query.strip()
    else:
        query = ""
        
    return "handle_invalid" if query == "INVALID_QUERY" else "perform_search"


def route_by_intent(state: Any) -> str:
    """Route to appropriate node based on intent."""
    # Handle both dictionary and ConversationState objects
    if isinstance(state, dict):
        intent = state.get("current_intent", "")
    elif isinstance(state, ConversationState):
        intent = state.current_intent
    else:
        intent = ""
        
    if intent in ["initial_search", "refine_search"]:
        return "perform_search"
    elif intent == "dataset_details":
        return "get_dataset_info"
    return "generate_response" 