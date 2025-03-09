"""
Utility functions for dataset processing and metadata enrichment.
"""
from typing import Dict, List, Optional, Any, Tuple


def enrich_dataset_metadata(dataset_info: Dict) -> Dict:
    """
    Add source URL and other metadata to dataset info.
    
    Args:
        dataset_info: Dictionary containing dataset metadata with at least uuid and title
        
    Returns:
        Enriched dataset info dictionary with source_url and mer_informasjon fields
    """
    if dataset_info and "uuid" in dataset_info and "title" in dataset_info:
        url_formatted_title = dataset_info["title"].replace(' ', '-')
        source_url = f"https://kartkatalog.geonorge.no/metadata/{url_formatted_title}/{dataset_info['uuid']}"
        dataset_info["source_url"] = source_url
        dataset_info["mer_informasjon"] = f"Mer informasjon: {source_url}"
    return dataset_info


def process_vdb_response(vdb_response: List, field_names: Optional[List[str]] = None) -> List[Dict]:
    """
    Convert raw VDB response to structured metadata dictionaries.
    
    Args:
        vdb_response: Raw database response with rows of data
        field_names: List of field names to use for dict keys (default provides standard fields)
        
    Returns:
        List of dictionaries with named fields
    """
    if not field_names:
        field_names = ['uuid', 'title', 'abstract', 'image', 'metadatacreationdate', 'distance']
    
    if not vdb_response:
        return []
        
    return [dict(zip(field_names, row)) for row in vdb_response]


def create_follow_up_context(datasets_info: List[Dict]) -> Dict:
    """
    Create appropriate follow_up_context based on number of datasets.
    
    Args:
        datasets_info: List of enriched dataset info dictionaries
        
    Returns:
        A dictionary structured as either single dataset or multi-dataset context
    """
    if not datasets_info:
        return {}
    
    if len(datasets_info) == 1:
        return datasets_info[0]
    
    return {
        "datasets": datasets_info,
        "multiple_datasets": True,
        "count": len(datasets_info)
    }


def extract_dataset_info(dataset: Dict, metadata_dict: List[Dict]) -> Dict:
    """
    Extract detailed dataset info from metadata based on UUID.
    
    Args:
        dataset: Dictionary with at least uuid and title
        metadata_dict: List of metadata dictionaries to search
        
    Returns:
        Detailed dataset info dictionary
    """
    # Find the full metadata for this dataset
    detailed_info = next(
        (item for item in metadata_dict if item["uuid"] == dataset["uuid"]), 
        {}
    )
    
    # Add source URL if we have sufficient info
    if detailed_info and "uuid" in detailed_info:
        return enrich_dataset_metadata(detailed_info)
    
    return detailed_info 