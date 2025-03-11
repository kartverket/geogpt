"""
Dataset information retrieval node for the RAG workflow.
"""
from typing import Dict, List, Optional
from ..models import ConversationState
from ..utils.dataset_utils import (
    process_vdb_response, 
    enrich_dataset_metadata,
    create_follow_up_context
)


async def find_datasets_from_message(current_state: ConversationState) -> Optional[Dict]:
    """
    Try to find datasets directly from the user's message when no datasets are in context.
    
    Args:
        current_state: Current conversation state
        
    Returns:
        Follow-up context dictionary or None if no datasets found
    """
    if not current_state.messages or "content" not in current_state.messages[-1]:
        return None
        
    user_message = current_state.messages[-1]["content"].lower()
    print(f"DEBUG - Attempting to find dataset directly from user message: {user_message}")
    
    try:
        # Direct search using the vector database
        from helpers.vector_database import get_vdb_response
        
        # Get the direct dataset matches from the vector database
        vdb_response = await get_vdb_response(user_message)
        print(f"DEBUG - Direct search vdb_response count: {len(vdb_response) if vdb_response else 0}")
        
        if not vdb_response or len(vdb_response) == 0:
            return None
            
        # Process all found datasets
        field_names = ['uuid', 'title', 'abstract', 'image', 'metadatacreationdate', 'distance']
        all_detailed_info = []
        
        for result in vdb_response:
            # Create a detailed_info dict from each result
            detailed_info = {
                "uuid": result[0],
                "title": result[1],
                "abstract": result[2] if len(result) > 2 else "",
                "image": result[3] if len(result) > 3 else None,
                "metadatacreationdate": result[4] if len(result) > 4 else None
            }
            
            print(f"DEBUG - Found dataset: {detailed_info['title']}")
            
            # Add source URL and other metadata
            detailed_info = enrich_dataset_metadata(detailed_info)
            print(f"DEBUG - Direct search generated source_url: {detailed_info.get('source_url')}")
            
            all_detailed_info.append(detailed_info)
        
        # Also update metadata_context for future use
        current_state.metadata_context = vdb_response
        
        # Update last_datasets to include all found datasets
        current_state.last_datasets = [
            {"uuid": info["uuid"], "title": info["title"]} 
            for info in all_detailed_info
        ]
        
        # Create and return the follow-up context
        return create_follow_up_context(all_detailed_info)
    
    except Exception as e:
        print(f"DEBUG - Error during direct dataset search: {str(e)}")
        return None


def find_datasets_from_mentions(current_state: ConversationState, metadata_dict: List[Dict]) -> Optional[Dict]:
    """
    Find datasets that are explicitly mentioned in the user's message.
    
    Args:
        current_state: Current conversation state
        metadata_dict: Dictionary of dataset metadata
        
    Returns:
        Follow-up context dictionary or None if no datasets are mentioned
    """
    if not current_state.messages or "content" not in current_state.messages[-1] or not current_state.last_datasets:
        return None
        
    user_message = current_state.messages[-1]["content"].lower()
    mentioned_datasets = []
    
    for dataset in current_state.last_datasets:
        print(f"DEBUG - Checking dataset: {dataset['title']}")
        
        if dataset["title"].lower() in user_message:
            print(f"DEBUG - Found matching dataset in message: {dataset['title']}")
            
            # Find the full metadata for this dataset
            detailed_info = next(
                (item for item in metadata_dict if item["uuid"] == dataset["uuid"]), 
                {}
            )
            
            print(f"DEBUG - detailed_info found: {detailed_info}")
            
            # Add source URL and other metadata
            if detailed_info and "uuid" in detailed_info:
                detailed_info = enrich_dataset_metadata(detailed_info)
                print(f"DEBUG - generated source_url: {detailed_info.get('source_url')}")
                mentioned_datasets.append(detailed_info)
    
    if mentioned_datasets:
        return create_follow_up_context(mentioned_datasets)
    
    return None


def process_all_available_datasets(current_state: ConversationState, metadata_dict: List[Dict]) -> None:
    """
    Process all available datasets as a fallback when no specific datasets are mentioned.
    
    Args:
        current_state: Current conversation state
        metadata_dict: Dictionary of dataset metadata
        
    Returns:
        None - updates the current_state directly
    """
    if not current_state.last_datasets or not metadata_dict:
        return
        
    print(f"DEBUG - Using fallback case for datasets without explicit mention")
    print(f"DEBUG - Processing all {len(current_state.last_datasets)} datasets")
    
    all_datasets_info = []
    
    # Process all datasets in last_datasets
    for dataset in current_state.last_datasets:
        print(f"DEBUG - Processing dataset: {dataset['title']}")
        
        # Find the full metadata for this dataset
        detailed_info = next(
            (item for item in metadata_dict if item["uuid"] == dataset["uuid"]), 
            {}
        )
        
        print(f"DEBUG - detailed_info found from fallback: {detailed_info}")
        
        # Add source URL and other metadata
        if detailed_info and "uuid" in detailed_info:
            detailed_info = enrich_dataset_metadata(detailed_info)
            print(f"DEBUG - generated source_url from fallback: {detailed_info.get('source_url')}")
            all_datasets_info.append(detailed_info)
    
    # If we found any datasets with complete info, use them
    if all_datasets_info:
        current_state.follow_up_context = create_follow_up_context(all_datasets_info)


async def get_dataset_info(state: Dict) -> Dict:
    """
    Get detailed information about specific datasets.
    
    This node retrieves detailed information about datasets that the user is interested in.
    It can find datasets mentioned in the user's message, or process all available datasets
    as a fallback.
    
    Args:
        state: Current conversation state
        
    Returns:
        Updated conversation state with dataset information
    """
    current_state = ConversationState(**state)
    
    # Debug: Print the last_datasets contents
    print(f"DEBUG - last_datasets: {current_state.last_datasets}")
    
    # Convert metadata_context to a more usable format
    field_names = ['uuid', 'title', 'abstract', 'image', 'metadatacreationdate', 'distance']
    metadata_dict = process_vdb_response(current_state.metadata_context, field_names)
    
    # Debug: Print metadata dictionary
    print(f"DEBUG - metadata_dict sample (first 2 items): {metadata_dict[:2] if len(metadata_dict) >= 2 else metadata_dict}")
    
    # Try three approaches in order:
    # 1. Find datasets from the user's message (when no datasets in context)
    if not current_state.last_datasets:
        datasets_from_message = await find_datasets_from_message(current_state)
        if datasets_from_message:
            current_state.follow_up_context = datasets_from_message
            print(f"DEBUG - final follow_up_context from message search: {current_state.follow_up_context}")
            return current_state.to_dict()
    
    # 2. Find datasets explicitly mentioned in the user's message
    if not current_state.follow_up_context:
        datasets_from_mentions = find_datasets_from_mentions(current_state, metadata_dict)
        if datasets_from_mentions:
            current_state.follow_up_context = datasets_from_mentions
            print(f"DEBUG - final follow_up_context from mentions: {current_state.follow_up_context}")
            return current_state.to_dict()
    
    # 3. Process all available datasets as a fallback
    if not current_state.follow_up_context:
        process_all_available_datasets(current_state, metadata_dict)
    
    # Debug: Print final follow_up_context
    print(f"DEBUG - final follow_up_context: {current_state.follow_up_context}")
            
    return current_state.to_dict() 