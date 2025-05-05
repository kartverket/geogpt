"""
Main entry points for the RAG workflow.
"""
from typing import List, Dict, Any, Optional
from .supervisor import GeoNorgeSupervisor
from .utils.common import active_websockets

# Initialize the enhanced RAG chain - use a single global instance
enhanced_rag_chain = GeoNorgeSupervisor()


async def get_rag_response(
    user_question: str,
    datasets_with_status: Optional[List[Dict[str, Any]]] = None,
    vdb_response: Optional[Any] = None,
    websocket: Optional[Any] = None
) -> str:
    """Main entry point for the enhanced RAG chatbot."""
    session_id = str(id(websocket))
    
    # Store the websocket in the active_websockets dict directly to ensure it's available
    if websocket is not None:
        websocket_id = str(id(websocket))
        enhanced_rag_chain.active_websockets[websocket_id] = websocket
        active_websockets[websocket_id] = websocket
    
    return await enhanced_rag_chain.chat(user_question, session_id, websocket)


async def get_rag_context(vdb_response):
    """Get enhanced context from vector database response."""
    # This function can be implemented if needed for specific context processing
    return None, None 