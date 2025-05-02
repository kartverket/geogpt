"""
Utility modules for the RAG workflow.
"""

from .dataset_utils import (
    enrich_dataset_metadata,
    process_vdb_response,
    create_follow_up_context,
    extract_dataset_info
)

from .document_grading import (
    evaluate_document_relevance,
)

from .templates import (
    RESPONSE_TEMPLATES,
    NO_RESULTS_TEMPLATE
)

from .common import (
    active_websockets,
    register_websockets_dict,
    format_history
)

from .image_processor import (
    check_image_signal,
    insert_image_rag_response
)

__all__ = [
    # Dataset utils
    'enrich_dataset_metadata',
    'process_vdb_response',
    'create_follow_up_context',
    'extract_dataset_info',
    
    # Document grading utils
    'evaluate_document_relevance',
    'prepare_documents_for_evaluation',
    
    # Templates
    'RESPONSE_TEMPLATES',
    'NO_RESULTS_TEMPLATE',
    
    # Common utils
    'active_websockets',
    'register_websockets_dict',
    'format_history',
    
    # Image processing
    'check_image_signal',
    'insert_image_rag_response',

] 