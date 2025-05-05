"""
Leaflet map interaction workflow for GeoNorge.
"""
from typing import Dict, List, Optional, Tuple, TypedDict, Sequence
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from llm import LLMManager
from langchain.prompts import ChatPromptTemplate
from langchain.schema import StrOutputParser
from pydantic import BaseModel, Field
from langchain.tools import StructuredTool
from helpers.websocket import send_websocket_message
from langchain_core.messages import BaseMessage
from ..utils.common import register_websockets_dict, format_history, active_websockets
from ..utils.tool_utils import ToolExecutor, ToolInvocation
from ..utils.message_utils import standardize_state, get_last_message_by_role
import json
import re
import requests
import urllib.parse

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
    markers: List[Dict]
    websocket_id: Optional[str]
    action_taken: Optional[List[str]]
    add_marker_at_location: bool
    add_marker_at_address: Optional[bool]
    in_merged_workflow: bool
    found_address_text: Optional[str]

def with_map_state_handling(node_func):
    """Wrap a map node function with state standardization and default value logic."""
    async def wrapped(state):
        print(f"DEBUG Map {node_func.__name__}: state type = {type(state)}")

        # Standardize incoming state to a dictionary (if not already)
        current_state = {}
        if not isinstance(state, dict):
            # Convert based on expected attributes or raise error
            for k in MapState.__annotations__.keys():
                 if hasattr(state, k):
                     current_state[k] = getattr(state, k)
            # Handle potential special keys like NEXT if necessary
            if hasattr(state, "NEXT"): current_state["NEXT"] = state.NEXT
        else:
            current_state = state.copy() # Work with a copy

        ws_id = current_state.get("websocket_id")
        in_merged = current_state.get("in_merged_workflow", False)
        print(f"DEBUG Map {node_func.__name__}: ws_id={ws_id}, in_merged={in_merged}")

        # Ensure state has default values ONLY if they don't exist
        if "map_center" not in current_state:
            current_state["map_center"] = (59.9139, 10.7522)
        if "zoom_level" not in current_state:
            current_state["zoom_level"] = 14
        if "markers" not in current_state:
            current_state["markers"] = []
        if "action_taken" not in current_state:
            current_state["action_taken"] = []
        # Ensure add_marker_at_location exists for tool checks
        if "add_marker_at_location" not in current_state:
            current_state["add_marker_at_location"] = False # Default to False
        # Ensure add_marker_at_address exists for tool checks
        if "add_marker_at_address" not in current_state:
             current_state["add_marker_at_address"] = None # Default to None
        # Ensure found_address_text exists
        if "found_address_text" not in current_state:
             current_state["found_address_text"] = None # Default to None

        # Set/Ensure in_merged_workflow flag is present if needed downstream
        # Overwrite if present in input, otherwise default to False
        current_state["in_merged_workflow"] = current_state.get("in_merged_workflow", False)

        # Process the state with the node function
        # The state passed here is managed by LangGraph's checkpointer between steps
        result_state = current_state # Default to current state if node func fails
        try:
            result_state = await node_func(current_state)
        except Exception as e:
             print(f"ERROR: Exception caught within wrapped node '{node_func.__name__}': {e}")
             import traceback
             traceback.print_exc()
             # Keep the current state as the result to allow the graph to continue if possible
             # Ensure result_state is a dictionary
             result_state = standardize_state(current_state) 
             # Optionally add an error marker to the state
             result_state['node_execution_error'] = f"Error in {node_func.__name__}: {e}"

        # No need to update any persistent store here.
        # LangGraph handles passing state to the next node via the checkpointer.

        # Ensure the return value is always a dictionary
        return standardize_state(result_state)

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
    
class MarkersInput(BaseModel):
    """Input schema for addMarkers tool"""
    locations: List[str] = Field(description="List of locations to mark")
    clear: bool = Field(description="Whether to clear existing markers first", default=False)

class MyLocationInput(BaseModel):
    """Input schema for findMyLocation tool"""
    zoom_level: int = Field(description="The zoom level to set when finding location", default=14)
    add_marker: bool = Field(description="Whether to add a marker at the user's location", default=False)

class AddressSearchInput(BaseModel):
    """Input schema for SearchAddress tool"""
    address: str = Field(description="The address string to search for")
    add_marker: bool = Field(description="Whether to add a marker at the found address", default=False)

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

