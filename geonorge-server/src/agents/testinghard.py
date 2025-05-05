# This is a test file for an alternative supervisor system.
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
import os
import uuid
import json
import sys
from langchain.tools import BaseTool, tool


# Add the parent directory to the path so we can import from src.retrieval
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from retrieval.geo_vector_retriever import GeoNorgeVectorRetriever

# Set up LangSmith for tracking and debugging
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGSMITH_API_KEY"] = "example-api-key"  # Your API key
os.environ["LANGCHAIN_PROJECT"] = "example-project"  # Project name in LangSmith
os.environ["LANGCHAIN_ENDPOINT"] = "https://api.smith.langchain.com"  # LangSmith API endpoint


from langgraph_supervisor import create_supervisor
from langgraph.prebuilt import create_react_agent

# Using Google's native LangChain integration instead of OpenAI compatibility mode
model = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                google_api_key="example-api-key",
                streaming=True,
                temperature=0.3,
            )

# Create specialized agents

def add(a: float, b: float) -> float:
    """Add two numbers."""
    return a + b

def multiply(a: float, b: float) -> float:
    """Multiply two numbers."""
    return a * b

def web_search(query: str) -> str:
    """Search the web for information."""
    return (
        "Here are the headcounts for each of the FAANG companies in 2024:\n"
        "1. **Facebook (Meta)**: 67,317 employees.\n"
        "2. **Apple**: 164,000 employees.\n"
        "3. **Amazon**: 1,551,000 employees.\n"
        "4. **Netflix**: 14,000 employees.\n"
        "5. **Google (Alphabet)**: 181,269 employees."
    )

# Track map actions taken 
map_actions = []

# Simple map tools using the @tool decorator
@tool
def pan_map(location: str) -> str:
    """Pan the map to a specific location (city or place name)."""
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
        "bodø": (67.2804, 14.4051),
        "flesland flyplass": (60.2934, 5.2236),
        "sentrum": (60.3913, 5.3221),  # Default to Bergen's coordinates for testing
    }
    
    # Check if the location is a known city (case insensitive)
    normalized_location = location.lower().strip()
    if normalized_location in city_coordinates:
        coords = city_coordinates[normalized_location]
        map_actions.append(f"Panned to {location} at coordinates {coords}")
        print(f"MAP ACTION: Panned to {location} at coordinates {coords}")
        return f"Map panned to {location} at coordinates {coords}"
    
    # For testing purposes, default to Oslo if location not found
    coords = (59.9139, 10.7522)  # Default to Oslo
    map_actions.append(f"Panned to {location} at coordinates {coords} (defaulted to Oslo)")
    print(f"MAP ACTION: Location '{location}' not found, defaulting to Oslo coordinates")
    return f"Map panned to Oslo (default location) at coordinates {coords}"

@tool
def set_zoom(level: int) -> str:
    """Set the zoom level of the map (1-18, higher is more zoomed in)."""
    try:
        # Ensure zoom is within valid range
        new_zoom = max(1, min(18, level))
        map_actions.append(f"Set zoom level to {new_zoom}")
        print(f"MAP ACTION: Setting zoom level to {new_zoom}")
        return f"Zoom level set to {new_zoom}"
    except Exception as e:
        print(f"MAP ACTION: Error setting zoom level: {e}, using default zoom")
        map_actions.append("Set zoom level to 14 (default)")
        return "Error setting zoom level, using default (14)"

@tool
def toggle_layers(layer_names: str, action: str = "show") -> str:
    """Show or hide map layers. Provide comma-separated layer names and an action (show/hide/clear)."""
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
    
    # Parse the layer names
    layers = [l.strip() for l in layer_names.split(",")]
    
    # Filter to only include valid layers
    valid_layers = [layer for layer in layers if layer.lower() in available_layers]
    
    if action.lower() == "clear":
        map_actions.append("Cleared all map layers")
        print(f"MAP ACTION: Clearing all layers")
        return "All map layers cleared"
    else:
        map_actions.append(f"Updated layers to {valid_layers} with action '{action}'")
        print(f"MAP ACTION: Updated layers to {valid_layers}")
        return f"Layers updated: {', '.join(valid_layers)} ({action})"

@tool
def add_markers(locations: str, clear: bool = False) -> str:
    """Add markers to the map. Provide comma-separated location names."""
    # Parse the locations
    location_list = [l.strip() for l in locations.split(",")]
    
    if not location_list and clear:
        map_actions.append("Cleared all markers")
        print(f"MAP ACTION: Clearing all markers")
        return "All markers cleared"
    
    markers_added = []
    for location in location_list:
        # Add marker using pan_map to get coordinates
        result = pan_map(location)
        markers_added.append(location)
        print(f"MAP ACTION: Added marker at {location}")
    
    map_actions.append(f"Added markers at: {', '.join(markers_added)}")
    return f"Added markers at: {', '.join(markers_added)}"

