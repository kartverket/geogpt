"""
Supervisor module for GeoNorge multi-agent system, managing multiple workflows.
"""
from typing import Dict, List, Optional, Any, Literal, TypedDict
from dataclasses import dataclass, field
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, END, StateGraph
from langgraph.types import Command

from llm import LLMManager
from langchain.prompts import ChatPromptTemplate
from langchain.schema import StrOutputParser

from .rag_workflow import GeoNorgeRAGWorkflow
from .map_workflow import LeafletMapWorkflow
from .utils.common import register_websockets_dict, format_history, active_websockets
from .utils.image_processor import insert_image_rag_response
from helpers.websocket import send_websocket_message
from action_enums import Action
import re
import asyncio
import uuid

# Helper function to ensure message dictionaries have required fields for conversion
def fix_message_dict_for_conversion(message: Dict) -> Dict:
    """
    Fix message dictionaries to ensure they have all required fields
    for proper conversion to LangChain message objects.
    
    Args:
        message: A dictionary representing a message
        
    Returns:
        A fixed dictionary with necessary fields for conversion
    """
    # Make a copy to avoid modifying the original
    fixed_msg = dict(message)
    
    # Fix tool messages to ensure they have tool_call_id
    if fixed_msg.get("role") == "tool" and "tool_call_id" not in fixed_msg:
        # Generate a random ID for the tool call
        fixed_msg["tool_call_id"] = f"auto_generated_{str(uuid.uuid4())[:8]}"
        print(f"DEBUG: Added missing tool_call_id: {fixed_msg['tool_call_id']} to tool message")
    
    # Ensure content exists
    if "content" not in fixed_msg or fixed_msg["content"] is None:
        fixed_msg["content"] = ""
        print(f"DEBUG: Added missing content field for {fixed_msg.get('role', 'unknown')} message")
    
    return fixed_msg


@dataclass
class SupervisorState:
    """
    State schema for the supervisor workflow.
    """
    messages: List[Dict[str, str]] = field(default_factory=list)
    chat_history: str = ""
    websocket_id: Optional[str] = None
    metadata_context: List[Any] = field(default_factory=list)
    workflow_result: Optional[Dict] = None
    rag_result: Optional[Dict] = None
    map_result: Optional[Dict] = None

    def to_dict(self) -> Dict:
        """
        Converts the supervisor state to a dictionary representation
        """
        return {
            "messages": self.messages,
            "chat_history": self.chat_history,
            "websocket_id": self.websocket_id,
            "metadata_context": self.metadata_context,
            "workflow_result": self.workflow_result,
            "rag_result": self.rag_result,
            "map_result": self.map_result
        }


