"""
Leaflet map interaction workflow for GeoNorge.

This file defines the main workflow graph for map interactions.
"""
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from .state import MapState, with_map_state_handling
from .nodes import (
    get_next_node,
    router,
    call_model,
    call_tools,
    generate_response,
    send_map_update
)

class LeafletMapWorkflow:
    """
    Workflow for Leaflet map interactions in GeoNorge chatbot.
    """
    def __init__(self):
        self.memory = MemorySaver()
        # Websocket registration might happen elsewhere
        self.workflow = self._build_map_workflow()

    def _build_map_workflow(self):
        """Build the map interaction workflow graph."""
        workflow = StateGraph(MapState)

        # Wrap imported node functions
        wrapped_call_model = with_map_state_handling(call_model)
        wrapped_call_tools = with_map_state_handling(call_tools)
        wrapped_generate_response = with_map_state_handling(generate_response)
        wrapped_send_map_update = with_map_state_handling(send_map_update)
        wrapped_router = with_map_state_handling(router)

        # Add nodes
        workflow.add_node("agent", wrapped_call_model)
        workflow.add_node("tools", wrapped_call_tools)
        workflow.add_node("response", wrapped_generate_response)
        workflow.add_node("update", wrapped_send_map_update)
        workflow.add_node("router", wrapped_router)

        # Set entry point
        workflow.set_entry_point("router")

        # Define edges
        workflow.add_conditional_edges(
            "router",
            get_next_node, # Use imported router logic
            {
                "agent": "agent",
                "tools": "tools",
                "response": "response",
                "update": "update",
                END: END # Use END constant
            }
        )
        workflow.add_edge("agent", "router")
        workflow.add_edge("tools", "router")
        workflow.add_edge("response", "update")
        workflow.add_edge("update", END)

        # Compile
        return workflow.compile(checkpointer=self.memory) 