@tool
def find_my_location(zoom_level: int = 14) -> str:
    """Find the user's location and center the map there."""
    map_actions.append(f"Found user location with zoom level {zoom_level}")
    print(f"MAP ACTION: Finding user location with zoom level {zoom_level}")
    
    # This is a simulated response
    return f"Found your location and centered the map with zoom level {zoom_level}"

# Create the map tools list
map_tools = [
    pan_map,
    set_zoom,
    toggle_layers,
    add_markers,
    find_my_location
]

# Create a proper tool for GeoNorgeVectorRetriever instead of using the method directly
@tool
def search_geonorge(query: str) -> str:
    """Search for datasets in the Geonorge database."""
    try:
        print(f"RESEARCH ACTION: Searching Geonorge for '{query}'")
        
        # Create a new instance of the retriever
        retriever = GeoNorgeVectorRetriever()
        
        # Use a synchronous approach instead of async to avoid issues
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        documents, raw_results = loop.run_until_complete(retriever.get_relevant_documents(query))
        loop.close()
        
        # Format the results
        if not documents:
            print("RESEARCH ACTION: No datasets found")
            return "No datasets found matching your query."
        
        # Format the processed documents for clean output
        result = "## Datasets\n\n"
        for i, doc in enumerate(documents, 1):
            # Extract dataset, description, and URL from page_content
            content_lines = doc.page_content.strip().split('\n')
            
            result += f"### Dataset {i}:\n"
            
            # Include each line from page_content
            for line in content_lines:
                result += f"- {line}\n"
            
            # Add metadata in a formatted way
            result += "- **Metadata**:\n"
            for key, value in doc.metadata.items():
                result += f"  - {key}: {value}\n"
            
            result += "\n"
        
        print(f"RESEARCH ACTION: Found {len(documents)} datasets")
        return result
    except Exception as e:
        import traceback
        print(f"RESEARCH ACTION ERROR: {e}")
        traceback.print_exc()
        return f"Error searching Geonorge: {str(e)}"

# Create research agent with the search_geonorge tool instead of the method directly
research_agent = create_react_agent(
    model=model,
    tools=[search_geonorge],
    name="research_expert",
    prompt="""You are a Geonorge expert. You help users find geographic datasets and information from the Geonorge database.
    
When a user asks about datasets, geographic information, or specific data in Geonorge:
1. Use the search_geonorge tool to search the Geonorge database
2. Display the complete dataset information returned by the tool
3. Present the information in a clear, organized manner
4. Make sure to include all dataset names, descriptions, and metadata

Present the dataset information exactly as returned by the search_geonorge tool,
maintaining the same formatting and organization.

Even if the user request also mentions maps or visualization, focus only on providing the dataset information.
Do not try to handle map visualization - that will be handled by another agent.
"""
)

# Create agents with tools
math_agent = create_react_agent(
    model=model,
    tools=[add, multiply],
    name="math_expert",
    prompt="You are a math expert. Always use one tool at a time."
)

# Create a map agent with map tools
map_agent = create_react_agent(
    model=model,
    tools=map_tools,
    name="map_expert",
    prompt="""You are a map expert. You help users navigate and interact with maps.

You have the following tools at your disposal:
1. pan_map - Pan the map to a specific location (example cities: Oslo, Bergen, Trondheim)
2. set_zoom - Set the zoom level between 1-18 (higher number = more zoomed in)
3. toggle_layers - Show or hide map layers (available layers: topographic, satellite, terrain, etc.)
4. add_markers - Add markers to specific locations on the map
5. find_my_location - Find the user's current location

When handling map-related queries:
- Use the specific tools mentioned in the query
- If no specific tools are mentioned, infer which ones would best serve the user's needs

For explicit tool requests, use the exact tools mentioned by the user.
"""
)

