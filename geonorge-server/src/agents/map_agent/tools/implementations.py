"""
Implementations of the map agent tools.
"""
from typing import Dict, List, Tuple
from llm import LLMManager
from langchain.prompts import ChatPromptTemplate
from langchain.schema import StrOutputParser
import re
import json
import requests
import urllib.parse

# Initialize LLM (needed for pan_to_location fallback)
llm_manager = LLMManager()
llm = llm_manager.get_main_llm()

# --- Tool Implementations ---

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
    # Note: This implementation is simplified as it doesn't have direct access
    # to the current state/zoom level. The logic using string inputs like
    # "increase" has been removed as the LLM prompt now enforces integer input.
    try:
        # Ensure zoom is within valid range
        new_zoom = max(1, min(18, level))
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