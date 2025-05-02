"""
Document grading node for the RAG workflow.
"""
from typing import Dict
from ..models import ConversationState
from llm import LLMManager
from langchain_core.documents import Document
from ..utils.document_grading import evaluate_document_relevance


# Initialize LLM manager
llm_manager = LLMManager()
llm = llm_manager.get_main_llm()


async def grade_documents(state: Dict) -> Dict:
    """
    Grade the relevance of retrieved documents using an LLM.
    
    This node uses an LLM to evaluate the relevance of the documents returned by
    the search and filters out irrelevant ones. This improves the quality of the
    context provided to the response generation.
    
    Args:
        state: Current conversation state
        
    Returns:
        Updated conversation state with graded documents
    """
    current_state = ConversationState(**state)
    user_query = current_state.messages[-1]["content"]
    
    # Skip grading if there are no documents or if an invalid query was detected
    if not current_state.metadata_context or (
        len(current_state.metadata_context) == 1 and 
        isinstance(current_state.metadata_context[0], Document) and
        current_state.metadata_context[0].metadata.get("invalid_query", False)
    ):
        print("No documents to grade or invalid query detected")
        return current_state.to_dict()
    
    # Use the document grading utility to evaluate and filter documents
    graded_metadata = await evaluate_document_relevance(
        current_state.metadata_context, 
        user_query, 
        llm
    )
    
    # Update the state with graded documents
    current_state.metadata_context = graded_metadata
    
    # Re-generate the context with only the graded documents
    if graded_metadata:
        # Rebuild context from graded metadata
        context_parts = []
        for row in graded_metadata:
            title = row[1]
            description = row[2] if len(row) > 2 and row[2] else ""
            context_parts.append(f"{title} - {description}")
        
        current_state.context = "\n\n".join(context_parts)
        
        # Update last_datasets
        current_state.last_datasets = [
            {"uuid": row[0], "title": row[1]} for row in graded_metadata
        ]
        
        # Rebuild the datasets section
        dataset_names = [row[1] for row in graded_metadata]
        datasets_list = "\n".join([f"- {name}" for name in dataset_names])
        
        # Add datasets section to context
        datasets_section = f"""
        Relevante datasett funnet for denne forespørselen:
        {datasets_list}
        
        Vennligst referer til disse datasettene ved navn i svaret ditt.
        """
        
        current_state.context = current_state.context + "\n\n" + datasets_section
    else:
        current_state.context = "Beklager, jeg fant ingen relevante datasett for dette spørsmålet i Geonorge sin database."
        current_state.last_datasets = []
        
    return current_state.to_dict() 