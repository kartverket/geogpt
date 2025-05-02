"""
Supervisor module for GeoNorge multi-agent system, managing multiple workflows.
"""
from typing import Dict, List, Optional, Any, Literal, TypedDict, Union, Tuple
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
from .message_utils import (
    fix_message_dict_for_conversion, 
    standardize_message, 
    standardize_state, 
    standardize_messages,
    get_last_message_by_role
)
import re
import asyncio
import uuid

# Define workflow configuration
WORKFLOW_CONFIG = {
    "rag": {
        "class": GeoNorgeRAGWorkflow,
        "description": "Handles information retrieval about geographic data (e.g., FKB, N50), searching for datasets, and answering factual questions about places or Geonorge/GeoGPT.",
    },
    "map": {
        "class": LeafletMapWorkflow,
        "description": "Handles map manipulations like panning, zooming, moving to locations, showing/hiding layers (e.g., topographic, satellite), adding/removing markers, or finding locations.",
    },
    # Add future workflows here
}

# Define a proper TypedDict schema for the state with channels
class SupervisorStateSchema(TypedDict, total=False):
    messages: List[Dict[str, str]]
    chat_history: str
    websocket_id: str
    metadata_context: List[Any] # May need rethinking if multiple workflows produce metadata
    results: Dict[str, Any] # Holds results from workflows { "workflow_name": result_state }
    selected_workflows: List[str] # List of workflows chosen by classifier
    # Keep map state separate for now, merge_results will handle updates
    map_center: Optional[Tuple[float, float]] 
    zoom_level: Optional[int]
    visible_layers: Optional[List[str]]
    markers: Optional[List[Any]]
    action_taken: Optional[List[str]]

