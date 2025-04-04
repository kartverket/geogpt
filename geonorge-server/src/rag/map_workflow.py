"""
Leaflet map interaction workflow for GeoNorge.
"""
from typing import Dict, List, Optional, Tuple, Annotated, Literal, TypedDict, Any, Sequence
from dataclasses import dataclass, field
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, END, StateGraph
from langgraph.types import Command

from llm import LLMManager
from langchain.prompts import ChatPromptTemplate
from langchain.schema import StrOutputParser
from pydantic import BaseModel, Field
from langchain.tools import StructuredTool
from langchain.schema.messages import ToolMessage
from helpers.websocket import send_websocket_message
from langchain_core.messages import BaseMessage
from .utils.common import register_websockets_dict, format_history, get_websocket, active_websockets
from .utils.tool_utils import ToolExecutor, ToolInvocation 
import json

# Initialize LLM
llm_manager = LLMManager()
llm = llm_manager.get_main_llm()

# Define a state class for map interactions
class MapState(TypedDict, total=False):
    """
    Manages the state of a map interaction session.
    """
    messages: Sequence[BaseMessage]
    chat_history: str
    map_center: Tuple[float, float]  
    zoom_level: int
    visible_layers: List[str]
    markers: List[Dict]
    websocket_id: Optional[str]
    action_taken: Optional[List[str]]
    add_marker_at_location: bool
    in_merged_workflow: bool

# Added global persistent state storage
persistent_map_states = {}

# Create wrapper function that handles state conversion, merging with persistent state.
def with_map_state_handling(node_func):
    """Wrap a map node function with state handling logic."""
    async def wrapped(state):
        print(f"DEBUG Map {node_func.__name__}: state type = {type(state)}")
        
        # Check if in_merged_workflow flag is set in the incoming state
        if isinstance(state, dict) and "in_merged_workflow" in state:
            print(f"DEBUG Map {node_func.__name__}: in_merged_workflow flag found in input state = {state['in_merged_workflow']}")
        elif hasattr(state, "in_merged_workflow"):
            print(f"DEBUG Map {node_func.__name__}: in_merged_workflow flag found in input object = {state.in_merged_workflow}")
        else:
            print(f"DEBUG Map {node_func.__name__}: in_merged_workflow flag NOT found in input state")
        
        # Determine websocket id if available
        ws_id = None
        if isinstance(state, dict):
            ws_id = state.get("websocket_id")
        elif hasattr(state, "websocket_id"):
            ws_id = state.websocket_id
            
        # Special handling for router-returned states
        if isinstance(state, dict) and "NEXT" in state:
            # Preserve the NEXT key but continue with state handling
            has_next = True
            next_value = state["NEXT"]
            # Remove temporarily to avoid interference with state merging
            state_without_next = {k: v for k, v in state.items() if k != "NEXT"}
        else:
            has_next = False
            state_without_next = state
        
        # Merge incoming state with persistent state if available
        if ws_id and ws_id in persistent_map_states:
            prev_state = persistent_map_states[ws_id]
            if isinstance(state_without_next, dict):
                merged_state = {**prev_state, **state_without_next}
            else:
                state_dict = {}
                for k in MapState.__annotations__.keys():
                    if hasattr(state_without_next, k):
                        state_dict[k] = getattr(state_without_next, k)
                merged_state = {**prev_state, **state_dict}
        else:
            if isinstance(state_without_next, dict):
                merged_state = state_without_next
            else:
                merged_state = {}
                for k in MapState.__annotations__.keys():
                    if hasattr(state_without_next, k):
                        merged_state[k] = getattr(state_without_next, k)
        
        # Add back the NEXT key if it was present
        if has_next:
            merged_state["NEXT"] = next_value
            
        # Debug: Check if in_merged_workflow flag survived merging
        print(f"DEBUG Map {node_func.__name__}: in_merged_workflow flag in merged state = {merged_state.get('in_merged_workflow', False)}")
        
        # Ensure state has default values
        if "map_center" not in merged_state:
            merged_state["map_center"] = (59.9139, 10.7522)  # Default to Oslo
        if "zoom_level" not in merged_state:
            merged_state["zoom_level"] = 14
        if "visible_layers" not in merged_state:
            merged_state["visible_layers"] = []
        if "markers" not in merged_state:
            merged_state["markers"] = []
        if "action_taken" not in merged_state:
            merged_state["action_taken"] = []
            
        # Explicitly check and handle in_merged_workflow flag
        if isinstance(state_without_next, dict) and "in_merged_workflow" in state_without_next:
            merged_state["in_merged_workflow"] = state_without_next["in_merged_workflow"]
            print(f"DEBUG Map {node_func.__name__}: Explicitly set in_merged_workflow to {merged_state['in_merged_workflow']}")
        elif hasattr(state_without_next, "in_merged_workflow"):
            merged_state["in_merged_workflow"] = state_without_next.in_merged_workflow
            print(f"DEBUG Map {node_func.__name__}: Explicitly set in_merged_workflow from object to {merged_state['in_merged_workflow']}")
        
        # Process the state with the node function
        result_state = await node_func(merged_state)
        
        # Update persistent state with the new state for future requests
        if ws_id:
            # Don't store the NEXT key in persistent state
            if isinstance(result_state, dict) and "NEXT" in result_state:
                persistent_state = {k: v for k, v in result_state.items() if k != "NEXT"}
                persistent_map_states[ws_id] = persistent_state
            else:
                persistent_map_states[ws_id] = result_state
        
        return result_state
    
    # Preserve original function name and docstring
    wrapped.__name__ = node_func.__name__
    wrapped.__doc__ = node_func.__doc__
    return wrapped