# New Tool Implementation for Address Search
async def search_address(address: str, add_marker: bool = False) -> Dict:
    """Search for a specific address using GeoNorge API and return its details."""
    print(f"Searching for address: {address}, Add marker: {add_marker}")
    encoded_address = urllib.parse.quote(address)
    # Use treffPerSide=1 to get the most relevant result
    api_url = f"https://ws.geonorge.no/adresser/v1/sok?sok={encoded_address}*&treffPerSide=1"
    
    headers = {'Accept': 'application/json'}
    
    try:
        # Using requests synchronously for simplicity, consider aiohttp for async
        response = requests.get(api_url, headers=headers, timeout=10)
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
        data = response.json()
        
        if data and data.get("adresser"):
            first_address = data["adresser"][0]
            coords = first_address.get("representasjonspunkt")
            full_address_text = first_address.get("adressetekst")
            
            if coords and "lat" in coords and "lon" in coords:
                lat = coords["lat"]
                lon = coords["lon"]
                print(f"Found address: {full_address_text} at ({lat}, {lon})")
                return {
                    "coordinates": (lat, lon),
                    "full_address": full_address_text,
                    "add_marker_preference": add_marker
                }
            else:
                print("Address found, but coordinates are missing.")
                return {"error": "Coordinates not found for the address.", "add_marker_preference": add_marker}
        else:
            print(f"No address found for: {address}")
            return {"error": "Address not found.", "add_marker_preference": add_marker}
            
    except requests.exceptions.RequestException as e:
        print(f"API request failed: {e}")
        return {"error": f"API request failed: {e}", "add_marker_preference": add_marker}
    except json.JSONDecodeError:
        print("Failed to decode JSON response from API.")
        return {"error": "Invalid response from address API.", "add_marker_preference": add_marker}
    except Exception as e:
        print(f"An unexpected error occurred during address search: {e}")
        return {"error": f"An unexpected error occurred: {e}", "add_marker_preference": add_marker}

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

# New Address Search Tool
address_search_tool = StructuredTool.from_function(
    func=search_address,
    name="SearchAddress",
    description="Search for a specific Norwegian address using GeoNorge API to get its coordinates and full name.",
    args_schema=AddressSearchInput,
    return_direct=False, 
)

# Create tool executor with all tools
map_tools = [pan_map_tool, zoom_map_tool, markers_tool, my_location_tool, address_search_tool]
tool_executor = ToolExecutor(map_tools)