class GeoNorgeSupervisor:
    """
    Supervisor for GeoNorge chatbot that manages multiple workflows dynamically.
    
    This class implements a supervisor pattern that routes user queries to
    the appropriate workflow(s) based on the query content and configuration.
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
        
        # Load workflows dynamically based on WORKFLOW_CONFIG
        self.workflows = {}
        for name, config in WORKFLOW_CONFIG.items():
            WorkflowClass = config["class"]
            # Pass specific args if defined: self.workflows[name] = WorkflowClass(**config.get("init_args", {}))
            self.workflows[name] = WorkflowClass() 
            print(f"Registered workflow: {name}")
            if not hasattr(self.workflows[name], 'workflow') or not hasattr(self.workflows[name].workflow, 'ainvoke'):
                 raise AttributeError(f"Workflow '{name}' ({WorkflowClass.__name__}) must have a compiled 'workflow' attribute with an 'ainvoke' method.")
        
        # Build the supervisor workflow
        self.chain = self._build_supervisor()
    
    def _build_supervisor(self):
        """Build the supervisor workflow that manages registered workflows dynamically."""
        
        # Use the typed dict for state schema
        workflow = StateGraph(SupervisorStateSchema)
        
        # Define supervisor node that determines which workflow(s) to use
        async def classify_query(state):
            """Analyze the query and decide which workflow(s) to use based on WORKFLOW_CONFIG."""
            print(f"DEBUG classify_query: Starting classification.")
            state_dict = standardize_state(state) # Ensure we have a dict
                
            # Ensure state has required fields
            if "messages" not in state_dict or not state_dict["messages"]:
                print("DEBUG: No messages in state, adding default")
                # Add a default message if none exist to prevent errors
                state_dict["messages"] = [{"role": "human", "content": "Hjelp meg"}]
                
            query = state_dict["messages"][-1]["content"]
            print(f"DEBUG: Query for classification: {query}")
                
            # Dynamically build the description part of the prompt
            workflow_descriptions = "\n".join([f"- {name}: {config['description']}" for name, config in WORKFLOW_CONFIG.items()])
            available_workflows = list(WORKFLOW_CONFIG.keys())
            
            # Updated prompt for selecting multiple workflows
            prompt_template = f"""
            Du er en rutingassistent for en Geonorge chatbot. Gitt en brukerforespørsel, bestem hvilke av følgende interne systemer (arbeidsflyter) som trengs for å håndtere den.
            Returner en JSON-liste med navnene på KUN de nødvendige arbeidsflytene.

            Tilgjengelige arbeidsflyter:
            {workflow_descriptions}

            Baser avgjørelsen din KUN på beskrivelsene over.
            - Hvis forespørselen krever BÅDE informasjonshenting OG kartmanipulasjon, inkluder BÅDE "rag" og "map".
            - Hvis forespørselen KUN handler om kart (panorere, zoome, vise lag, markører), bruk KUN ["map"].
            - Hvis forespørselen KUN handler om informasjonssøk (spørre om data, søke etter datasett), bruk KUN ["rag"].
            - Hvis ingen arbeidsflyt virker passende for en spesifikk geografisk/kart-relatert oppgave, returner en tom liste [].
            - For generelle samtaler, hilsener, eller spørsmål assistenten ikke kan svare på med de gitte verktøyene, bruk ["rag"].

            Eksempler:
            - "Flytt kartet til Oslo" -> ["map"]
            - "Hva er FKB data?" -> ["rag"]
            - "Vis meg skoler i Bergen på kartet og fortell meg om N50 Topo." -> ["rag", "map"]
            - "Zoom inn og vis satellittlaget" -> ["map"]
            - "Hvilke datasett finnes om skog?" -> ["rag"]
            - "Hei" -> ["rag"]
            - "Hva er været i morgen?" -> ["rag"] # Default to rag for unsupported queries

            Brukerforespørsel: {{query}}

            Returner KUN en gyldig JSON-liste med strenger (workflow names). For eksempel: ["map"], ["rag"], ["rag", "map"], [].
            """
            prompt = ChatPromptTemplate.from_messages([("system", prompt_template), ("human", "{query}")])
            
            chain = prompt | self.model | StrOutputParser()
            classification_str = await chain.ainvoke({"query": query})
            
            selected_workflows = []
            try:
                # Attempt to parse the JSON list output
                import json
                # Clean potential markdown code fences
                cleaned_str = classification_str.strip().removeprefix("```json").removesuffix("```").strip()
                selected_workflows = json.loads(cleaned_str)
                if not isinstance(selected_workflows, list) or not all(isinstance(item, str) for item in selected_workflows):
                     raise ValueError("Output is not a list of strings")
                # Filter to only valid, registered workflows
                selected_workflows = [wf for wf in selected_workflows if wf in self.workflows]
            except Exception as e:
                print(f"Error parsing classification output '{classification_str}': {e}. Defaulting to RAG.")
                selected_workflows = ["rag"] # Default if parsing fails or output is invalid

            # Fallback to RAG if the list is empty after filtering/parsing
            if not selected_workflows:
                 print("DEBUG: No valid workflows selected or returned empty list, defaulting to RAG.")
                 selected_workflows = ["rag"]

            print(f"Selected workflows: {selected_workflows}")

            # Update state with selected workflows
            state_dict["selected_workflows"] = selected_workflows
            
            # Prepare base state for next steps
            base_state = {
                "messages": state_dict["messages"],
                "chat_history": state_dict.get("chat_history", ""),
                "websocket_id": state_dict.get("websocket_id", ""),
                "selected_workflows": selected_workflows,
                # Pass existing map state forward
                "map_center": state_dict.get("map_center"),
                "zoom_level": state_dict.get("zoom_level"),
                "visible_layers": state_dict.get("visible_layers"),
                "markers": state_dict.get("markers"),
            }
            
            # Always route to the new routing node
            return Command(goto="route_execution", update=base_state)

        # --- New Nodes for Dynamic Execution ---

        async def route_execution(state):
            """Conditionally routes to single or parallel execution based on selected_workflows."""
            selected = state.get("selected_workflows", [])
            print(f"DEBUG route_execution: Routing based on {len(selected)} selected workflows.")
            if len(selected) == 1:
                return {"NEXT": "execute_single_workflow"}
            elif len(selected) > 1:
                return {"NEXT": "execute_parallel_workflows"}
            else:
                # Should not happen due to classify_query logic, but handle defensively
                print("WARNING: No workflows selected in route_execution, ending.")
                # Need a way to provide a default message here before END
                state["messages"].append({"role": "assistant", "content": "Jeg er usikker på hvordan jeg skal håndtere den forespørselen."})
                return {"NEXT": END} 

        async def execute_single_workflow(state):
            """Executes the single selected workflow."""
            state_dict = standardize_state(state)
            workflow_name = state_dict["selected_workflows"][0]
            print(f"DEBUG execute_single_workflow: Running workflow '{workflow_name}'")
            instance = self.workflows[workflow_name]
            
            # Prepare state, ensuring necessary fields and cleaning messages
            workflow_input_state = self._prepare_workflow_input(state_dict, is_parallel=False)
            
            try:
                result = await instance.workflow.ainvoke(workflow_input_state)
                # Store result directly for process_result
                state_dict["results"] = {workflow_name: standardize_state(result)}
                # Update main state with potential changes from the workflow
                # Especially map state if the map workflow ran
                updated_state = self._update_state_from_result(state_dict, result)
                return updated_state # Pass the updated state to process_result
            except Exception as e:
                 print(f"ERROR in single workflow '{workflow_name}': {e}")
                 state_dict["results"] = {workflow_name: {"error": str(e), "messages": workflow_input_state.get("messages", [])}}
                 state_dict["messages"].append({"role": "assistant", "content": f"Beklager, det oppstod en feil under kjøring av {workflow_name}: {e}"})
                 # Go directly to process_result to format the error message
                 return state_dict 

        async def execute_parallel_workflows(state):
            """Executes selected workflows in parallel using asyncio.gather."""
            state_dict = standardize_state(state)
            selected_workflows = state_dict["selected_workflows"]
            print(f"DEBUG execute_parallel_workflows: Running {selected_workflows} in parallel.")

            tasks = []
            # Prepare input state ONCE, workflows should not modify shared input during parallel run
            base_input_state = self._prepare_workflow_input(state_dict, is_parallel=True)

            for name in selected_workflows:
                instance = self.workflows[name]
                # Each workflow gets a copy of the base input state
                # NOTE: Deep copy might be safer if workflows modify input dicts, but can be slow.
                # Assuming workflows treat input as read-only for shared parts like messages.
                task_input_state = base_input_state.copy() 
                tasks.append(instance.workflow.ainvoke(task_input_state))

            results_list = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results, associating them with workflow names
            state_dict["results"] = {}
            for name, result_or_exception in zip(selected_workflows, results_list):
                if isinstance(result_or_exception, Exception):
                    print(f"ERROR in parallel workflow '{name}': {result_or_exception}")
                    state_dict["results"][name] = {"error": str(result_or_exception), "messages": base_input_state.get("messages", [])}
                else:
                    state_dict["results"][name] = standardize_state(result_or_exception)
                    print(f"DEBUG: Workflow '{name}' finished.")

            # Proceed to merge results
            return state_dict # Pass the state with populated 'results' to merge_results

        # --- Generalized Merge and Process Nodes (Need modification) ---
        
        async def merge_results(state):
            """
            Merge results from multiple workflows run in parallel by concatenating
            the map response (if any) followed by the RAG response (if any).
            """
            print("DEBUG merge_results: Starting direct concatenation merge.")
            state_dict = standardize_state(state)
            results = state_dict.get("results", {})
            websocket_id = state_dict.get("websocket_id", "")
            
            # If not enough results for merging (less than 2), pass through to process_result
            # This handles cases where only one workflow ran successfully or both failed.
            if len(results) < 2:
                print("DEBUG merge_results: Not enough results to merge, passing state to process_result.")
                # Ensure state is updated from the single result if only one succeeded
                if len(results) == 1:
                    single_result = list(results.values())[0]
                    state_dict = self._update_state_from_result(state_dict, single_result)
                # Ensure 'results' contains error info if workflows failed
                # process_result will handle formatting the final message from state['messages'] or the single result.
                return state_dict 

            map_response_content = ""
            rag_response_content = ""
            error_messages = []

            # Extract content from Map result
            if "map" in results:
                map_result = results["map"]
                if "error" not in map_result:
                    messages = standardize_messages(map_result.get("messages", []))
                    last_map_msg = get_last_message_by_role(messages, "assistant")
                    if isinstance(last_map_msg, dict):
                        map_response_content = last_map_msg.get("content", "")
                    elif isinstance(last_map_msg, str):
                         map_response_content = last_map_msg
                    # Optionally skip purely procedural map messages if desired
                    is_likely_procedural = len(map_response_content.split()) < 10 and ("kart" in map_response_content.lower() or "zoom" in map_response_content.lower() or "lag" in map_response_content.lower())
                    if is_likely_procedural:
                        print(f"DEBUG: Skipping likely procedural message from map: '{map_response_content}'")
                        map_response_content = "" # Clear it so it's not added
                else:
                    error_messages.append(f"Feil i Kart: {map_result['error']}")

            # Extract content from RAG result
            if "rag" in results:
                rag_result = results["rag"]
                if "error" not in rag_result:
                    messages = standardize_messages(rag_result.get("messages", []))
                    last_rag_msg = get_last_message_by_role(messages, "assistant")
                    if isinstance(last_rag_msg, dict):
                        rag_response_content = last_rag_msg.get("content", "")
                    elif isinstance(last_rag_msg, str):
                        rag_response_content = last_rag_msg
                else:
                    error_messages.append(f"Feil i Informasjonssøk: {rag_result['error']}")
            
            # --- Combine the content ---
            combined_parts = []
            if map_response_content:
                combined_parts.append(map_response_content)
            if rag_response_content:
                combined_parts.append(rag_response_content)
            if error_messages:
                 # Prepend error messages if both content parts are empty
                 if not combined_parts:
                      combined_parts.extend(error_messages)
                 else: # Append error messages otherwise
                      combined_parts.append("\nFeil oppstod:")
                      combined_parts.extend(error_messages)

            # Join the parts into the final response
            final_response_content = "\n\n".join(combined_parts).strip()
            
            if not final_response_content:
                final_response_content = "Beklager, jeg kunne ikke fullføre forespørselen."

            # --- Merge State (e.g., Map State, Metadata) ---
            # This helper merges map state (prioritizing map workflow) and metadata
            merged_state = self._update_state_from_results(state_dict, results) 
            
            # --- Construct Final Merged State ---
            # Use the original user query message + the new concatenated assistant response
            user_query_message = get_last_message_by_role(state_dict.get("messages", []), "human")
            final_messages = []
            if user_query_message:
                final_messages.append(user_query_message)
            final_messages.append({"role": "assistant", "content": final_response_content})

            merged_state["messages"] = final_messages
            merged_state["chat_history"] = format_history(final_messages)
            merged_state["workflow_result"] = {"merged": True, "concatenated": True, "content": final_response_content} 
            # Mark as not streamed since we removed the LLM streaming part
            merged_state["response_streamed"] = False 

            print(f"DEBUG merge_results: Concatenated response: '{final_response_content[:100]}...'")
            
            return merged_state
        
        async def process_result(state):
            """Process the final state before ending the graph."""
            print("DEBUG process_result: Processing final state before END.")
            state_dict = standardize_state(state)
            
            # Ensure essential fields are present
            final_state = {
                "messages": standardize_messages(state_dict.get("messages", [])),
                "chat_history": state_dict.get("chat_history", format_history(state_dict.get("messages", []))),
                "websocket_id": state_dict.get("websocket_id", ""),
                "metadata_context": state_dict.get("metadata_context", []),
                "map_center": state_dict.get("map_center"),
                "zoom_level": state_dict.get("zoom_level"),
                "visible_layers": state_dict.get("visible_layers", []),
                "markers": state_dict.get("markers", []),
                # Include the results dict for potential debugging on client/session storage
                "results_from_workflows": state_dict.get("results", {}), 
                # Keep the simple summary 
                "workflow_result": state_dict.get("workflow_result", {}),
                "response_streamed": state_dict.get("response_streamed", False)
            }
            
            # Add default message if somehow none exists
            if not final_state["messages"]:
                 final_state["messages"] = [{"role":"assistant", "content":"Beklager, det skjedde en feil."}]
                 final_state["chat_history"] = format_history(final_state["messages"])

            # Clean None values from top level for tidiness
            final_state = {k: v for k, v in final_state.items() if v is not None}
            
            print(f"DEBUG: Final state keys before END: {final_state.keys()}")
            
            # Ensure metadata gets handled if present
            await self._handle_metadata_image(final_state)
            
            return final_state
        
        # Add nodes
        workflow.add_node("classify_query", classify_query)
        workflow.add_node("route_execution", route_execution)
        workflow.add_node("execute_single_workflow", execute_single_workflow)
        workflow.add_node("execute_parallel_workflows", execute_parallel_workflows)
        workflow.add_node("merge_results", merge_results)
        workflow.add_node("process_result", process_result)
        
        # Define the workflow edges
        workflow.add_edge(START, "classify_query")
        workflow.add_edge("classify_query", "route_execution")
        
        # Conditional routing
        workflow.add_conditional_edges(
            "route_execution",
            lambda state: state.get("NEXT"), # Decision function reads the 'NEXT' key
            {
                "execute_single_workflow": "execute_single_workflow",
                "execute_parallel_workflows": "execute_parallel_workflows",
                 END: END # End directly if route_execution decides so
            }
        )
        
        # Edges after execution
        workflow.add_edge("execute_single_workflow", "process_result") # Single workflows go directly to processing
        workflow.add_edge("execute_parallel_workflows", "merge_results") # Parallel workflows must merge
        workflow.add_edge("merge_results", "process_result") # Merged results go to processing
        
        workflow.add_edge("process_result", END)
        
        # Compile the workflow
        return workflow.compile(checkpointer=self.memory)

    # --- Helper methods ---
    
    def _prepare_workflow_input(self, state_dict, is_parallel=False):
        """Prepares a clean state dictionary for invoking a sub-workflow."""
        # Start with essential context
        input_state = {
            "websocket_id": state_dict.get("websocket_id", ""),
            "chat_history": state_dict.get("chat_history", ""),
            "in_merged_workflow": is_parallel # Flag for sub-workflows
        }
        
        # Clean messages (similar logic to original run_rag)
        clean_messages = []
        original_messages = state_dict.get("messages", [])
        if not original_messages: # Add default if empty
             print("WARN: _prepare_workflow_input found empty messages, adding default.")
             original_messages = [{"role": "human", "content": "Hjelp meg"}]
        
        print(f"DEBUG _prepare_workflow_input: Processing {len(original_messages)} original messages.")
        for i, msg in enumerate(original_messages):
            try:
                # Standardize first to handle dicts/objects consistently
                std_msg = standardize_message(msg) 
                
                # Apply final fixes for conversion compatibility
                fixed_msg = fix_message_dict_for_conversion(std_msg)
                
                # **Crucial Check:** Ensure the message has a valid role after fixing
                if not fixed_msg or not isinstance(fixed_msg, dict) or "role" not in fixed_msg or fixed_msg["role"] not in ["human", "user", "ai", "assistant", "function", "tool", "system"]:
                    print(f"ERROR _prepare_workflow_input: Invalid message format after fixing at index {i}. Original: {msg}, Standardized: {std_msg}, Fixed: {fixed_msg}. Skipping.")
                    continue # Skip adding this invalid message
                    
                clean_messages.append(fixed_msg)
                # print(f"DEBUG _prepare_workflow_input: Added clean message {i}: {fixed_msg['role']}")
            except Exception as e:
                print(f"ERROR _prepare_workflow_input: Failed processing message at index {i}. Original: {msg}. Error: {e}. Skipping.")
                import traceback
                traceback.print_exc()
                continue

        input_state["messages"] = clean_messages
        print(f"DEBUG _prepare_workflow_input: Prepared {len(clean_messages)} clean messages.")
        if not clean_messages:
             print("ERROR _prepare_workflow_input: Resulted in an empty message list after cleaning!")
             # Add a default message again to prevent downstream errors
             input_state["messages"] = [{"role": "human", "content": "Hjelp meg"}]
        
        # Add current map state if available (workflows might need it)
        map_fields = ["map_center", "zoom_level", "visible_layers", "markers", "action_taken"]
        for field in map_fields:
             if field in state_dict and state_dict[field] is not None:
                 input_state[field] = state_dict[field]
                 
        # Add metadata context if needed by workflows (RAG uses it)
        if "metadata_context" in state_dict:
            input_state["metadata_context"] = state_dict["metadata_context"]

        # print(f"DEBUG _prepare_workflow_input: Prepared input keys: {input_state.keys()}")
        # print(f"DEBUG _prepare_workflow_input: Last message: {input_state['messages'][-1]}")
        return input_state

    def _update_state_from_result(self, current_state, workflow_result):
         """Updates the main state dictionary with relevant fields from a single workflow result."""
         if not workflow_result or "error" in workflow_result:
              return current_state # No updates if error or empty

         # Update map state if present in result
         map_fields = ["map_center", "zoom_level", "visible_layers", "markers", "action_taken"]
         for field in map_fields:
             if field in workflow_result and workflow_result[field] is not None:
                  current_state[field] = workflow_result[field]
                  
         # Update metadata context if present
         if "metadata_context" in workflow_result and workflow_result["metadata_context"]:
             # Decide strategy: replace or append? Let's replace for single workflow.
             current_state["metadata_context"] = workflow_result["metadata_context"]
             
         # Update messages/history (Process result should handle the final message construction)
         # We only updated map/metadata state here. Messages are handled by merge/process.
         
         return current_state
         
    def _update_state_from_results(self, current_state, results_dict):
        """Updates the main state based on multiple results, applying merging logic."""
        if not results_dict: return current_state

        final_map_state = {}
        final_metadata = []

        # Prioritize map state from 'map' workflow if it ran successfully
        if "map" in results_dict and "error" not in results_dict["map"]:
            map_result = results_dict["map"]
            map_fields = ["map_center", "zoom_level", "visible_layers", "markers", "action_taken"]
            for field in map_fields:
                if field in map_result and map_result[field] is not None:
                    final_map_state[field] = map_result[field]
        else:
            # Fallback: Keep existing map state if map workflow didn't run or failed
            map_fields = ["map_center", "zoom_level", "visible_layers", "markers", "action_taken"]
            for field in map_fields:
                 if field in current_state and current_state[field] is not None:
                      final_map_state[field] = current_state[field]

        # Collect metadata from all successful results (primarily RAG)
        for name, result in results_dict.items():
             if "error" not in result and "metadata_context" in result and result["metadata_context"]:
                  final_metadata.extend(result["metadata_context"])
                  
        # De-duplicate metadata if needed (simple approach based on string representation)
        unique_metadata = []
        seen_metadata = set()
        for item in final_metadata:
            item_str = str(item) # Basic string conversion for uniqueness check
            if item_str not in seen_metadata:
                unique_metadata.append(item)
                seen_metadata.add(item_str)
        
        current_state.update(final_map_state)
        current_state["metadata_context"] = unique_metadata

        return current_state
        
    async def _handle_metadata_image(self, final_state):
        """Checks for metadata and triggers image insertion if needed."""
        metadata_context = final_state.get("metadata_context", [])
        websocket_id = final_state.get("websocket_id")
        last_message_content = ""
        if final_state.get("messages"):
            last_msg = final_state["messages"][-1]
            if isinstance(last_msg, dict):
                 last_message_content = last_msg.get("content", "")
            elif hasattr(last_msg, "content"):
                 last_message_content = last_msg.content
        
        if metadata_context and websocket_id and websocket_id in self.active_websockets:
            websocket = self.active_websockets[websocket_id]
            if websocket and last_message_content:
                 print(f"DEBUG: Found {len(metadata_context)} metadata items. Checking for image insertion.")
                 try:
                     await insert_image_rag_response(
                         last_message_content,
                         metadata_context,
                         websocket
                     )
                 except Exception as e:
                     print(f"ERROR: Failed to insert image in _handle_metadata_image: {e}")
                     import traceback
                     traceback.print_exc()
            else:
                 print("DEBUG: No websocket object or last message content for image insertion.")
        # else:
        #      print("DEBUG: No metadata context or websocket for image insertion.")

    # chat method needs update to handle final state structure
    async def chat(self, query: str, session_id: str, websocket) -> str:
        """Main entry point for chat interactions, uses the dynamically built supervisor."""
        websocket_id = str(id(websocket))
        # print(f"Setting up websocket with ID: {websocket_id}")
        self.active_websockets[websocket_id] = websocket
        active_websockets[websocket_id] = websocket # Update common dict too
        # print(f"DEBUG: Registered websocket {websocket_id}. Total active: {len(active_websockets)}")
        
        # Initialize or retrieve state as a dictionary
        if session_id not in self.sessions:
            print(f"Creating new conversation state for session {session_id}")
            # Initialize with map defaults if needed
            initial_state = {
                "messages": [],
                "chat_history": "",
                "websocket_id": websocket_id,
                "metadata_context": [],
                "map_center": (59.9139, 10.7522), # Oslo default
                "zoom_level": 14,
                "visible_layers": [],
                "markers": []
                # results and selected_workflows will be populated by the graph
            }
        else:
            print(f"Using existing conversation state for session {session_id}")
            initial_state = self.sessions[session_id]
            # Ensure websocket_id is updated for the current connection
            initial_state['websocket_id'] = websocket_id
            # Ensure messages list exists
            if 'messages' not in initial_state: initial_state['messages'] = []
            # print(f"DEBUG: Existing state has {len(initial_state.get('messages', []))} messages.")
        
        # Add the user message
        initial_state['messages'].append({"role": "human", "content": query})
        # Update chat history immediately for context
        initial_state['chat_history'] = format_history(initial_state['messages']) 
        
        # Invoke the supervisor chain
        config = {"configurable": {"thread_id": session_id}}
        print(f"Invoking supervisor chain for session {session_id}")
        
        # Ensure state passed to invoke is clean
        state_to_invoke = standardize_state(initial_state) 

        final_state = await self.chain.ainvoke(state_to_invoke, config=config)

        # Store the updated state (returned by process_result)
        self.sessions[session_id] = final_state
        # print(f"Updated session {session_id} state keys: {final_state.keys()}")
        
        # Extract the final assistant message content
        last_message_content = "Ingen respons generert."
        if final_state and 'messages' in final_state and final_state['messages']:
            # Get the last message (should be assistant's response)
            last_message_obj = final_state['messages'][-1]
            std_msg = standardize_message(last_message_obj) # Handle dict/BaseMessage
            if std_msg.get("role") == "assistant":
                last_message_content = std_msg.get('content', 'Ingen respons generert.')
            else:
                # Should not happen, but find the last assistant message if possible
                last_assistant_msg = get_last_message_by_role(final_state['messages'], "assistant")
                if last_assistant_msg:
                     last_message_content = last_assistant_msg.get('content', 'Ingen respons generert.')
                else:
                     print("WARNING: Final state has messages, but the last one isn't from the assistant.")

        # Image insertion is now handled within process_result before END
        
        # If response was streamed, we don't need to return the full content here
        # unless it's needed for non-websocket clients.
        # The streaming happens in merge_results or potentially within workflows.
        # Let's return the final content anyway for consistency / non-websocket use cases.
        
        print(f"DEBUG: chat method returning final message content.")
        
        # Add a small delay ONLY IF streaming didn't happen, to allow websocket buffer to clear?
        # This seems unreliable. Let's rely on the streaming logic completing.
        # if not final_state.get("response_streamed", False):
        #      await asyncio.sleep(0.1) 

        # print(f"DEBUG: Final check - supervisor has {len(self.active_websockets)} websockets")
        # print(f"DEBUG: Final check - common module has {len(active_websockets)} websockets")

        # DO NOT clean up websocket here; needed for potential future interactions/streaming.
        # print(f"DEBUG: Keeping websocket {websocket_id} active.")

        return last_message_content 