# Define tool input schemas
class LocationInput(BaseModel):
    """Input schema for panMap tool"""
    location: str = Field(description="The location name to pan the map to")

class ZoomInput(BaseModel):
    """Input schema for zoomMap tool"""
    level: int = Field(description="The zoom level to set (1-18)")
    
class LayersInput(BaseModel):
    """Input schema for toggleLayers tool"""
    layers: List[str] = Field(description="List of layer names to show")
    action: str = Field(description="Action to take: 'show', 'hide', or 'clear'")
    
class MarkersInput(BaseModel):
    """Input schema for addMarkers tool"""
    locations: List[str] = Field(description="List of locations to mark")
    clear: bool = Field(description="Whether to clear existing markers first", default=False)

class MyLocationInput(BaseModel):
    """Input schema for findMyLocation tool"""
    zoom_level: int = Field(description="The zoom level to set when finding location", default=14)
    add_marker: bool = Field(description="Whether to add a marker at the user's location", default=False)

# Define tool implementations
async def pan_to_location(location: str) -> Tuple[float, float]:
    """Pan the map to a specified location."""
    # Common Norwegian cities with coordinates
    city_coordinates = {
        "oslo": (59.9139, 10.7522),
        "bergen": (60.3913, 5.3221),
        "trondheim": (63.4305, 10.3951),
        "stavanger": (58.9700, 5.7331),
        "tromsø": (69.6492, 18.9553),
        "kristiansand": (58.1599, 8.0182),
        "drammen": (59.7440, 10.2045),
        "fredrikstad": (59.2181, 10.9298),
        "sandnes": (58.8534, 5.7317),
        "bodø": (67.2804, 14.4051)
    }
    
    # Check if the location is a known city (case insensitive)
    normalized_location = location.lower().strip()
    if normalized_location in city_coordinates:
        coords = city_coordinates[normalized_location]
        print(f"Using hardcoded coordinates for {location}: {coords}")
        return coords
    
    # If not a known city, use LLM to extract location information
    print(f"Querying LLM for coordinates of: {location}")
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Ekstraher stedsinformasjon fra brukerens spørsmål.
        For kjente norske byer, returner koordinater i følgende format: [breddegrad, lengdegrad]
        
        Eksempler:
        - Oslo: [59.9139, 10.7522]
        - Bergen: [60.3913, 5.3221]
        - Trondheim: [63.4305, 10.3951]
        - Stavanger: [58.9700, 5.7331]
        - Tromsø: [69.6492, 18.9553]
        
        For mindre kjente steder eller steder utenfor Norge, gjør ditt beste for å gi omtrentlige koordinater.
        Returner resultatet som et array med to tall: [breddegrad, lengdegrad]
        """),
        ("human", "{location}")
    ])
    
    chain = prompt | llm | StrOutputParser()
    location_result = await chain.ainvoke({"location": location})
    
    print(f"LLM response for {location}: {location_result}")
    
    try:
        # Parse the coordinates
        coords_str = location_result.strip()
        # Extract numbers from the string
        import re
        coords = re.findall(r'[-+]?\d*\.\d+|\d+', coords_str)
        if len(coords) >= 2:
            # Convert to float
            lat = float(coords[0])
            lng = float(coords[1])
            print(f"Successfully extracted coordinates: [{lat}, {lng}]")
            return (lat, lng)
        else:
            print(f"Could not extract coordinates from: {coords_str}")
            # Check if the response contains any city name we know
            for city, coords in city_coordinates.items():
                if city in coords_str.lower():
                    print(f"Found city name {city} in response, using its coordinates")
                    return coords
            
            # Default to Oslo if we can't extract or match anything
            print(f"Defaulting to Oslo coordinates")
            return (59.9139, 10.7522)
    except Exception as e:
        print(f"Error parsing coordinates: {e}")
        return (59.9139, 10.7522)  # Default to Oslo

async def set_zoom_level(level: int) -> int:
    """Set the zoom level of the map."""
    try:
        # Get current websocket id from the caller's context
        # This is a rough solution since we don't have direct access to state here
        # In a real solution, you would pass the current state or zoom level directly
        websocket_id = None
        for ws_id, state in persistent_map_states.items():
            # Take the first active websocket state we find
            websocket_id = ws_id
            break
            
        # Get current zoom level from persistent state if available
        current_zoom = 14  # Default
        if websocket_id and websocket_id in persistent_map_states:
            current_zoom = persistent_map_states[websocket_id].get("zoom_level", 14)
        
        # Handle string inputs like "increase" or "decrease"
        if isinstance(level, str):
            if level.lower() in ["increase", "zoom in", "in"]:
                # Increase by 2 levels
                new_zoom = current_zoom + 2
            elif level.lower() in ["decrease", "zoom out", "out"]:
                # Decrease by 2 levels
                new_zoom = current_zoom - 2
            else:
                # Try to convert string to int if possible
                try:
                    new_zoom = int(level)
                except ValueError:
                    print(f"Could not convert string '{level}' to integer, using default zoom")
                    new_zoom = current_zoom
        else:
            # Numeric input - use directly
            new_zoom = level
            
        # Ensure zoom is within valid range
        new_zoom = max(1, min(18, new_zoom))
        print(f"Setting zoom level to: {new_zoom}")
        return new_zoom
    except ValueError as e:
        print(f"Error setting zoom level: {e}")
        return 14  # Default zoom level

async def toggle_layers(layers: List[str], action: str) -> List[str]:
    """Show or hide map layers."""
    # Define available layers
    available_layers = [
        "topographic", 
        "satellite", 
        "terrain", 
        "administrative", 
        "roads", 
        "buildings", 
        "water",
        "forests"
    ]
    
    # Filter to only include valid layers
    valid_layers = [layer for layer in layers if layer.lower() in available_layers]
    
    if action.lower() == "clear":
        print("Clearing all layers")
        return []
    else:
        print(f"Updated layers: {valid_layers}")
        return valid_layers

async def add_markers(locations: List[str], clear: bool = False) -> List[Dict]:
    """Add markers to the map."""
    if not locations and clear:
        print("Clearing all markers")
        return []
    
    markers = []
    for location in locations:
        try:
            # Get coordinates for the location
            coords = await pan_to_location(location)
            markers.append({
                "lat": coords[0],
                "lng": coords[1],
                "label": location
            })
        except Exception as e:
            print(f"Error creating marker for {location}: {e}")
    
    print(f"Added markers: {markers}")
    return markers

async def find_my_location(zoom_level: int = 14, add_marker: bool = False):
    """Find the user's location and center the map there."""
    print(f"Finding user location with zoom level {zoom_level}")
    print(f"Adding marker at user location: {add_marker}")
    
    # This function will return a JSON object indicating the action to take
    # The actual location finding will happen client-side
    return {
        "zoom_level": zoom_level,
        "addMarker": add_marker
    }

