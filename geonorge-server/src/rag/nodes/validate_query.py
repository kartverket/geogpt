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
    Validate if the query is about geographic data.
    
    This node uses the query transformation function from the retriever to determine
    if the query is related to geographic data or not. If the transformed query is
    "INVALID_QUERY", it will be routed to the invalid query handler.
    
    Args:
        state: Current conversation state
        
    Returns:
        Updated conversation state
    """
    current_state = ConversationState(**state)
    query = current_state.messages[-1]["content"]
    
    transformed_query = await retriever._transform_query(query)
    current_state.transformed_query = transformed_query
    
    print(f"\nOriginal query: {query}")
    print(f"Transformed query: {transformed_query}")
    print("---------------------")
    
    return current_state.to_dict() 