# Define the function to determine whether to continue the agent-action cycle
def get_next_node(state: Dict) -> str:
    """Determine the next node in the workflow based on the message history."""
    print("--- DEBUG: get_next_node ---")
    messages = state.get("messages", [])
    if not messages:
        print("  No messages found, ending.")
        return END # Changed from "end" to END constant

    last_message_obj = messages[-1]
    print(f"  Last message object type: {type(last_message_obj)}")
    print(f"  Last message object: {last_message_obj}")

    role = None
    has_tool_calls = False

    # Handle dictionary format (common in LangGraph)
    if isinstance(last_message_obj, dict):
        role = last_message_obj.get("role")
        # Check for tool calls in additional_kwargs
        additional_kwargs = last_message_obj.get("additional_kwargs", {})
        has_tool_calls = bool(additional_kwargs.get("tool_calls")) if additional_kwargs else False
        # Also check if the role is directly 'tool'
        if role == 'tool':
             print("  Last message is a tool result (dict format).")
             return "response" # Tool results always go to generate response

    # Handle LangChain BaseMessage format (less common here but possible)
    elif hasattr(last_message_obj, "type"): # Check for 'type' attribute
        # Mapping from LangChain 'type' to simpler roles
        lc_type = getattr(last_message_obj, "type")
        if lc_type == "human": role = "human"
        elif lc_type == "ai": role = "assistant"
        elif lc_type == "tool": role = "tool"
        # Add other mappings if needed (system, function, etc.)

        # Check for tool calls attribute
        if hasattr(last_message_obj, "tool_calls"):
            has_tool_calls = bool(getattr(last_message_obj, "tool_calls"))
        elif hasattr(last_message_obj, "additional_kwargs") and isinstance(last_message_obj.additional_kwargs, dict):
             # Sometimes tool calls might still be nested in additional_kwargs for BaseMessages
             has_tool_calls = bool(last_message_obj.additional_kwargs.get("tool_calls"))

        if role == 'tool':
             print("  Last message is a tool result (BaseMessage format).")
             return "response" # Tool results always go to generate response

    else:
        print("  Last message is of unknown format.")
        return END # End if format is unrecognized

    print(f"  Determined Role: {role}, Has Tool Calls: {has_tool_calls}")

    # Routing logic based on determined role and tool calls
    if role == "human":
        print("  Routing to 'agent' (Human message).")
        return "agent"
    elif role == "assistant" and has_tool_calls:
        print("  Routing to 'tools' (Assistant message with tool calls).")
        return "tools"
    elif role == "assistant" and not has_tool_calls:
         # This is assumed to be the final response generated by the 'response' node.
         # Route directly to update to send the response and end the flow.
         print("  Routing to 'update' (Assistant message WITHOUT tool calls - assuming final response).")
         return "update" # Route directly to update, bypassing response node again.
    # Tool role handled above
    #elif role == "tool":
    #    print("  Routing to 'response' (Tool message).")
    #    return "response"

    print("  No matching condition found, ending.")
    return END # Default to end if no condition matches

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
       Format: {{"tool": "PanMap", "params": {{"location": "stedsnavnet"}}}} // Kan også ta koordinater hentet fra SearchAddress
       
    2. "ZoomMap" - Setter zoom-nivået på kartet (1-18)
       Format: {{"tool": "ZoomMap", "params": {{"level": zoom_level}}}}
       VIKTIG: "level" må være et heltall mellom 1 og 18, IKKE en streng som "increase" eller "decrease".
       
    3. "AddMarkers" - Legger til markører på kartet
       Format: {{"tool": "AddMarkers", "params": {{"locations": ["sted1", "sted2"], "clear": true/false}}}}
       
    4. "FindMyLocation" - Finner brukerens nåværende posisjon og sentrerer kartet på den
       Format: {{"tool": "FindMyLocation", "params": {{"zoom_level": 14, "add_marker": true/false}}}}
       Du kan også bruke add_marker parameteren for å legge til en markør på brukerens posisjon.
       
    5. "SearchAddress" - Søker etter en spesifikk norsk gateadresse for å finne koordinater og fullt navn.
      Format: {{"tool": "SearchAddress", "params": {{"address": "gatenavn nummer...", "add_marker": true/false}}}}
      VIKTIG:
        - Dette verktøyet finner koordinatene og sentrerer kartet der automatisk.
        - Kartet vil automatisk zoome til nivå 14 med mindre du også kaller "ZoomMap".
        - Bruk "add_marker": true for å legge til en markør på adressen.
        - Du trenger ikke å inkludere postnummer/poststed, men det kan hjelpe for å finne riktig adresse.
    
    Analyser brukerens forespørsel og returner en JSON-array med verktøykall som skal utføres.
    Eksempel (søk adresse): [{{"tool": "SearchAddress", "params": {{"address": "Eidsdalen 7B"}}}}] // Senterer kartet + zoomer til 14 automatisk
    Eksempel (søk adresse + marker): [{{"tool": "SearchAddress", "params": {{"address": "Storgata 1, Oslo", "add_marker": true}}}}] // Senterer kartet, zoomer til 14 auto + marker
    Eksempel (søk adresse + zoom): [{{"tool": "SearchAddress", "params": {{"address": "Nygårdsgaten 5, Bergen"}}}}, {{"tool": "ZoomMap", "params": {{"level": 16}}}}] // Senterer kartet + zoomer til 16
    Eksempel (panorering og zoom): [{{"tool": "PanMap", "params": {{"location": "Oslo"}}}}, {{"tool": "ZoomMap", "params": {{"level": 14}}}}] // Eksempel for panorering og zoom
    
    Du kan kjenne igjen disse handlingene:
    - Panorering: Når brukeren vil se et spesifikt sted (f.eks. "vis meg Oslo", "ta meg til Bergen")
    - Zooming: Når brukeren vil zoome inn eller ut (f.eks. "zoom til nivå 16", "zoom inn")
    - Markører: Når brukeren vil markere steder (f.eks. "marker Oslo og Bergen", "fjern alle markører")
    - Min posisjon: Finne eller markere brukerens posisjon (f.eks. "vis hvor jeg er", "marker min posisjon")
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
            import re
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
    markers = state.get("markers", [])[:]
    action_taken = state.get("action_taken", [])[:]
    # Reset action-specific flags
    state["add_marker_at_address"] = None
    
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
            
            # Store tool result directly for potential use by response generation or subsequent tools
            tool_result = None
            
            # Call the appropriate tool function
            tool_name = action.tool
            if tool_name == "PanMap":
                # Check if SearchAddress ran successfully earlier in *this* tool call sequence
                search_address_succeeded = bool(state.get("found_address_text")) 
                
                tool_result = await pan_to_location(**action.tool_input)
                
                # Only update map_center from PanMap if SearchAddress hasn't already set it successfully
                if not search_address_succeeded:
                    # Check if the result is valid coordinates before updating map_center
                    if isinstance(tool_result, tuple) and len(tool_result) == 2:
                        map_center = tool_result
                        print(f"PanMap updating map_center (SearchAddress did not precede or failed): {map_center}")
                    else:
                         print(f"PanMap returned non-coordinate result, not updating map_center: {tool_result}")
                else:
                    print(f"PanMap skipping map_center update because SearchAddress succeeded earlier.")
                # Ensure PanMap action is recorded if coordinates were valid or if SearchAddress already added it.
                # We add PanMap when SearchAddress succeeds, so we don't need to add it again here if search_address_succeeded.
                if not search_address_succeeded and isinstance(tool_result, tuple) and len(tool_result) == 2:
                    if "PanMap" not in action_taken:
                         action_taken.append("PanMap")
            elif tool_name == "ZoomMap":
                tool_result = await set_zoom_level(**action.tool_input)
                zoom_level = tool_result
            elif tool_name == "AddMarkers":
                tool_result = await add_markers(**action.tool_input)
                if action.tool_input.get("clear", False):
                    markers = tool_result
                else:
                    markers.extend(tool_result)
            elif tool_name == "FindMyLocation":
                # Call the find my location function with the zoom level
                zoom_level = action.tool_input.get("zoom_level", 14)
                add_marker = action.tool_input.get("add_marker", False)
                tool_result = await find_my_location(zoom_level, add_marker)
                
                # Note: The actual update to map_center will happen when the client responds
                print(f"Find my location tool called with zoom level {zoom_level} and add_marker: {add_marker}")
                # Add the FindMyLocation action to the list of actions taken
                action_taken.append("FindMyLocation")
                # Store the add_marker parameter in the state
                state["add_marker_at_location"] = add_marker
            elif tool_name == "SearchAddress":
                tool_result = await search_address(**action.tool_input)
                # Initialize coords and label to None in this scope
                coords = None
                label = None
                # Store the full address text if found, regardless of whether PanMap is called next
                if isinstance(tool_result, dict) and "full_address" in tool_result:
                    state["found_address_text"] = tool_result["full_address"]
                    # If address found, also store marker preference and handle marker addition
                    add_marker_pref = tool_result.get("add_marker_preference", False)
                    state["add_marker_at_address"] = add_marker_pref

                    # Get coords and label from the successful result
                    coords = tool_result.get("coordinates")
                    label = tool_result.get("full_address")
                    
                    if add_marker_pref:
                        # Only add marker if coords and label were found
                        if coords and label:
                            new_marker = {"lat": coords[0], "lng": coords[1], "label": label}
                            # Avoid adding duplicate markers if the tool is called multiple times
                            if new_marker not in markers:
                                markers.append(new_marker)
                                print(f"Adding marker for searched address: {label}")
                                if "AddMarkers" not in action_taken:
                                     action_taken.append("AddMarkers") # Ensure marker update is sent
                            else:
                                print(f"Marker for {label} already exists.")
                                
                    # Directly update map center if coordinates were found in the result
                    # This check now uses the 'coords' variable assigned above
                    if coords:
                        map_center = coords
                        print(f"Setting map center to found address: {coords}")
                        if "PanMap" not in action_taken: # Add PanMap action if not already present
                            action_taken.append("PanMap")
                    # Set default zoom if SearchAddress succeeded and ZoomMap is not called
                    zoom_map_called = any(tc["function"]["name"] == "ZoomMap" for tc in last_message["additional_kwargs"]["tool_calls"])
                    if not zoom_map_called and coords: # Also ensure coords were found before setting zoom
                        zoom_level = 14
                        print(f"Setting default zoom to 14 after successful address search.")
                else:
                     # Handle case where tool failed or didn't return expected structure
                     state["found_address_text"] = None # Clear if not found or error
                     state["add_marker_at_address"] = None
                     # Log the actual result for debugging
                     print(f"SearchAddress tool did not return expected dict. Result: {tool_result}")
                
                # IMPORTANT: SearchAddress itself does NOT update map_center.
                # The LLM must issue a subsequent PanMap call with the coordinates.
                # We store the result in tool_message content for the LLM to potentially use.
                print(f"SearchAddress result: {tool_result}")
            else:
                raise ValueError(f"Unknown tool: {tool_name}")
            
            # Create a tool message
            tool_message = {
                "role": "tool",
                "tool_call_id": tool_call["id"],
                "name": action.tool,
                "content": json.dumps(tool_result) if isinstance(tool_result, dict) else str(tool_result) # Store full result as JSON string
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
    
    # Find the location name from PanMap tool calls (if not from SearchAddress)
    location_name = None
    # Find specific result from SearchAddress if it was called
    search_address_error = None
    search_address_called = False
    original_search_query = None
    
    actions = state.get("action_taken", [])

    # Check tool results for SearchAddress outcome
    for msg in reversed(messages):
        if msg.get("role") == "tool" and msg.get("name") == "SearchAddress":
            search_address_called = True
            try:
                tool_content = json.loads(msg.get("content", "{}"))
                if "error" in tool_content:
                    search_address_error = tool_content["error"]
                    print(f"SearchAddress resulted in error: {search_address_error}")
                # Find the original address query from the corresponding assistant tool call
                for prev_msg in reversed(messages):
                     if prev_msg.get("role") == "assistant" and "tool_calls" in prev_msg.get("additional_kwargs", {}):
                         for tool_call in prev_msg["additional_kwargs"]["tool_calls"]:
                             if tool_call["id"] == msg.get("tool_call_id") and tool_call["function"]["name"] == "SearchAddress":
                                 try:
                                     call_args = json.loads(tool_call["function"]["arguments"])
                                     original_search_query = call_args.get("address")
                                     print(f"Original SearchAddress query: {original_search_query}")
                                     break
                                 except Exception as e:
                                     print(f"Error extracting original search query args: {e}")
                         if original_search_query:
                             break
            except json.JSONDecodeError:
                search_address_error = "Could not parse tool result."
            except Exception as e:
                search_address_error = f"Error processing tool result: {e}"
            break # Found the SearchAddress result

    # Determine location name for response (prefer found address, fallback to PanMap arg)
    if state.get("found_address_text"):
        location_name = state.get("found_address_text")
    elif "PanMap" in actions and not search_address_called: # Only use PanMap arg if not an address search
        for msg in reversed(messages):
            if msg.get("role") == "tool" and msg.get("name") == "PanMap":
                # Find the corresponding tool call to get the original location name
                for prev_msg in reversed(messages):
                    if prev_msg.get("role") == "assistant" and "tool_calls" in prev_msg.get("additional_kwargs", {}):
                        for tool_call in prev_msg["additional_kwargs"]["tool_calls"]:
                            if tool_call["function"]["name"] == "PanMap" and tool_call["id"] == msg.get("tool_call_id"):
                                try:
                                    location_args = json.loads(tool_call["function"]["arguments"])
                                    # Avoid using raw coordinate strings as location names
                                    loc_arg = location_args.get("location")
                                    if not (loc_arg.startswith('[') and loc_arg.endswith(']')):
                                        location_name = loc_arg
                                        print(f"Found location in PanMap tool call: {location_name}")
                                    break
                                except Exception as e:
                                    print(f"Error extracting PanMap location: {e}")
                        if location_name:
                            break
                break
    
    # Create a response prompt template
    prompt_template = """Du er en kartassistent. Generer et svar basert på handlingene som ble utført og resultatet av verktøykall.
        
Handlinger utført: {actions}
Kartsentrum: {map_center}
Zoom-nivå: {zoom_level}
Markører: {markers}
        
VIKTIG:
- Hvis SearchAddress ble kalt ({search_address_called}) og mislyktes med en feilmelding ('{search_address_error}'), informer brukeren klart om at adressen '{original_search_query}' ikke ble funnet.
- Hvis SearchAddress var vellykket og kartet ble flyttet (PanMap i handlinger), bekreft ved å nevne den funnede adressen '{found_address}'.
- Hvis PanMap ble brukt for et generelt stedsnavn '{location}', bekreft at kartet er sentrert der.
- Hvis ingen spesifikk adresse eller sted ble panorert til, si bare at kartet er oppdatert basert på de andre handlingene (zoom, lag, markører osv.).
- Nevn andre utførte handlinger kort (f.eks. "zoomet inn", "la til markør", "viste terrenglag").
        
Eksempel (adresse ikke funnet): "Beklager, jeg fant ingen adresse som heter 'Helvetesgata 12'."
Eksempel (adresse funnet): "Ok, jeg har sentrert kartet på Eidsdalen 7B og la til en markør."
Eksempel (sted funnet): "Greit, kartet viser nå Oslo."
Eksempel (kun zoom): "Jeg har zoomet inn på kartet."
        
Hold svaret kort og konsist, men naturlig og hjelpsomt."""

    prompt = ChatPromptTemplate.from_messages([
        ("system", prompt_template),
        ("human", "{query}")
    ])
    
    # Generate the response
    chain = prompt | llm | StrOutputParser()
    response = await chain.ainvoke({
        "query": latest_query,
        "actions": ", ".join(actions) if actions else "info",
        "map_center": state.get("map_center", (59.9139, 10.7522)),
        "location": location_name or "kartet", # Use found location name or fallback
        "zoom_level": state.get("zoom_level", 14),
        "markers": state.get("markers", []) or "ingen",
        "found_address": state.get("found_address_text", ""), # Pass found address to prompt
        "search_address_called": search_address_called,
        "search_address_error": search_address_error or "", # Pass error message or empty string
        "original_search_query": original_search_query or ""
    })
    
    # Add the response to the messages
    messages.append({"role": "assistant", "content": response})
    state["messages"] = messages
    state["chat_history"] = format_history(messages)
    
    return state

# Update the send_map_update function to use standardization
async def send_map_update(state: Dict) -> Dict:
    """Send the map update to the frontend via websocket."""
    print(f"Sending map update with state: {state.keys()}")
    
    # Standardize the state
    state = standardize_state(state)
    
    is_mixed_workflow = state.get("in_merged_workflow", False)
    print(f"DEBUG send_map_update: in_merged_workflow flag = {is_mixed_workflow}")
    
    websocket_id = state.get("websocket_id")
    if not websocket_id:
        print("No websocket ID found in state")
        return state
        
    websocket = active_websockets.get(websocket_id)
    
    if websocket:
        try:
            action_taken = state.get("action_taken", [])
            map_data = {}
            
            # If an address was searched, we assume the intent is to pan there, even if PanMap wasn't explicitly the *last* action,
            # but resulted from SearchAddress. The actual panning happens if PanMap is called *after* SearchAddress by the LLM.
            # So, we primarily rely on PanMap action to trigger sending center coordinates.
            if "PanMap" in action_taken: # Keep relying on PanMap to send center updates
                map_data["center"] = state.get("map_center", None)
            
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
                 # If SearchAddress set a default zoom, use it
                 if "SearchAddress" in action_taken and not zoom_explicitly_set:
                     current_zoom = state.get("zoom_level", 14) # Should be 14 if set in call_tools
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
                    # Don't re-raise here, just log
                    # import traceback
                    # traceback.print_exc()
            else:
                 print("DEBUG send_map_update: No map data changes detected, skipping mapUpdate message.")

            # --- REST OF THE FUNCTION (chat message handling) ---
            # Only send chat response if not in mixed workflow
            if not is_mixed_workflow:
                print(f"DEBUG send_map_update: Not in mixed workflow, attempting to send chat message.")
                messages = state.get("messages", [])
                if messages:
                    # Get the latest assistant message using our utility function
                    assistant_response_content = get_last_message_by_role(messages, "assistant")
                    
                    if assistant_response_content:
                        print(f"DEBUG: Streaming assistant response: {assistant_response_content[:100]}...") # Log snippet
                        # Stream the message
                        await send_websocket_message("chatStream", {"payload": assistant_response_content, "isNewMessage": True}, websocket)
                        # Signal completion
                        await send_websocket_message("streamComplete", {}, websocket)
                        print("DEBUG: Chat stream sent successfully.")
                    else:
                        print("DEBUG: No assistant message content found to stream.")
                else:
                    print("DEBUG: No messages found in state to extract assistant response.")
            else:
                print(f"DEBUG: Suppressing map chat response in mixed workflow mode.")
                
        except Exception as e_inner:
             print(f"ERROR: Exception caught within send_map_update logic: {e_inner}")
             import traceback
             traceback.print_exc()
             # Return the current state to prevent the graph from crashing completely
    else:
        print(f"ERROR: No websocket found for ID: {websocket_id}")
        print(f"DEBUG: Available websocket IDs: {list(active_websockets.keys())}")
    
    # Ensure the function always returns the state dictionary
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
                "update": "update",
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