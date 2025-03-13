"""
Routing functions for the RAG workflow.
"""
from typing import Dict


def should_route_to_invalid(state: Dict) -> str:
    """Determine if query is invalid and should be routed to invalid handler."""
    return "handle_invalid" if state.get("transformed_query", "").strip() == "INVALID_QUERY" else "analyze_intent"


def route_by_intent(state: Dict) -> str:
    """Route to appropriate node based on intent."""
    intent = state.get("current_intent", "")
    if intent in ["initial_search", "refine_search"]:
        return "perform_search"
    elif intent == "dataset_details":
        return "get_dataset_info"
    return "generate_response" 