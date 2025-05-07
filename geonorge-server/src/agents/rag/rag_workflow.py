"""
RAG workflow for GeoNorge, wrapping the existing workflow components.
"""
from typing import Dict, Callable, Any, List, Literal, Annotated, Sequence
from typing_extensions import TypedDict
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, END, StateGraph
from langgraph.prebuilt import ToolNode
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from langgraph.graph.message import add_messages
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from helpers.websocket import send_websocket_action
from retrieval import GeoNorgeVectorRetriever

from ..utils.common import register_websockets_dict
from ..utils.image_processor import insert_image_rag_response
from ..utils.message_utils import standardize_message, standardize_state, get_last_message_by_role

from .state import AgentState, tools_condition
# from .utils import with_state_handling # Keep this commented or remove if truly unused

from .tools.retrieval_tool import create_geonorge_retrieval_tool
from .tools.dataset_info_tool import create_geonorge_dataset_info_tool
from .nodes.agent_node import agent_node_logic
from .nodes.rewrite_node import rewrite_query_logic
from .nodes.relevance_node import assess_relevance_logic
from .nodes.generation_node import generate_final_response_logic

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
        
        try:
            import nest_asyncio
            nest_asyncio.apply()
            print("Applied nest_asyncio patch to event loop")
        except ImportError:
            print("WARNING: nest_asyncio not found. Install with: pip install nest_asyncio")
        except Exception as e:
            print(f"WARNING: Failed to apply nest_asyncio patch: {e}")
        
        register_websockets_dict(self.active_websockets)
        
        print("Initializing retrieval tools...")
        try:
            self.retrieval_tool = create_geonorge_retrieval_tool(self.retriever)
            print(f"Created retrieval tool: {self.retrieval_tool.name}")
        except Exception as e:
            print(f"ERROR creating retrieval tool: {e}")
            from langchain.tools import StructuredTool
            self.retrieval_tool = StructuredTool.from_function(
                func=lambda query: "Beklager, jeg kunne ikke søke etter informasjon på grunn av en teknisk feil.",
                name="retrieve_geo_information",
                description="Search and retrieve geographical information from GeoNorge database based on a query."
            )
        
        try:
            self.dataset_info_tool = create_geonorge_dataset_info_tool()
            print(f"Created dataset info tool: {self.dataset_info_tool.name}")
        except Exception as e:
            print(f"ERROR creating dataset tool: {e}")
            from langchain.tools import StructuredTool
            self.dataset_info_tool = StructuredTool.from_function(
                func=lambda query: "Beklager, jeg kunne ikke søke etter datasett på grunn av en teknisk feil.",
                name="search_dataset",
                description="Search for datasets using vector search based on a query about the dataset content."
            )
        
        print(f"Created tools successfully: {self.retrieval_tool.name}, {self.dataset_info_tool.name}")
        self.tools = [self.retrieval_tool, self.dataset_info_tool]
        self.tool_node = ToolNode(self.tools)
        print("Initialized ToolNode with available tools.")

        print("Building conversation workflow...")
        self.workflow = self._build_conversation_workflow()
        print("RAG workflow initialization complete.")

    async def agent_node(self, state: AgentState) -> Dict:
        """
        Wrapper for the agent_node_logic. Prepares LLM and tools.
        """
        from llm import LLMManager # Moved LLMManager import here as it's specific to this node prep

        llm_manager = LLMManager()
        llm = llm_manager.get_main_llm()
        llm_with_tools = llm.bind_tools(self.tools)
        
        return await agent_node_logic(state, llm_with_tools_bound=llm_with_tools, tools_list=self.tools)

    async def rewrite_query(self, state: AgentState) -> Dict:
        """
        Wrapper for the rewrite_query_logic.
        """
        return await rewrite_query_logic(state)

    async def assess_relevance(self, state: AgentState) -> Literal["generate", "rewrite"]:
        """
        Wrapper for the assess_relevance_logic.
        """
        return await assess_relevance_logic(state)

    async def generate_final_response(self, state: AgentState) -> Dict:
        """
        Wrapper for the generate_final_response_logic.
        """
        return await generate_final_response_logic(state)

    def _build_conversation_workflow(self):
        """Build the enhanced conversation workflow with agentic capabilities."""
        workflow = StateGraph(AgentState)
        
        workflow.add_node("agent", self.agent_node)
        workflow.add_node("tool_execution", self.tool_node)
        workflow.add_node("rewrite", self.rewrite_query)
        workflow.add_node("assess_relevance", self.assess_relevance)
        workflow.add_node("generate", self.generate_final_response)
        
        workflow.add_edge(START, "agent")
        
        workflow.add_conditional_edges(
            "agent",
            tools_condition,
            {
                "tools": "tool_execution",
                "__end__": END,
            }
        )
        
        workflow.add_conditional_edges(
            "tool_execution",
            self.assess_relevance,
            {
                "generate": "generate",
                "rewrite": "rewrite"
            }
        )
        
        workflow.add_edge("rewrite", "agent")
        workflow.add_edge("generate", END)
        
        return workflow.compile(
            checkpointer=self.memory,
            name="rag_expert" 
        ) 