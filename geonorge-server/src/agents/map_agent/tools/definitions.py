"""
LangChain tool definitions and the tool executor for the map agent.
"""
from langchain.tools import StructuredTool
from .schemas import (
    LocationInput, 
    ZoomInput, 
    MarkersInput, 
    MyLocationInput, 
    AddressSearchInput
)
from .implementations import (
    pan_to_location, 
    set_zoom_level, 
    add_markers, 
    find_my_location, 
    search_address
)
from ...utils.tool_utils import ToolExecutor

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