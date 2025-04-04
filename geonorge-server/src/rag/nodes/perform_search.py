"""
Search node for the RAG workflow.
"""
from typing import Dict
from ..models import ConversationState
from retrieval import GeoNorgeVectorRetriever
from langchain_core.documents import Document


# Initialize retriever
retriever = GeoNorgeVectorRetriever()


async def perform_search(state: Dict) -> Dict:
    """
    Perform vector search for initial or refined search.
    
    This node retrieves relevant documents from the vector database based on the user's query.
    It updates the state with context information and dataset metadata.
    
    Args:
        state: Current conversation state
        
    Returns:
        Updated conversation state with search results
    """
    current_state = ConversationState(**state)
    
    # First check if the transformed query is INVALID_QUERY
    if current_state.transformed_query and "INVALID_QUERY" in current_state.transformed_query:
        print("Skipping vector database search because query was marked as invalid")
        # Create a fallback document
        invalid_document = Document(
            page_content="Beklager, jeg kan bare svare på spørsmål om geografiske data, kart og Geonorges tjenester. Kan du omformulere spørsmålet ditt til å handle om dette?",
            metadata={"invalid_query": True}
        )
        current_state.context = invalid_document.page_content
        current_state.metadata_context = []
        return current_state.to_dict()
    
    documents, vdb_response = await retriever.get_relevant_documents(
        current_state.messages[-1]["content"]
    )
    
    # Debug print to see raw VDB response
    print(f"Raw VDB response for query: {current_state.messages[-1]['content']}")
    
    # Print dataset titles in a more readable format
    if vdb_response:
        print("\nDataset Titles:")
        for idx, row in enumerate(vdb_response):
            print(f"{idx+1}. UUID: {row[0]}, Title: {row[1]}")
    else:
        print("No datasets found")
    print("=====================\n")
    
    current_state.context = "\n\n".join(doc.page_content for doc in documents)
    current_state.metadata_context = vdb_response
    
    # Only populate last_datasets if we have actual results
    if vdb_response:
        current_state.last_datasets = [
            {"uuid": row[0], "title": row[1]} for row in vdb_response
        ]
        
        # Initialize a context section specifically for multiple datasets listing
        dataset_names = [row[1] for row in vdb_response]
        datasets_list = "\n".join([f"- {name}" for name in dataset_names])
        
        # Add a clear section to the context that lists all found datasets
        datasets_section = f"""
        Relevante datasett funnet for denne forespørselen:
        {datasets_list}
        
        Vennligst referer til disse datasettene ved navn i svaret ditt.
        """
        
        # Append this section to the context
        current_state.context = current_state.context + "\n\n" + datasets_section
        print(f"Added datasets section to context: {datasets_section}")
    else:
        # Clear last_datasets if no results to avoid suggesting irrelevant datasets
        current_state.last_datasets = []
        
    return current_state.to_dict() 