# Create supervisor workflow with all agents
workflow = create_supervisor(
    [research_agent, math_agent, map_agent],
    model=model,
    prompt=(
        """You are a team supervisor managing multiple expert agents:
        
        1. research_expert - For questions about GeoNorge data and finding geographic datasets
        2. math_expert - For mathematical calculations and numeric problems
        3. map_expert - For map navigation, visualization, and interaction tasks
        
        IMPORTANT FOR MULTI-INTENT QUERIES:
        When a query contains multiple intents (like searching for datasets AND showing them on a map):
        - First use research_expert to find the datasets
        - Then use map_expert to show or visualize the location
        - Build on the information from previous agents
        
        CRITICAL: When the research_expert returns dataset information, include all the detailed 
        dataset information in your final answer in a clean, organized format.
        
        In your final response to the user:
        1. Include the COMPLETE dataset information that was found
        2. Then mention any map actions that were performed
        
        Example user query: "Search for datasets about roads and show them on a map in Oslo"
        Your response should: 
        - First include all the dataset information in a clear format
        - Then mention "I have also panned the map to Oslo"
        
        Specific routing guidelines:
        - For queries about GeoNorge data, datasets, metadata: use research_expert
        - For calculations, statistics, or numerical analysis: use math_expert
        - For showing locations on a map, panning, zooming, or map visualization: use map_expert
        
        Focus on serving the user's complete request by including ALL information from agents.
        """
    )
)

# Compile and run
app = workflow.compile()

# Create a unique run ID for this execution
run_id = str(uuid.uuid4())[:8]
os.environ["LANGCHAIN_RUN_ID"] = f"supervisor-demo-{run_id}"

print("\n" + "="*50)
print("TESTING MAP AND RESEARCH AGENTS WITH MULTI-INTENT QUERY")
print("="*50)

# Clear any previous map actions
map_actions = []

# Track research actions
research_actions = []

# Use a query that requires both research and map tools
print("\nRunning with query: 'Search for datasets about roads and show them on a map in Oslo'\n")

result = app.invoke({
    "messages": [
        {
            "role": "user",
            "content": "Search for datasets about roads and tell me about the datasets, and pan the map to Oslo"
        }
    ]
})

# Print a more readable version of the conversation
print("\n" + "="*50)
print("CONVERSATION FLOW")
print("="*50)

# Track which agents were used
agents_used = set()

if "messages" in result:
    for i, message in enumerate(result["messages"]):
        if hasattr(message, "name") and message.name:
            agent_name = message.name
            if agent_name not in ["supervisor", "human"]:
                agents_used.add(agent_name)
        else:
            agent_name = type(message).__name__
            
        print(f"\n[{agent_name}]:")
        print("-" * (len(str(agent_name)) + 3))
        
        if hasattr(message, "content") and message.content:
            print(message.content)
        
        # Show tool calls if any
        if hasattr(message, "tool_calls") and message.tool_calls:
            print(f"\n  [Tool call]: {message.tool_calls[0]['name']}")

print("\n" + "="*50)
print("FINAL ANSWER")
print("="*50)

# Extract the last assistant message with meaningful content
last_answer = None
for message in reversed(result["messages"]):
    if (hasattr(message, "name") and message.name == "supervisor" and 
        hasattr(message, "content") and message.content and 
        "transfer" not in message.content.lower()):
        last_answer = message.content
        break

if last_answer:
    print(f"\n{last_answer}")
else:
    print("\nNo final answer found.")

print("\n" + "="*50)
print("LANGSMITH INTEGRATION")
print("="*50)
print(f"\nThis run has been traced in LangSmith with ID: supervisor-demo-{run_id}")
print("To view the trace and debug your agents:")
print("1. Go to https://smith.langchain.com/")
print("2. Navigate to the 'pr-clear-cabbage-3' project")
print("3. Search for the run ID to see the full execution graph")
print("\nNote: You can see your traces using the LangSmith dashboard.")

print("\n" + "="*50)
print("AGENTS USED")
print("="*50)
if agents_used:
    for agent in agents_used:
        print(f"- {agent}")
else:
    print("No specific agents were recorded.")

print("\n" + "="*50)
print("RESEARCH ACTIONS")
print("="*50)
if hasattr(result, "get") and result.get("messages"):
    # Find all tool calls to search_geonorge
    for message in result["messages"]:
        if hasattr(message, "tool_calls") and message.tool_calls:
            for tool_call in message.tool_calls:
                if tool_call.get("function", {}).get("name") == "search_geonorge":
                    args = json.loads(tool_call.get("function", {}).get("arguments", "{}"))
                    research_actions.append(f"Searched for: {args.get('query', 'unknown query')}")
                    
if research_actions:
    for action in research_actions:
        print(f"- {action}")
else:
    print("No research actions were recorded.")

print("\n" + "="*50)
print("MAP ACTIONS SUMMARY")
print("="*50)
if map_actions:
    for action in map_actions:
        print(f"- {action}")
else:
    print("No map actions were recorded.")