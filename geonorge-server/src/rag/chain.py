"""
Core multi-agent implementation for GeoNorge using a supervisor pattern.
"""
from .supervisor import GeoNorgeSupervisor


class EnhancedGeoNorgeRAGChain:
    """
    Enhanced multi-agent system for GeoNorge chatbot, implemented using LangGraph.
    
    This class uses a supervisor pattern to manage multiple workflows, including
    a RAG workflow for information retrieval and a map workflow for Leaflet map
    interactions.
    """
    
    def __init__(self):
        # Create the supervisor instance
        self.supervisor = GeoNorgeSupervisor()
        
        # Store shared dictionaries from the supervisor
        self.sessions = self.supervisor.sessions
        self.active_websockets = self.supervisor.active_websockets

    async def chat(self, query: str, session_id: str, websocket) -> str:
        """Enhanced chat method with multi-agent routing."""
        return await self.supervisor.chat(query, session_id, websocket) 