# Create structured tools
pan_map_tool = StructuredTool.from_function(
    func=pan_to_location,
    name="PanMap",
    description="Pan the map to a specific location",
    args_schema=LocationInput,
    return_direct=False,
)

zoom_map_tool = StructuredTool.from_function(
    func=set_zoom_level,
    name="ZoomMap",
    description="Set zoom level of the map with a number between 1 and 18",
    args_schema=ZoomInput,
    return_direct=False,
)

layers_tool = StructuredTool.from_function(
    func=toggle_layers,
    name="ToggleLayers",
    description="Show or hide map layers",
    args_schema=LayersInput,
    return_direct=False,
)

markers_tool = StructuredTool.from_function(
    func=add_markers,
    name="AddMarkers",
    description="Add markers to the map",
    args_schema=MarkersInput,
    return_direct=False,
)

my_location_tool = StructuredTool.from_function(
    func=find_my_location,
    name="FindMyLocation",
    description="Find the user's current location and center the map on it",
    args_schema=MyLocationInput,
    return_direct=False,
)

# Create tool executor with all tools
map_tools = [pan_map_tool, zoom_map_tool, layers_tool, markers_tool, my_location_tool]
tool_executor = ToolExecutor(map_tools)

# Define the function to determine whether to continue the agent-action cycle
def get_next_node(state: Dict) -> str:
    """Determine the next node in the workflow based on the message history."""
    messages = state.get("messages", [])
    
    if not messages:
        return "end"
    
    last_message = messages[-1]
    
    if last_message.get("role") == "human":
        return "agent"
    if last_message.get("role") == "assistant" and last_message.get("additional_kwargs", {}).get("tool_calls"):
        return "tools" 
    if last_message.get("role") == "tool":
        return "response"
    if last_message.get("role") == "assistant":
        return "response"
    
    return "end"  # Default to end

