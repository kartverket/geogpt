"""
RAG workflow for GeoNorge, wrapping the existing workflow components.

This file now imports the refactored modular components.
"""

from typing import Dict
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, END, StateGraph
from retrieval import GeoNorgeVectorRetriever
from helpers.websocket import send_websocket_action
from langchain.tools import StructuredTool

from .state import AgentState, tools_condition, with_state_handling
from .tools import create_retrieval_tool, create_dataset_info_tool
from .nodes import agent_node, handle_tool_calls, rewrite_query, assess_relevance, generate_final_response
from ..utils.common import register_websockets_dict


class GeoNorgeRAGWorkflow:
    """
    RAG workflow for GeoNorge chatbot, implemented using LangGraph.
    
    This class wraps the existing conversation workflow, routing requests to the
    appropriate nodes based on intent and query validation.
    """
    
    def __init__(self):
        print("Initializing GeoNorgeRAGWorkflow...")
        self.memory = MemorySaver()
        self.retriever = GeoNorgeVectorRetriever()
        self.active_websockets = {}
        
        # Patch the event loop to allow nested calls
        try:
            import nest_asyncio
            nest_asyncio.apply()
            print("Applied nest_asyncio patch to event loop")
        except ImportError:
            print("WARNING: nest_asyncio not found. Install with: pip install nest_asyncio")
            print("This may cause issues with running async functions in sync contexts")
        except Exception as e:
            print(f"WARNING: Failed to apply nest_asyncio patch: {e}")
            print("This may cause issues with running async functions in sync contexts")
        
        # Register the websockets dictionary with the nodes module
        register_websockets_dict(self.active_websockets)
        
        # Initialize tools first
        print("Initializing retrieval tools...")
        
        try:
            self.retrieval_tool = create_retrieval_tool(self.retriever)
            print(f"Created retrieval tool: {self.retrieval_tool.name}")
        except Exception as e:
            print(f"ERROR creating retrieval tool: {e}")
            # Create a fallback tool
            self.retrieval_tool = StructuredTool.from_function(
                func=lambda query: "Beklager, jeg kunne ikke søke etter informasjon på grunn av en teknisk feil.",
                name="retrieve_geo_information",
                description="Search and retrieve geographical information from GeoNorge database based on a query."
            )
        
        try:
            self.dataset_info_tool = create_dataset_info_tool()
            print(f"Created dataset info tool: {self.dataset_info_tool.name}")
        except Exception as e:
            print(f"ERROR creating dataset tool: {e}")
            # Create a fallback tool
            self.dataset_info_tool = StructuredTool.from_function(
                func=lambda query: "Beklager, jeg kunne ikke søke etter datasett på grunn av en teknisk feil.",
                name="search_dataset",
                description="Search for datasets using vector search based on a query about the dataset content."
            )
        
        # Verify tools were created successfully
        print(f"Created tools successfully: {self.retrieval_tool.name}, {self.dataset_info_tool.name}")
        
        # Build the conversation workflow
        print("Building conversation workflow...")
        self.workflow = self._build_conversation_workflow()
        print("RAG workflow initialization complete.")

    async def agent_node_wrapper(self, state: AgentState) -> Dict:
        """Wrapper for the agent node that passes tools."""
        return await agent_node(state, self.retrieval_tool, self.dataset_info_tool)

    async def handle_tool_calls_wrapper(self, state: AgentState) -> Dict:
        """Wrapper for the tool calls handler that passes tools."""
        return await handle_tool_calls(state, self.retrieval_tool, self.dataset_info_tool)

    def _build_conversation_workflow(self):
        """Build the enhanced conversation workflow with agentic capabilities."""
        workflow = StateGraph(AgentState)
        
        # Add nodes
        workflow.add_node("agent", self.agent_node_wrapper)
        workflow.add_node("tool_execution", self.handle_tool_calls_wrapper)
        workflow.add_node("rewrite", rewrite_query)
        workflow.add_node("assess_relevance", assess_relevance)
        workflow.add_node("generate", generate_final_response)
        
        # Define the flow with conditional edges
        workflow.add_edge(START, "agent")
        
        # Route based on agent decision
        workflow.add_conditional_edges(
            "agent",
            tools_condition,
            {
                "tools": "tool_execution",
                END: END,
            }
        )
        
        # After tool execution, assess relevance
        workflow.add_conditional_edges(
            "tool_execution",
            assess_relevance,
            {
                "generate": "generate",
                "rewrite": "rewrite"
            }
        )
        
        # After rewriting, go back to agent
        workflow.add_edge("rewrite", "agent")
        
        # Final response generation
        workflow.add_edge("generate", END)
        
        return workflow.compile(checkpointer=self.memory)

__all__ = ["GeoNorgeRAGWorkflow", "AgentState", "tools_condition", "with_state_handling"] 