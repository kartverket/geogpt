"""
Core RAG chain implementation for GeoNorge.
"""
from typing import Dict, Annotated
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, END, StateGraph

from .models import ConversationState
from retrieval import GeoNorgeVectorRetriever
from .nodes import (
    validate_query,
    handle_invalid_query,
    analyze_intent,
    perform_search,
    grade_documents,
    get_dataset_info,
    generate_response
)
from .routing import should_route_to_invalid, route_by_intent
from .utils.common import register_websockets_dict, format_history
from .utils.image_processor import insert_image_rag_response


class EnhancedGeoNorgeRAGChain:
    """
    Enhanced RAG chain for GeoNorge chatbot, implemented using LangGraph.
    
    This class manages the conversation workflow, routing requests to the
    appropriate nodes based on intent and query validation.
    """
    
    def __init__(self):
        self.memory = MemorySaver()
        self.retriever = GeoNorgeVectorRetriever()
        self.sessions = {}
        self.active_websockets = {}
        
        # Register the websockets dictionary with the nodes module
        register_websockets_dict(self.active_websockets)
        
        # Build the conversation workflow after registering the websockets
        self.chain = self._build_conversation_workflow()

    def _build_conversation_workflow(self):
        """Build the enhanced conversation workflow with conditional routing."""
        workflow = StateGraph(Annotated[Dict, "ConversationState"])

        # Add nodes
        workflow.add_node("validate_query", validate_query)
        workflow.add_node("handle_invalid", handle_invalid_query)
        workflow.add_node("analyze_intent", analyze_intent)
        workflow.add_node("perform_search", perform_search)
        workflow.add_node("grade_documents", grade_documents)
        workflow.add_node("get_dataset_info", get_dataset_info)
        workflow.add_node("generate_response", generate_response)

        # Define the flow with conditional edges
        workflow.add_edge(START, "validate_query")
        
        # Route based on query validity
        workflow.add_conditional_edges(
            "validate_query",
            should_route_to_invalid,
            {
                "handle_invalid": "handle_invalid",
                "analyze_intent": "analyze_intent"
            }
        )

        # Route from invalid handler to end
        workflow.add_edge("handle_invalid", END)

        # Route based on intent
        workflow.add_conditional_edges(
            "analyze_intent",
            route_by_intent,
            {
                "perform_search": "perform_search",
                "get_dataset_info": "get_dataset_info",
                "generate_response": "generate_response"
            }
        )

        # Connect search to document grading
        workflow.add_edge("perform_search", "grade_documents")
        
        # Connect graded documents to response generation
        workflow.add_edge("grade_documents", "generate_response")
        
        workflow.add_edge("get_dataset_info", "generate_response")
        workflow.add_edge("generate_response", END)

        return workflow.compile(checkpointer=self.memory)

    async def chat(self, query: str, session_id: str, websocket) -> str:
        """Enhanced chat method with improved conversation management."""
        websocket_id = str(id(websocket))
        print(f"Setting up websocket with ID: {websocket_id}")
        self.active_websockets[websocket_id] = websocket
        
        try:
            if session_id not in self.sessions:
                print(f"Creating new conversation state for session {session_id}")
                current_state = ConversationState(websocket_id=websocket_id)
            else:
                print(f"Using existing conversation state for session {session_id}")
                state_dict = self.sessions[session_id]
                state_dict['websocket_id'] = websocket_id
                current_state = ConversationState(**state_dict)
            
            current_state.messages.append({"role": "human", "content": query})
            current_state.chat_history = format_history(current_state.messages)
            
            config = {"configurable": {"thread_id": session_id}}
            print(f"Invoking chain for session {session_id}")
            final_state = await self.chain.ainvoke(current_state.to_dict(), config=config)
            
            self.sessions[session_id] = final_state
            
            if final_state.get('messages'):
                last_message = final_state['messages'][-1]['content']
                print(f"Inserting image for response in session {session_id}")
                await insert_image_rag_response(
                    last_message,
                    final_state.get('metadata_context', []),
                    websocket
                )
                return last_message
            
            return "Ingen respons generert."
            
        finally:
            print(f"Cleaning up websocket with ID: {websocket_id}")
            self.active_websockets.pop(websocket_id, None) 