async def router(state: Dict) -> Dict:
    """Simple pass-through router that preserves state."""
    # No modifications to state needed
    return state

# Define the function that creates the prompt and calls the model
async def call_model(state: Dict) -> Dict:
    """Analyze the query and generate tool calls using the LLM."""
    print(f"Calling model with state: {state.keys()}")
    
    # Ensure there are messages
    messages = state.get("messages", [])
    if not messages:
        # No user query present, return unchanged state
        print("No messages found in state")
        return state
    
    # Get the latest user query
    latest_user_query = None
    for message in reversed(messages):
        if message.get("role") == "human":
            latest_user_query = message.get("content")
            break
    
    if not latest_user_query:
        print("No user query found")
        return state
    
    # Create system prompt for tool calling
    system_prompt = """Du er en kartassistent som hjelper brukere med å navigere kart.
    
    Basert på brukerens forespørsel, bestem hvilke karthandlinger som skal utføres og returner dem i JSON-format.
    
    Tilgjengelige verktøy:
    1. "PanMap" - Flytter kartet til en spesifisert lokasjon
       Format: {{"tool": "PanMap", "params": {{"location": "stedsnavnet"}}}}
       
    2. "ZoomMap" - Setter zoom-nivået på kartet (1-18)
       Format: {{"tool": "ZoomMap", "params": {{"level": zoom_level}}}}
       VIKTIG: "level" må være et heltall mellom 1 og 18, IKKE en streng som "increase" eller "decrease".
       
    3. "ToggleLayers" - Viser eller skjuler kartlag
       Format: {{"tool": "ToggleLayers", "params": {{"layers": ["lag1", "lag2"], "action": "show/hide/clear"}}}}
       
    4. "AddMarkers" - Legger til markører på kartet
       Format: {{"tool": "AddMarkers", "params": {{"locations": ["sted1", "sted2"], "clear": true/false}}}}
       
    5. "FindMyLocation" - Finner brukerens nåværende posisjon og sentrerer kartet på den
       Format: {{"tool": "FindMyLocation", "params": {{"zoom_level": 14, "add_marker": true/false}}}}
       Du kan også bruke add_marker parameteren for å legge til en markør på brukerens posisjon.
    
    Analyser brukerens forespørsel og returner en JSON-array med verktøykall som skal utføres.
    Eksempel: [{{"tool": "PanMap", "params": {{"location": "Oslo"}}}}, {{"tool": "ZoomMap", "params": {{"level": 14}}}}]
    
    Du kan kjenne igjen disse handlingene:
    - Panorering: Når brukeren vil se et spesifikt sted (f.eks. "vis meg Oslo", "ta meg til Bergen")
    - Zooming: Når brukeren vil zoome inn eller ut (f.eks. "zoom til nivå 16", "zoom inn")
    - Kartlag: Når brukeren vil endre kartlag (f.eks. "vis satelittbilde", "skjul administrative grenser")
    - Markører: Når brukeren vil markere steder (f.eks. "marker Oslo og Bergen", "fjern alle markører")
    - Min posisjon: 
      * Når brukeren vil finne sin egen posisjon (f.eks. "finn min posisjon", "vis hvor jeg er")
      * Når brukeren vil legge til en markør på sin posisjon (f.eks. "sett markør på min lokasjon", "marker hvor jeg er")
    """
    
    # Create tool calling prompt
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{query}")
    ])
    
    # Use the LLM to generate tool calls
    model = llm_manager.get_main_llm()
    chain = prompt | model | StrOutputParser()
    json_response = await chain.ainvoke({"query": latest_user_query})
    print(f"Raw LLM JSON response: {json_response}")
    
    try:
        # Clean up the response - remove markdown code blocks and backticks
        cleaned_response = json_response.replace("```json", "").replace("```", "").strip()
        print(f"Cleaned response: {cleaned_response}")
        
        # Try several approaches to extract valid JSON
        tool_calls_json = []
        
        # First attempt: Try to parse the entire response as JSON directly
        try:
            parsed_json = json.loads(cleaned_response)
            if isinstance(parsed_json, list):
                tool_calls_json = parsed_json
            elif isinstance(parsed_json, dict) and "tool" in parsed_json:
                tool_calls_json = [parsed_json]
            print(f"Successfully parsed full response as JSON: {tool_calls_json}")
        except json.JSONDecodeError:
            # Second attempt: Look for JSON array in the response
            array_match = re.search(r'\[(.*?)\]', cleaned_response.replace('\n', ' '), re.DOTALL)
            if array_match:
                try:
                    extracted_array = f"[{array_match.group(1)}]"
                    tool_calls_json = json.loads(extracted_array)
                    print(f"Successfully parsed JSON array: {tool_calls_json}")
                except json.JSONDecodeError:
                    print(f"Failed to parse JSON array: {extracted_array}")
            
            # Third attempt: Look for individual JSON objects if array parsing failed
            if not tool_calls_json:
                # Find all JSON objects in the text
                import re
                object_matches = re.finditer(r'\{(?:[^{}]|(?:\{[^{}]*\}))*\}', cleaned_response, re.DOTALL)
                for match in object_matches:
                    try:
                        obj = json.loads(match.group(0))
                        if "tool" in obj and "params" in obj:
                            tool_calls_json.append(obj)
                            print(f"Successfully parsed JSON object: {obj}")
                    except json.JSONDecodeError:
                        continue
        
        # Create tool calls array for the assistant message
        tool_calls = []
        for i, tool_call in enumerate(tool_calls_json):
            tool_name = tool_call.get("tool")
            params = tool_call.get("params", {})
            
            if not tool_name:
                continue
                
            tool_calls.append({
                "id": f"call_{i}",
                "function": {
                    "name": tool_name,
                    "arguments": json.dumps(params)
                }
            })
        
        print(f"Created {len(tool_calls)} tool calls: {tool_calls}")
        
        # Create a new assistant message with the tool calls
        assistant_message = {
            "role": "assistant",
            "content": json_response,
            "additional_kwargs": {
                "tool_calls": tool_calls
            }
        }
        
        # Add the message to the state
        messages.append(assistant_message)
        state["messages"] = messages
        
    except Exception as e:
        print(f"Error generating tool calls: {e}")
        import traceback
        traceback.print_exc()
        # Create an empty assistant message with no tool calls
        messages.append({
            "role": "assistant",
            "content": "Jeg forstår ikke hva du vil jeg skal gjøre med kartet.",
            "additional_kwargs": {"tool_calls": []}
        })
        state["messages"] = messages
    
    return state

