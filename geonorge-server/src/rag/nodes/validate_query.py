"""
Query validation node for the RAG workflow.
"""
from typing import Dict
from ..models import ConversationState
from retrieval import GeoNorgeVectorRetriever


# Initialize the retriever
retriever = GeoNorgeVectorRetriever()


async def validate_query(state: Dict) -> Dict:
    """
    Validate and transform a search-related query.
    
    This node is only called for queries that have already been classified as search-related
    by the intent analyzer. It transforms the query to be more effective for vector database searching.
    If the transformed query is "INVALID_QUERY", it will be routed to the invalid query handler.
    
    Args:
        state: Current conversation state
        
    Returns:
        Updated conversation state with transformed query
    """
    current_state = ConversationState(**state)
    query = current_state.messages[-1]["content"]
    
    print("\n=== Query Validation ===")
    print(f"Original query (intent: {current_state.current_intent}): {query}")
    
    transformed_query = await retriever._transform_query(query)
    current_state.transformed_query = transformed_query
    
    print(f"\nOriginal query: {query}")
    print(f"Transformed query: {transformed_query}")
    print("---------------------")
    
    return current_state.to_dict() 