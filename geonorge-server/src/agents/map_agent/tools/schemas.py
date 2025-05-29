"""
Pydantic schemas for map agent tool inputs.
"""
from typing import List
from pydantic import BaseModel, Field


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