# Define the function to execute tools
async def call_tools(state: Dict) -> Dict:
    """Execute the tool calls generated by the model."""
    print(f"Executing tools with state: {state.keys()}")
    
    messages = state.get("messages", [])
    if not messages:
        return state
    
    # Get the last message with tool calls
    last_message = messages[-1]
    if "additional_kwargs" not in last_message or "tool_calls" not in last_message["additional_kwargs"]:
        print("No tool calls found in the last message")
        return state
    
    # Track map state for applying changes
    map_center = state.get("map_center", (59.9139, 10.7522))
    zoom_level = state.get("zoom_level", 14)
    visible_layers = state.get("visible_layers", [])[:]
    markers = state.get("markers", [])[:]
    action_taken = []
    
    # Execute each tool call
    for tool_call in last_message["additional_kwargs"]["tool_calls"]:
        try:
            # Create tool invocation
            action = ToolInvocation(
                tool=tool_call["function"]["name"],
                tool_input=json.loads(tool_call["function"]["arguments"]),
                id=tool_call["id"],
            )
            
            # Track the action
            action_taken.append(action.tool)
            print(f"Executing tool: {action.tool} with arguments: {action.tool_input}")
            
            # Call the appropriate tool function
            tool_name = action.tool
            if tool_name == "PanMap":
                result = await pan_to_location(**action.tool_input)
                map_center = result
            elif tool_name == "ZoomMap":
                result = await set_zoom_level(**action.tool_input)
                zoom_level = result
            elif tool_name == "ToggleLayers":
                result = await toggle_layers(**action.tool_input)
                visible_layers = result
            elif tool_name == "AddMarkers":
                result = await add_markers(**action.tool_input)
                if action.tool_input.get("clear", False):
                    markers = result
                else:
                    markers.extend(result)
            elif tool_name == "FindMyLocation":
                # Call the find my location function with the zoom level
                zoom_level = action.tool_input.get("zoom_level", 14)
                add_marker = action.tool_input.get("add_marker", False)
                result = await find_my_location(zoom_level, add_marker)
                
                # Note: The actual update to map_center will happen when the client responds
                print(f"Find my location tool called with zoom level {zoom_level} and add_marker: {add_marker}")
                
                # Add the FindMyLocation action to the list of actions taken
                action_taken.append("FindMyLocation")
                # Store the add_marker parameter in the state
                state["add_marker_at_location"] = add_marker
            else:
                raise ValueError(f"Unknown tool: {tool_name}")
            
            # Create a tool message
            tool_message = {
                "role": "tool",
                "tool_call_id": tool_call["id"],
                "name": action.tool,
                "content": str(result)
            }
            
            # Add the tool message to the state
            messages.append(tool_message)
            
        except Exception as e:
            print(f"Error executing tool {tool_call['function']['name']}: {e}")
            import traceback
            traceback.print_exc()
    
    # Update the state with the new map state
    state["messages"] = messages
    state["map_center"] = map_center
    state["zoom_level"] = zoom_level
    state["visible_layers"] = visible_layers
    state["markers"] = markers
    state["action_taken"] = action_taken
    
    return state