class GeoNorgeSupervisor:
    """
    Supervisor for GeoNorge chatbot that manages multiple workflows.
    
    This class implements a supervisor pattern that routes user queries to
    the appropriate workflow (RAG or Map) based on the query content.
    """
    
    def __init__(self):
        self.memory = MemorySaver()
        self.sessions = {}
        self.active_websockets = {}
        
        # Initialize LLM for classification
        llm_manager = LLMManager()
        self.model = llm_manager.get_main_llm()
        
        # Register the websockets dictionary
        register_websockets_dict(self.active_websockets)
        
        # Create workflow instances
        self.rag_workflow = GeoNorgeRAGWorkflow()
        self.map_workflow = LeafletMapWorkflow()
        
        # Build the supervisor workflow
        self.chain = self._build_supervisor()
    
    def _build_supervisor(self):
        """Build the supervisor workflow that manages the RAG and Map workflows."""
        # Define a proper TypedDict schema for the state with channels
        class SupervisorStateSchema(TypedDict, total=False):
            messages: List[Dict[str, str]]
            chat_history: str
            websocket_id: str
            metadata_context: List[Any]
            workflow_result: Optional[Dict]
            rag_result: Optional[Dict]
            map_result: Optional[Dict]
        
        # Use the typed dict for state schema
        workflow = StateGraph(SupervisorStateSchema)
        
        # Define supervisor node that determines which workflow to use
        async def classify_query(state):
            """Analyze the query and decide which workflow to use."""
            print(f"DEBUG classify_query: state type = {type(state)}")
            
            # Convert state to a dictionary if it's not already
            if not isinstance(state, dict):
                try:
                    if hasattr(state, "to_dict"):
                        state_dict = state.to_dict()
                    else:
                        state_dict = dict(state)
                    print(f"DEBUG: Converted state to dict with keys: {state_dict.keys()}")
                except Exception as e:
                    print(f"DEBUG: Error converting state to dict: {e}")
                    # Fallback to empty dict with messages
                    state_dict = {"messages": [{"role": "human", "content": "Hjelp meg"}]}
            else:
                state_dict = state
                
            # Ensure state has required fields
            if "messages" not in state_dict or not state_dict["messages"]:
                print("DEBUG: No messages in state, adding default")
                state_dict["messages"] = [{"role": "human", "content": "Hjelp meg"}]
                
            query = state_dict["messages"][-1]["content"]
            print(f"DEBUG: Query for classification: {query}")
                
            # Use the LLM to classify the query
            prompt = ChatPromptTemplate.from_messages([
                ("system", """Du er en assistent som avgjør om en brukerforespørsel handler om kartet, informasjonssøk, eller begge deler.
                
                Hvis forespørselen BARE handler om kartmanipulasjoner, som:
                - Panorere, zoome eller flytte kartet til en lokasjon ("flytt kartet til Oslo", "zoom inn på Bergen")
                - Vise eller skjule kartlag ("vis topografisk kart", "skjul satelittbilde")
                - Legge til, fjerne eller finne markører ("sett markør i Trondheim", "fjern alle markører")
                - Andre direkte kartmanipulasjoner
                - Spesifikk bruk av kartet til å vise steder, uten å be om faktainformasjon om stedene
                
                Da skal du klassifisere det som "map" (kart).
                
                Hvis forespørselen BARE handler om å få informasjon, som:
                - Å spørre om informasjon om geografiske data ("hva er FKB?", "fortell meg om N50")
                - Søke etter datasett eller informasjon ("finn datasett om elver", "hvilke datasett finnes for skogsområder")
                - Generelle informasjonsspørsmål om steder, data eller Geonorge/GeoGPT
                - Spørsmål om fakta, uten å be om kartmanipulasjoner
                
                Da skal du klassifisere det som "rag" (informasjonssøk).
                
                Forespørselen skal KUN klassifiseres som "mixed" når det er TYDELIG at brukeren både:
                1) Spør om faktabaserte informasjon om et tema, datasett eller geografisk fenomen, OG
                2) Eksplisitt ber om spesifikke kartmanipulasjoner
                
                For eksempel:
                - "Hva er FKB og kan du flytte kartet til Trondheim?" (mixed - både faktaspørsmål og kartmanipulasjon)
                - "Fortell meg om arealressurskart og vis meg hvor jeg finner dette i kartet" (mixed)
                
                Men disse er IKKE mixed:
                - "Flytt kartet til Oslo og sett zoom til 12" (map - bare kartoperasjoner)
                - "Zoom inn på Bergen og sett markør i Oslo og Trondheim" (map - selv om det nevner byer er det bare kartoperasjoner)
                - "Hva er N50 kartdata?" (rag - bare informasjonssøk)
                
                Returner bare ett enkelt ord: "map", "rag", eller "mixed".
                """),
                ("human", query)
            ])
            
            chain = prompt | self.model | StrOutputParser()
            classification = await chain.ainvoke({})
            classification = classification.strip().lower()
            
            print(f"Query classification: {classification}")
            
            # Validate and set default if needed
            if classification not in ["map", "rag", "mixed"]:
                classification = "rag"  # Default to RAG
                
            # Create a simplified state dict to pass to the workflow
            workflow_state = {
                "messages": state_dict["messages"],
                "chat_history": state_dict.get("chat_history", ""),
                "websocket_id": state_dict.get("websocket_id", "")
            }
            
            # Verify websocket_id is registered (needed for map workflow)
            websocket_id = state_dict.get("websocket_id", "")
            if websocket_id in self.active_websockets:
                print(f"DEBUG: Verified websocket_id {websocket_id} exists in active_websockets")
            else:
                print(f"WARNING: No websocket found with ID {websocket_id} in active_websockets!")
                    
            # Return command based on classification
            if classification == "mixed":
                print(f"DEBUG: Routing to both workflows via parallel_router")
                return Command(goto="parallel_router", update=workflow_state)
            elif classification == "map":
                print(f"DEBUG: Routing to map_workflow")
                return Command(goto="map_workflow", update=workflow_state)
            else:  # rag
                print(f"DEBUG: Routing to rag_workflow")
                return Command(goto="rag_workflow", update=workflow_state)
        
        # Define router for parallel execution
        async def parallel_router(state):
            """Router that initiates parallel execution of both workflows."""
            print(f"DEBUG parallel_router: Preparing for parallel execution")
            
            # Convert state to dict if needed
            if not isinstance(state, dict):
                try:
                    if hasattr(state, "to_dict"):
                        state_dict = state.to_dict()
                    else:
                        state_dict = dict(state)
                except Exception as e:
                    print(f"DEBUG: Error converting state to dict: {e}")
                    state_dict = {"messages": state.messages if hasattr(state, "messages") else []}
            else:
                state_dict = state
            
            # Deep copy the state for each workflow
            import copy
            rag_state = copy.deepcopy(state_dict)
            map_state = copy.deepcopy(state_dict)
            
            # Return commands to execute both workflows in parallel
            return {"NEXT": ["run_rag", "run_map"], "rag_state": rag_state, "map_state": map_state}
        
        # Define nodes to run each workflow
        async def run_rag(state):
            """Run the RAG workflow with the provided state."""
            print(f"DEBUG run_rag: Running RAG workflow")
            
            # Get the correct state to use
            rag_state = state.get("rag_state", state)
            
            # Create a clean copy of the state with only text-based content
            clean_rag_state = {
                "websocket_id": rag_state.get("websocket_id", ""),
                "chat_history": rag_state.get("chat_history", ""),
                "in_merged_workflow": True
            }
            
            # Extract ONLY the text part of the user query
            # This is crucial to prevent map objects from being passed to RAG
            if "messages" in rag_state:
                clean_messages = []
                for msg in rag_state["messages"]:
                    # Check if we're dealing with a dictionary or an object
                    if isinstance(msg, dict):
                        new_msg = {"role": msg.get("role", "")}
                        content = msg.get("content", "")
                        
                        # For human messages, ensure content is a clean string
                        if msg.get("role") == "human":
                            # Handle non-string content
                            if isinstance(content, list) or isinstance(content, dict):
                                print(f"WARNING: Fixing non-string query: {type(content)}")
                                # If user query was somehow converted to an object,
                                # try to find the original text query from the state
                                if "messages" in state:
                                    for orig_msg in state["messages"]:
                                        if isinstance(orig_msg, dict) and orig_msg.get("role") == "human" and isinstance(orig_msg.get("content"), str):
                                            content = orig_msg.get("content", "")
                                            print(f"DEBUG: Retrieved original text query: {content}")
                                            break
                                
                                # Fallback if we still don't have text
                                if not isinstance(content, str) or not content:
                                    content = "Jeg trenger informasjon om geografiske data"
                        
                        # Copy any additional fields from the original message
                        for key, value in msg.items():
                            if key != "role" and key != "content":  # already handled above
                                new_msg[key] = value
                    else:
                        # Handle Pydantic/langchain message objects
                        try:
                            if hasattr(msg, "type"):
                                role = "assistant" if msg.type == "ai" else "human" if msg.type == "human" else "system" if msg.type == "system" else "tool"
                                new_msg = {"role": role}
                                content = msg.content if hasattr(msg, "content") else ""
                                
                                # For tool messages, ensure tool_call_id is preserved
                                if role == "tool" and hasattr(msg, "tool_call_id"):
                                    new_msg["tool_call_id"] = msg.tool_call_id
                                elif role == "tool":
                                    # No tool_call_id, generate one
                                    new_msg["tool_call_id"] = f"auto_generated_{str(uuid.uuid4())[:8]}"
                                    print(f"DEBUG: Generated tool_call_id for object message: {new_msg['tool_call_id']}")
                                
                                # Copy additional kwargs if present
                                if hasattr(msg, "additional_kwargs"):
                                    new_msg["additional_kwargs"] = msg.additional_kwargs
                            elif hasattr(msg, "role"):
                                new_msg = {"role": msg.role}
                                content = msg.content if hasattr(msg, "content") else ""
                                
                                # For tool messages, ensure tool_call_id is preserved
                                if msg.role == "tool" and hasattr(msg, "tool_call_id"):
                                    new_msg["tool_call_id"] = msg.tool_call_id
                                elif msg.role == "tool":
                                    # No tool_call_id, generate one
                                    new_msg["tool_call_id"] = f"auto_generated_{str(uuid.uuid4())[:8]}"
                                    print(f"DEBUG: Generated tool_call_id for object message: {new_msg['tool_call_id']}")
                                
                                # Copy additional kwargs if present
                                if hasattr(msg, "additional_kwargs"):
                                    new_msg["additional_kwargs"] = msg.additional_kwargs
                            else:
                                # Unknown message type, create generic role
                                new_msg = {"role": "unknown"}
                                content = str(msg)
                        except Exception as e:
                            print(f"DEBUG: Error processing message object: {e}")
                            new_msg = {"role": "unknown"}
                            content = "Error processing message"
                    
                    # Sanitize content to ensure it's a string
                    if not isinstance(content, str):
                        content = str(content)
                    
                    new_msg["content"] = content
                    
                    # Apply final fixes to ensure message can be properly converted
                    fixed_msg = fix_message_dict_for_conversion(new_msg)
                    clean_messages.append(fixed_msg)
                
                clean_rag_state["messages"] = clean_messages
            else:
                # Create default message if none exists
                clean_rag_state["messages"] = [{"role": "human", "content": "Jeg trenger informasjon om geografiske data"}]
            
            # Create a properly formatted chat history from the messages for the RAG workflow to use
            from .utils.common import format_history
            clean_rag_state["chat_history"] = format_history(clean_rag_state["messages"])
            
            print(f"DEBUG: Created clean RAG state with query: {clean_rag_state['messages'][-1].get('content')}")
            print(f"DEBUG: Chat history length: {len(clean_rag_state['chat_history'])}")
            
            # Run the RAG workflow with sanitized state
            try:
                result = await self.rag_workflow.workflow.ainvoke(clean_rag_state)
                return {"rag_result": result, "NEXT": "merge_results"}
            except Exception as e:
                print(f"ERROR in RAG workflow: {e}")
                # Return minimal valid result to prevent breaking the workflow
                error_msg = f"Beklager, jeg kunne ikke søke etter informasjonen: {str(e)}"
                return {
                    "rag_result": {
                        "messages": [
                            {"role": "human", "content": clean_rag_state["messages"][-1].get("content", "")},
                            {"role": "assistant", "content": error_msg}
                        ],
                        "chat_history": clean_rag_state.get("chat_history", ""),
                        "websocket_id": clean_rag_state.get("websocket_id", ""),
                        "in_merged_workflow": True
                    },
                    "NEXT": "merge_results"
                }
        
        async def run_map(state):
            """Run the Map workflow with the provided state."""
            print(f"DEBUG run_map: Running Map workflow")
            
            # Get the correct state to use
            map_state = state.get("map_state", state)
            
            # Ensure all map-specific fields are initialized
            if "map_center" not in map_state:
                map_state["map_center"] = (59.9139, 10.7522)  # Default to Oslo
            if "zoom_level" not in map_state:
                map_state["zoom_level"] = 14
            if "visible_layers" not in map_state:
                map_state["visible_layers"] = []
            if "markers" not in map_state:
                map_state["markers"] = []
            if "action_taken" not in map_state:
                map_state["action_taken"] = []
                
            # Mark this as part of a merged workflow to prevent duplicate messages
            map_state["in_merged_workflow"] = True
                
            # Run the Map workflow
            result = await self.map_workflow.workflow.ainvoke(map_state)
            
            # Preserve the merged workflow flag in the result
            if isinstance(result, dict):
                result["in_merged_workflow"] = True
            
            # Return the result to be merged later
            return {"map_result": result, "NEXT": "merge_results"}
        
        # Define node to merge results from parallel workflows
        async def merge_results(state):
            """
            Merge results from multiple workflows.
            
            This node combines the results from the RAG and map workflows
            to create a coherent response that includes both text and map elements.
            
            Args:
                state: Current supervisor state
                
            Returns:
                Updated supervisor state
            """
            print(f"DEBUG merge_results: Starting with state keys: {state.keys()}")
            
            # Don't use the Action enum for now
            
            try:
                # Convert state to dict if needed
                state_dict = {}
                if not isinstance(state, dict):
                    try:
                        if hasattr(state, "to_dict"):
                            state_dict = state.to_dict()
                            print(f"DEBUG: Used to_dict() method, got keys: {state_dict.keys()}")
                        else:
                            state_dict = dict(state)
                            print(f"DEBUG: Converted to dict, got keys: {state_dict.keys()}")
                    except Exception as e:
                        print(f"DEBUG: Error converting state to dict: {e}")
                        state_dict = {}
                        print("DEBUG: Using empty state_dict due to conversion error")
                else:
                    state_dict = state
                    print(f"DEBUG: State was already a dict with keys: {state_dict.keys()}")
                
                # Get results from both workflows
                rag_result = state_dict.get("rag_result", {})
                map_result = state_dict.get("map_result", {})
                
                print(f"DEBUG: RAG result type: {type(rag_result)}, Map result type: {type(map_result)}")
                
                # Default websocket ID and fallback state
                websocket_id = state_dict.get("websocket_id", "")
                if not websocket_id and isinstance(map_result, dict):
                    websocket_id = map_result.get("websocket_id", "")
                if not websocket_id and isinstance(rag_result, dict):
                    websocket_id = rag_result.get("websocket_id", "")
                    
                print(f"DEBUG: Using websocket_id: {websocket_id}")
                
                # Initialize fallback state with sensible defaults
                fallback_state = {
                    "messages": state_dict.get("messages", []),
                    "chat_history": state_dict.get("chat_history", ""),
                    "websocket_id": websocket_id,
                    "metadata_context": [],
                    "map_center": (59.9139, 10.7522),  # Default to Oslo
                    "zoom_level": 14,
                    "visible_layers": [],
                    "markers": [],
                    "action_taken": [],
                    "workflow_result": {"map": {}, "rag": {}},
                    "in_merged_workflow": True
                }
                
                # Check if either workflow failed
                rag_failed = not isinstance(rag_result, dict) or "messages" not in rag_result
                map_failed = not isinstance(map_result, dict) or "messages" not in map_result
                
                # Handle cases where one or both workflows failed
                if rag_failed and map_failed:
                    print("WARNING: Both RAG and Map workflows failed. Using fallback response.")
                    fallback_state["messages"].append({
                        "role": "assistant", 
                        "content": "Beklager, jeg kunne ikke behandle forespørselen din. Vennligst prøv igjen med en annen formulering."
                    })
                    print("DEBUG: Returning fallback state with in_merged_workflow=True")
                    return fallback_state
                elif rag_failed:
                    print("WARNING: RAG workflow failed. Using only Map workflow response.")
                    if isinstance(map_result, dict):
                        map_result["in_merged_workflow"] = True
                        print(f"DEBUG: Set in_merged_workflow=True in map_result")
                    return map_result
                elif map_failed:
                    print("WARNING: Map workflow failed. Using only RAG workflow response.")
                    if isinstance(rag_result, dict):
                        rag_result["in_merged_workflow"] = True
                        print(f"DEBUG: Set in_merged_workflow=True in rag_result")
                    return rag_result
                
                # Take latest messages from both workflows
                rag_messages = rag_result.get("messages", [])
                map_messages = map_result.get("messages", [])
                
                # Debug message types
                print(f"DEBUG: RAG messages types: {[type(msg).__name__ for msg in rag_messages]}")
                print(f"DEBUG: Map messages types: {[type(msg).__name__ for msg in map_messages]}")

                if len(rag_messages) > 0:
                    sample_msg = rag_messages[-1]
                    if isinstance(sample_msg, dict):
                        print(f"DEBUG: RAG message sample (dict): {sample_msg.keys()}")
                    else:
                        print(f"DEBUG: RAG message sample (object): {dir(sample_msg)[:10]}")

                if len(map_messages) > 0:
                    sample_msg = map_messages[-1]
                    if isinstance(sample_msg, dict):
                        print(f"DEBUG: Map message sample (dict): {sample_msg.keys()}")
                    else:
                        print(f"DEBUG: Map message sample (object): {dir(sample_msg)[:10]}")
                
                # Get the latest assistant messages from each workflow (ignoring tool messages)
                rag_response = None
                for msg in reversed(rag_messages):
                    # Handle both dictionary and Pydantic object messages
                    if isinstance(msg, dict):
                        if msg.get("role") == "assistant" and "tool_call_id" not in msg:
                            rag_response = msg.get("content", "")
                            break
                    else:
                        # Handle Pydantic model messages (AIMessage objects)
                        try:
                            if hasattr(msg, "type") and msg.type == "ai" and not getattr(msg, "tool_call_id", None):
                                rag_response = msg.content
                                break
                        except Exception as e:
                            print(f"DEBUG: Error extracting content from message: {e}")
                            continue
                
                map_response = None
                for msg in reversed(map_messages):
                    # Handle both dictionary and Pydantic object messages
                    if isinstance(msg, dict):
                        if msg.get("role") == "assistant" and "tool_call_id" not in msg:
                            map_response = msg.get("content", "")
                            break
                    else:
                        # Handle Pydantic model messages (AIMessage objects)
                        try:
                            if hasattr(msg, "type") and msg.type == "ai" and not getattr(msg, "tool_call_id", None):
                                map_response = msg.content
                                break
                        except Exception as e:
                            print(f"DEBUG: Error extracting content from message: {e}")
                            continue
                
                # Combine responses using the model
                if rag_response and map_response:
                    try:
                        # Safely create merged response
                        rag_response_str = str(rag_response) if rag_response else "Ingen informasjon funnet."
                        map_response_str = str(map_response) if map_response else "Ingen endringer gjort på kartet."
                        
                        prompt_template = """
                        Du er en assistent som skal kombinere to svar til ett sammenhengende svar.
                        
                        Det første svaret inneholder informasjon om et geografisk tema.
                        Det andre svaret beskriver endringer gjort på et kart.
                        
                        Kombiner disse to svarene til ett sammenhengende svar som gir all informasjonen på en naturlig måte.
                        Begynn med den faktabaserte informasjonen, og avslutt med kartendringene.
                        
                        Informasjonssøksvar: {rag_response}
                        
                        Kartsvar: {map_response}
                        """
                        
                        # Create a prompt using from_template
                        prompt = ChatPromptTemplate.from_template(prompt_template)
                        
                        # Build the chain with proper parameters
                        chain = prompt | self.model | StrOutputParser()
                        
                        # Get the original user query
                        query = ""
                        for msg in state_dict.get("messages", []):
                            # Handle both dictionary and Pydantic object messages
                            if isinstance(msg, dict):
                                if msg.get("role") == "human":
                                    query = msg.get("content", "")
                                    break
                            else:
                                # Handle Pydantic model messages (HumanMessage objects)
                                try:
                                    if hasattr(msg, "type") and msg.type == "human":
                                        query = msg.content
                                        break
                                except Exception as e:
                                    print(f"DEBUG: Error extracting content from human message: {e}")
                                    continue

                        # Copy metadata context from RAG result
                        metadata_context = rag_result.get("metadata_context", [])

                        # If both RAG and map results are available, merge them
                        if websocket_id and websocket_id in active_websockets:
                            websocket = active_websockets[websocket_id]
                            
                            if websocket:
                                try:
                                    # Create LLM chain for combined response
                                    chain = prompt | self.model | StrOutputParser()
                                    
                                    # Send initial empty message to start streaming
                                    print(f"DEBUG merge_results: Sending initial empty message")
                                    await send_websocket_message("chatStream", {"payload": "", "isNewMessage": True}, websocket)
                                    
                                    # Stream token by token using astream
                                    print(f"DEBUG merge_results: Starting token streaming")
                                    combined_response = ""
                                    async for chunk in (prompt | self.model).astream({
                                        "rag_response": rag_response_str,
                                        "map_response": map_response_str
                                    }):
                                        if hasattr(chunk, 'content'):
                                            # Stream each chunk as it's generated
                                            print(f"DEBUG merge_results: Streaming chunk: {chunk.content[:20]}...")
                                            await send_websocket_message("chatStream", {"payload": chunk.content}, websocket)
                                            combined_response += chunk.content
                                    
                                    # Signal completion
                                    print(f"DEBUG merge_results: Sending streamComplete directly")
                                    await send_websocket_message("streamComplete", {}, websocket)
                                    print(f"DEBUG merge_results: Sending formatMarkdown directly")
                                    await send_websocket_message("formatMarkdown", {}, websocket)
                                    
                                    print(f"DEBUG: Completed streaming combined response")
                                    
                                    # Mark the response as streamed to prevent duplicate sending
                                    merged_state = {
                                        "messages": [
                                            fix_message_dict_for_conversion({"role": "human", "content": query}),
                                            fix_message_dict_for_conversion({"role": "assistant", "content": combined_response})
                                        ],
                                        "chat_history": format_history([{"role": "human", "content": query}, {"role": "assistant", "content": combined_response}]),
                                        "websocket_id": websocket_id,
                                        "metadata_context": metadata_context,
                                        "map_center": map_result.get("map_center", (59.9139, 10.7522)),
                                        "zoom_level": map_result.get("zoom_level", 14),
                                        "visible_layers": map_result.get("visible_layers", []),
                                        "markers": map_result.get("markers", []),
                                        "action_taken": map_result.get("action_taken", []),
                                        "workflow_result": {"map": map_result, "rag": rag_result},
                                        "in_merged_workflow": True,
                                        "response_streamed": True
                                    }
                                    
                                    if "rag_result" in merged_state and isinstance(merged_state["rag_result"], dict):
                                        merged_state["rag_result"]["response_streamed"] = True
                                    
                                    if "workflow_result" in merged_state and isinstance(merged_state["workflow_result"], dict):
                                        if "rag" in merged_state["workflow_result"] and isinstance(merged_state["workflow_result"]["rag"], dict):
                                            merged_state["workflow_result"]["rag"]["response_streamed"] = True
                                    
                                    print(f"DEBUG: Marked response as streamed in merged_state")
                                    
                                except Exception as e:
                                    print(f"ERROR: Failed to stream combined response: {e}")
                                    import traceback
                                    traceback.print_exc()
                                    
                                    # Fall back to non-streaming
                                    combined_response = await chain.ainvoke({
                                        "rag_response": rag_response_str,
                                        "map_response": map_response_str
                                    })
                            else:
                                # No websocket, still generate response
                                merged_state = {
                                    "messages": [
                                        fix_message_dict_for_conversion({"role": "human", "content": query}),
                                        fix_message_dict_for_conversion({"role": "assistant", "content": combined_response})
                                    ],
                                    "chat_history": format_history([{"role": "human", "content": query}, {"role": "assistant", "content": combined_response}]),
                                    "websocket_id": websocket_id,
                                    "metadata_context": metadata_context,
                                    "map_center": map_result.get("map_center", (59.9139, 10.7522)),
                                    "zoom_level": map_result.get("zoom_level", 14),
                                    "visible_layers": map_result.get("visible_layers", []),
                                    "markers": map_result.get("markers", []),
                                    "action_taken": map_result.get("action_taken", []),
                                    "workflow_result": {"map": map_result, "rag": rag_result},
                                    "in_merged_workflow": True,
                                    "response_streamed": False
                                }
                        else:
                            # No websocket, still generate response
                            merged_state = {
                                "messages": [
                                    fix_message_dict_for_conversion({"role": "human", "content": query}),
                                    fix_message_dict_for_conversion({"role": "assistant", "content": combined_response})
                                ],
                                "chat_history": format_history([{"role": "human", "content": query}, {"role": "assistant", "content": combined_response}]),
                                "websocket_id": websocket_id,
                                "metadata_context": metadata_context,
                                "map_center": map_result.get("map_center", (59.9139, 10.7522)),
                                "zoom_level": map_result.get("zoom_level", 14),
                                "visible_layers": map_result.get("visible_layers", []),
                                "markers": map_result.get("markers", []),
                                "action_taken": map_result.get("action_taken", []),
                                "workflow_result": {"map": map_result, "rag": rag_result},
                                "in_merged_workflow": True,
                                "response_streamed": False
                            }

                        return merged_state
                    
                    except Exception as e:
                        print(f"ERROR: Failed to combine responses: {e}")
                        import traceback
                        traceback.print_exc()
                        
                        # Create a manual combined response as fallback
                        manual_combined = f"{rag_response_str}\n\n{map_response_str}"
                        
                        # Create simple messages list with user query and combined response
                        messages = []
                        for msg in state_dict.get("messages", []):
                            # Handle both dictionary and Pydantic object messages
                            if isinstance(msg, dict):
                                if msg.get("role") == "human":
                                    messages.append(fix_message_dict_for_conversion(msg))
                                    break
                            else:
                                # Handle Pydantic model messages (HumanMessage objects)
                                try:
                                    if hasattr(msg, "type") and msg.type == "human":
                                        # Convert to dictionary format for consistency
                                        messages.append(fix_message_dict_for_conversion({"role": "human", "content": msg.content}))
                                        break
                                except Exception as e:
                                    print(f"DEBUG: Error extracting content from human message: {e}")
                                    continue
                        
                        messages.append(fix_message_dict_for_conversion({"role": "assistant", "content": manual_combined}))
                        
                        # Create a merged state with the manual combined response
                        merged_state = {
                            "messages": messages,
                            "chat_history": format_history(messages),
                            "websocket_id": websocket_id,
                            "metadata_context": [],
                            "map_center": map_result.get("map_center", (59.9139, 10.7522)),
                            "zoom_level": map_result.get("zoom_level", 14),
                            "visible_layers": map_result.get("visible_layers", []),
                            "markers": map_result.get("markers", []),
                            "action_taken": map_result.get("action_taken", []),
                            "workflow_result": {"map": map_result, "rag": rag_result},
                            "in_merged_workflow": True,
                            "response_streamed": False
                        }
                        
                        return merged_state
                else:
                    # Fall back to using whichever result is available
                    if map_response:
                        print(f"DEBUG: Missing RAG response. Using map_result as default.")
                        merged_state = map_result
                        
                        # Try to preserve metadata_context from RAG result if it exists
                        if isinstance(rag_result, dict) and "metadata_context" in rag_result:
                            merged_state["metadata_context"] = rag_result.get("metadata_context", [])
                        
                        # Mark this as part of a merged workflow
                        merged_state["in_merged_workflow"] = True
                    elif rag_response:
                        print(f"DEBUG: Missing map response. Using rag_result as default.")
                        merged_state = rag_result
                        merged_state["in_merged_workflow"] = True
                    else:
                        print(f"DEBUG: Missing responses from both workflows. Creating fallback response.")
                        fallback_state["messages"].append({
                            "role": "assistant", 
                            "content": "Jeg har prosessert forespørselen din, men kunne ikke generere en fullstendig respons."
                        })
                        return fallback_state
                    
                    merged_state["workflow_result"] = {"map": map_result, "rag": rag_result}
                    return merged_state
            
            except Exception as e:
                print(f"ERROR in merge_results: {e}")
                import traceback
                traceback.print_exc()
                
                # Create a minimal fallback state to prevent further errors
                fallback_messages = []
                websocket_id = ""
                
                # Try to extract the human message and websocket_id if possible
                if isinstance(state, dict):
                    if "messages" in state:
                        for msg in state["messages"]:
                            # Handle both dictionary and Pydantic object messages
                            if isinstance(msg, dict):
                                if msg.get("role") == "human":
                                    fallback_messages.append(fix_message_dict_for_conversion(msg))
                                    break
                            else:
                                # Handle Pydantic model messages (HumanMessage objects)
                                try:
                                    if hasattr(msg, "type") and msg.type == "human":
                                        # Convert to dictionary format for consistency
                                        fallback_messages.append(fix_message_dict_for_conversion({"role": "human", "content": msg.content}))
                                        break
                                except Exception:
                                    continue
                    if "websocket_id" in state:
                        websocket_id = state["websocket_id"]
                
                fallback_messages.append(fix_message_dict_for_conversion({
                    "role": "assistant", 
                    "content": "Beklager, det oppsto en feil ved behandling av forespørselen din. Vennligst prøv igjen."
                }))
                
                return {
                    "messages": fallback_messages,
                    "chat_history": "",
                    "websocket_id": websocket_id,
                    "metadata_context": [],
                    "in_merged_workflow": True
                }
        
        # Define processing node for workflow results
        async def process_result(state):
            """Process the result from the workflow that was used."""
            print(f"DEBUG process_result: state type = {type(state)}")
            
            # Convert state to a dictionary if it's not already
            if not isinstance(state, dict):
                try:
                    if hasattr(state, "to_dict"):
                        state_dict = state.to_dict()
                    else:
                        state_dict = dict(state)
                    print(f"DEBUG: Converted state to dict with keys: {state_dict.keys()}")
                except Exception as e:
                    print(f"DEBUG: Error converting state to dict: {e}")
                    # Fallback to empty result
                    return {"messages": [{"role": "assistant", "content": "Beklager, jeg kunne ikke behandle responsen din."}]}
            else:
                state_dict = state
            
            # Create a new result dictionary with all necessary fields
            result = {
                "messages": state_dict.get("messages", []),
                "chat_history": state_dict.get("chat_history", ""),
                "websocket_id": state_dict.get("websocket_id", ""),
                "metadata_context": state_dict.get("metadata_context", []),
                "workflow_result": state_dict.get("workflow_result", state_dict)
            }
            
            print(f"DEBUG: Processed workflow result with {len(result['messages'])} messages")
            
            return result
        
        # Add nodes
        workflow.add_node("classify_query", classify_query)
        workflow.add_node("parallel_router", parallel_router)
        workflow.add_node("run_rag", run_rag)
        workflow.add_node("run_map", run_map)
        workflow.add_node("merge_results", merge_results)
        workflow.add_node("rag_workflow", self.rag_workflow.workflow)
        workflow.add_node("map_workflow", self.map_workflow.workflow)
        workflow.add_node("process_result", process_result)
        
        # Define the workflow edges
        workflow.add_edge(START, "classify_query")
        workflow.add_edge("rag_workflow", "process_result")
        workflow.add_edge("map_workflow", "process_result")
        
        # Add new edges for parallel execution
        workflow.add_edge("parallel_router", "run_rag")
        workflow.add_edge("parallel_router", "run_map")
        workflow.add_edge("run_rag", "merge_results")
        workflow.add_edge("run_map", "merge_results")
        workflow.add_edge("merge_results", "process_result")
        
        workflow.add_edge("process_result", END)
        
        return workflow.compile(checkpointer=self.memory)
    
    async def chat(self, query: str, session_id: str, websocket) -> str:
        """Main entry point for chat interactions, routes to appropriate workflow."""
        websocket_id = str(id(websocket))
        print(f"Setting up websocket with ID: {websocket_id}")
        # Make the websocket available to all components
        self.active_websockets[websocket_id] = websocket
        
        # Make sure the websocket is also available in the common module
        active_websockets[websocket_id] = websocket
        print(f"DEBUG: Registered websocket with ID {websocket_id} in active_websockets")
        print(f"DEBUG: After registration, active_websockets contains {len(active_websockets)} websocket(s): {list(active_websockets.keys())}")
        
        # Initialize or retrieve state as a dictionary
        if session_id not in self.sessions:
            print(f"Creating new conversation state for session {session_id}")
            current_state = {
                "messages": [],
                "chat_history": "",
                "websocket_id": websocket_id,
                "metadata_context": []
            }
        else:
            print(f"Using existing conversation state for session {session_id}")
            current_state = self.sessions[session_id]
            # Debug the existing state - what messages do we have?
            print(f"DEBUG: Existing state has {len(current_state.get('messages', []))} messages and chat_history of length {len(current_state.get('chat_history', ''))}")
            current_state['websocket_id'] = websocket_id
        
        # Add the user message to the state
        if 'messages' not in current_state:
            current_state['messages'] = []
        current_state['messages'].append({"role": "human", "content": query})
        current_state['chat_history'] = format_history(current_state['messages'])
        
        # Invoke the supervisor chain
        config = {"configurable": {"thread_id": session_id}}
        print(f"Invoking supervisor chain for session {session_id}")
        final_state = await self.chain.ainvoke(current_state, config=config)

        # Store the updated state for persistence between sessions
        self.sessions[session_id] = final_state
        print(f"Updated session {session_id} with new state containing {len(final_state.get('messages', []))} messages")
        
        # Debug the final state after workflow completion
        if 'messages' in final_state:
            last_messages = final_state['messages'][-min(2, len(final_state['messages'])):]
            print(f"DEBUG: Final state last messages: {[msg.get('role', 'unknown') if isinstance(msg, dict) else type(msg).__name__ for msg in last_messages]}")
        
        # Process and return the response
        last_message = "Ingen respons generert."
        if 'messages' in final_state and final_state['messages']:
            # Check the type of the last message and extract content appropriately
            last_message_obj = final_state['messages'][-1]
            
            # Handle different message types properly
            if hasattr(last_message_obj, 'content'):  # It's a BaseMessage object
                last_message = last_message_obj.content
            elif isinstance(last_message_obj, dict):  # It's a dictionary
                last_message = last_message_obj.get('content', 'Ingen respons generert.')
            else:
                # Try to convert to string as fallback
                try:
                    last_message = str(last_message_obj)
                except Exception as e:
                    print(f"ERROR: Cannot extract content from message: {e}")
                    last_message = "Kunne ikke lese meldingsinnhold."
            
            print(f"Processing response in session {session_id}")
            
            # Detailed debugging for metadata context
            print(f"DEBUG: Final state keys: {final_state.keys()}")
            
            # Check if we have metadata context in the final state or in the RAG result
            metadata_context = []
            if 'metadata_context' in final_state and final_state['metadata_context']:
                metadata_context = final_state['metadata_context']
                print(f"DEBUG: Found metadata_context in final_state with {len(metadata_context)} items")
            elif 'rag_result' in final_state and isinstance(final_state['rag_result'], dict):
                rag_metadata = final_state['rag_result'].get('metadata_context', [])
                if rag_metadata:
                    metadata_context = rag_metadata
                    print(f"DEBUG: Found metadata_context in rag_result with {len(metadata_context)} items")
            elif 'workflow_result' in final_state and isinstance(final_state['workflow_result'], dict):
                if 'rag' in final_state['workflow_result'] and isinstance(final_state['workflow_result']['rag'], dict):
                    rag_metadata = final_state['workflow_result']['rag'].get('metadata_context', [])
                    if rag_metadata:
                        metadata_context = rag_metadata
                        print(f"DEBUG: Found metadata_context in workflow_result['rag'] with {len(metadata_context)} items")
            
            # Check if we found any metadata context
            if metadata_context:
                print(f"DEBUG: First metadata item: {metadata_context[0]}")
                
                # Check for bold titles
                bold_titles = re.findall(r'\*\*(.*?)\*\*', last_message)
                print(f"DEBUG: Found {len(bold_titles)} bold titles in response: {bold_titles}")
                
                # Insert image
                print(f"Inserting image for response in session {session_id}")
                try:
                    await insert_image_rag_response(
                        last_message,
                        metadata_context,
                        websocket
                    )
                except Exception as e:
                    print(f"ERROR: Failed to insert image: {e}")
                    import traceback
                    traceback.print_exc()
            else:
                # print(f"No metadata context available for image insertion in session {session_id}")
                print("DEEZ")
        
        # The RAG workflow now handles streaming directly, so we don't need to send
        # another complete message here. We'll only do it if there was an error.
        
        # Only wait to ensure all messages are processed
        await asyncio.sleep(3)
        
        # Verify active sockets
        from .utils.common import active_websockets as common_active_websockets
        print(f"DEBUG: After processing - supervisor has {len(self.active_websockets)} websockets")
        print(f"DEBUG: After processing - common module has {len(common_active_websockets)} websockets")

        # IMPORTANT: DO NOT clean up the websocket as it's needed for streaming
        print(f"DEBUG: Keeping websocket {websocket_id} active for streaming")

        return last_message 