# Function to generate a response after tools have been executed
async def generate_response(state: Dict) -> Dict:
    """Generate a response based on the map actions taken."""
    print(f"Generating response with state: {state.keys()}")
    
    messages = state.get("messages", [])
    if not messages:
        return state
    
    # Find the latest user query
    latest_query = None
    for msg in reversed(messages):
        if msg.get("role") == "human":
            latest_query = msg.get("content")
            break
    
    if not latest_query:
        latest_query = "Vis meg kartet"
    
    # Find the location name from PanMap tool calls
    location_name = None
    actions = state.get("action_taken", [])
    
    if "PanMap" in actions:
        for msg in reversed(messages):
            if msg.get("role") == "tool" and msg.get("name") == "PanMap":
                # Find the corresponding tool call to get the original location name
                for prev_msg in reversed(messages):
                    if prev_msg.get("role") == "assistant" and "tool_calls" in prev_msg.get("additional_kwargs", {}):
                        for tool_call in prev_msg["additional_kwargs"]["tool_calls"]:
                            if tool_call["function"]["name"] == "PanMap":
                                try:
                                    location_args = json.loads(tool_call["function"]["arguments"])
                                    location_name = location_args.get("location")
                                    print(f"Found location in tool call: {location_name}")
                                    break
                                except Exception as e:
                                    print(f"Error extracting location: {e}")
                        if location_name:
                            break
                break
    
    # Create a response prompt template
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Du er en kartassistent. Generer et svar som forklarer hvilke endringer som ble gjort med kartet.
        
        Handlinger utført: {actions}
        Kartsentrum: {map_center}
        Lokasjon: {location}
        Zoom-nivå: {zoom_level}
        Synlige lag: {visible_layers}
        Markører: {markers}
        
        Hold svaret kort og konsist, men naturlig og hjelpsomt. Unngå tekniske detaljer med mindre brukeren spør spesifikt om det.
        Det er VELDIG viktig at du nevner den korrekte lokasjonen som kartet nå er sentrert på.
        """),
        ("human", "{query}")
    ])
    
    # Generate the response
    chain = prompt | llm | StrOutputParser()
    response = await chain.ainvoke({
        "query": latest_query,
        "actions": ", ".join(actions) if actions else "info",
        "map_center": state.get("map_center", (59.9139, 10.7522)),
        "location": location_name or "kartet",
        "zoom_level": state.get("zoom_level", 14),
        "visible_layers": state.get("visible_layers", []) or "ingen",
        "markers": state.get("markers", []) or "ingen"
    })
    
    # Add the response to the messages
    messages.append({"role": "assistant", "content": response})
    state["messages"] = messages
    state["chat_history"] = format_history(messages)
    
    return state

# Function to send map updates to the client
async def send_map_update(state: Dict) -> Dict:
    """Send the map update to the frontend via websocket."""
    print(f"Sending map update with state: {state.keys()}")
    
    is_mixed_workflow = state.get("in_merged_workflow", False)
    print(f"DEBUG send_map_update: in_merged_workflow flag = {is_mixed_workflow}")
    
    websocket_id = state.get("websocket_id")
    if not websocket_id:
        print("No websocket ID found in state")
        return state
        
    websocket = active_websockets.get(websocket_id)
    
    if websocket:
        action_taken = state.get("action_taken", [])
        map_data = {}
        
        # Check if PanMap was used
        if "PanMap" in action_taken:
            map_data["center"] = state.get("map_center", None)
        
        # Check if ToggleLayers was used
        if "ToggleLayers" in action_taken:
            map_data["layers"] = state.get("visible_layers", None)
            map_data["layerAction"] = state.get("layer_action", None)
            
        # Check if AddMarkers was used
        if "AddMarkers" in action_taken:
            map_data["markers"] = state.get("markers", None)
            map_data["clearMarkers"] = state.get("clear_markers", False)
        
        # Check if FindMyLocation was used
        if "FindMyLocation" in action_taken:
            map_data["findMyLocation"] = True
            if "add_marker_at_location" in state:
                map_data["addMarker"] = state.get("add_marker_at_location", False)
                
        # --- REVISED LOGIC FOR ZOOM ---
        # Determine if the zoom level should be sent
        zoom_explicitly_set = "ZoomMap" in action_taken
        panned_without_zoom = "PanMap" in action_taken and not zoom_explicitly_set
        
        should_send_zoom = zoom_explicitly_set or panned_without_zoom
        
        if should_send_zoom:
             current_zoom = state.get("zoom_level", 12) # Get the current zoom from state
             map_data["zoom"] = current_zoom
             print(f"DEBUG send_map_update: Including zoom level {current_zoom} in update. Reason: explicit_zoom={zoom_explicitly_set}, panned_default_zoom={panned_without_zoom}")
        else:
             print(f"DEBUG send_map_update: Not including zoom level in update. Actions taken: {action_taken}")
        # --- END REVISED LOGIC ---

        print(f"Sending map update: {map_data}")
        
        # Only send if there's actual map data to send
        if map_data:
            try:
                print(f"DEBUG: Sending map update with data: {map_data}")
                await send_websocket_message("mapUpdate", map_data, websocket)
                print(f"DEBUG: Successfully sent map update to websocket {websocket_id}")
            except Exception as e:
                print(f"ERROR: Failed to send map update: {e}")
                import traceback
                traceback.print_exc()
        else:
             print("DEBUG send_map_update: No map data changes detected, skipping mapUpdate message.")

        # --- REST OF THE FUNCTION (chat message handling) ---
        # Only send chat response if not in mixed workflow
        if not is_mixed_workflow:
            print(f"DEBUG send_map_update: Not in mixed workflow, sending chat message if available.")
            messages = state.get("messages", [])
            if messages:
                # Find the latest assistant message that is not a tool call
                assistant_response_content = None
                for m in reversed(messages):
                    is_assistant = False
                    is_tool_call = False
                    content = None
                    
                    if isinstance(m, dict):
                        is_assistant = m.get("role") == "assistant"
                        is_tool_call = "tool_calls" in m.get("additional_kwargs", {})
                        content = m.get("content")
                    else: # Assuming BaseMessage object
                        try:
                             is_assistant = hasattr(m, "type") and m.type == "ai"
                             is_tool_call = hasattr(m, "tool_calls") and m.tool_calls
                             content = m.content if hasattr(m, "content") else None
                        except Exception:
                            pass # Ignore objects we can't inspect easily
                            
                    if is_assistant and not is_tool_call and content:
                        assistant_response_content = content
                        break # Found the latest relevant response

                if assistant_response_content:
                    print(f"DEBUG: Streaming assistant response: {assistant_response_content}")
                    # Stream the message
                    await send_websocket_message("chatStream", {"payload": assistant_response_content, "isNewMessage": True}, websocket)
                    # Signal completion
                    await send_websocket_message("streamComplete", {}, websocket)
                else:
                    print("DEBUG: No assistant message found to stream")
            else:
                print("DEBUG: No messages found to stream")
        else:
            print(f"DEBUG: Suppressing map chat response in mixed workflow mode")
            # Optional: Log the message that would have been sent
            # ... (similar logic as above to find the assistant message)

    else:
        print(f"ERROR: No websocket found for ID: {websocket_id}")
        print(f"DEBUG: Available websocket IDs: {list(active_websockets.keys())}")
    
    return state

class LeafletMapWorkflow:
    """
    Workflow for Leaflet map interactions in GeoNorge chatbot.
    
    This class manages the map interaction workflow, handling operations
    like panning, zooming, and managing markers and layers.
    """
    
    def __init__(self):
        self.memory = MemorySaver()
        self.active_websockets = {}
        
        # Register the websockets dictionary with the nodes module
        register_websockets_dict(self.active_websockets)
        
        # Build the map workflow
        self.workflow = self._build_map_workflow()

    def _build_map_workflow(self):
        """Build the map interaction workflow."""
        # Create the workflow graph
        workflow = StateGraph(MapState)
        
        # Wrap all node functions with state handling
        wrapped_call_model = with_map_state_handling(call_model)
        wrapped_call_tools = with_map_state_handling(call_tools)
        wrapped_generate_response = with_map_state_handling(generate_response)
        wrapped_send_map_update = with_map_state_handling(send_map_update)
        wrapped_router = with_map_state_handling(router)
        
        # Add nodes to the graph
        workflow.add_node("agent", wrapped_call_model)
        workflow.add_node("tools", wrapped_call_tools)
        workflow.add_node("response", wrapped_generate_response)
        workflow.add_node("update", wrapped_send_map_update)
        workflow.add_node("router", wrapped_router)
        
        # Set the entry point to router
        workflow.set_entry_point("router")
        
        # Add conditional edges from the router based on message history
        workflow.add_conditional_edges(
            "router",
            get_next_node,
            {
                "agent": "agent",
                "tools": "tools",
                "response": "response",
                "end": END
            }
        )
        
        # Add edges back to the router
        workflow.add_edge("agent", "router")
        workflow.add_edge("tools", "router")
        
        # Add remaining edges
        workflow.add_edge("response", "update")
        workflow.add_edge("update", END)
        
        # Compile the workflow
        return workflow.compile(checkpointer=self.memory) 