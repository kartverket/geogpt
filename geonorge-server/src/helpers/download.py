import asyncio
import aiohttp
import logging
import time # Added time module
from typing import Any, Dict, List, Optional
import re
from xml.etree import ElementTree
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

from helpers.fetch_valid_download_api_data import get_wms

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def fetch_area_data(uuid: str) -> List[Dict[str, Any]]:
    """
    Fetch area data for a given UUID from the Geonorge API.
    
    Calls: https://nedlasting.geonorge.no/api/codelists/area/{uuid}
    Returns a list (parsed JSON). If not valid, returns an empty list.
    """
    url = f"https://nedlasting.geonorge.no/api/codelists/area/{uuid}"

    timeout = aiohttp.ClientTimeout(total=10)
    
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            try:
                async with session.get(url) as response:
                    # logger.info("Response status: %s, URL: %s", response.status, response.url)
                    if not response.ok:
                        logger.warning(f"HTTP error! status: {response.status}")
                        return []
                    # Check if redirected to a login page.
                    if str(response.url).startswith("https://auth2.geoid.no"):
                        logger.warning("Dataset requires authentication. UUID: %s", uuid)
                        return []
                    return await response.json()
            except aiohttp.ClientConnectorError as e:
                logger.error(f"Connection error for {uuid}: {str(e)}")
                return []
            except asyncio.TimeoutError:
                # logger.error(f"Timeout while fetching area data for {uuid}")
                return []
    except Exception as error:
        logger.error(f'Error fetching area data for {uuid}: {str(error)}')
        return []


async def dataset_has_download(uuid: str) -> bool:
    """
    Determine if a dataset has downloadable content by checking area data.
    """
    api_json = await fetch_area_data(uuid)
    return len(api_json) > 0


async def get_standard_or_first_format(uuid: str, prefetched_area_data: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Attempts to select a default format using predefined preferences.
    Accepts optional prefetched_area_data to avoid redundant API calls.
    Falls back to the first available option if defaults are not found.
    
    Returns a dictionary with area, projection, and format information,
    or an empty dict if no valid data is found.
    """
    # Default preferences.
    area_name = "Hele landet"
    projection_name = "EUREF89 UTM sone 33, 2d"
    format_name = "FGDB"
    user_group = "GeoGPT"
    usage_purpose = "GeoGPT"

    areas: List[Dict[str, Any]]
    if prefetched_area_data is not None:
        logger.debug(f"Using prefetched area data for {uuid}")
        areas = prefetched_area_data
    else:
        logger.debug(f"No prefetched data, fetching area data for {uuid}")
        areas = await fetch_area_data(uuid)

    if not areas:
        logger.warning("No valid area data found for UUID: %s", uuid)
        return {}

    # Find area object.
    area_obj = next((a for a in areas if a.get("name") == area_name), None) or areas[0]
    area_name = area_obj.get("name", "")
    area_code = area_obj.get("code", "")
    area_type = area_obj.get("type", "")

    # Projections.
    projections = area_obj.get("projections", [])
    if not projections:
        logger.warning("No projections found in area for UUID: %s", uuid)
        return {}

    proj_obj = next((p for p in projections if p.get("name") == projection_name), None) or projections[0]
    projection_name = proj_obj.get("name", "")
    projection_code = proj_obj.get("code", "")
    projection_codespace = proj_obj.get("codespace", "")

    # Formats.
    formats = proj_obj.get("formats", [])
    if not formats:
        logger.warning("No formats found in projection for UUID: %s", uuid)
        return {}

    fmt_obj = next((f for f in formats if f.get("name") == format_name), None) or formats[0]
    format_name = fmt_obj.get("name", "")
    format_code = fmt_obj.get("code", "")
    format_type = fmt_obj.get("type", "")

    return {
        "areaName": area_name,
        "areaCode": area_code,
        "areaType": area_type,
        "projectionName": projection_name,
        "projectionCode": projection_code,
        "projectionCodespace": projection_codespace,
        "formatName": format_name,
        "formatCode": format_code,
        "formatType": format_type,
        "userGroup": user_group,
        "usagePurpose": usage_purpose,
    }


async def get_download_url(metadata_uuid: str, download_formats: Dict[str, Any]) -> Optional[str]:
    """
    POST an order to https://nedlasting.geonorge.no/api/order and return the first downloadUrl if available.
    """
    email = ""
    software_client = "GeoGpt"
    software_client_version = "0.1.0"

    logger.info(
        "Requesting download URL for metadata UUID: %s with formats: %s",
        metadata_uuid, download_formats
    )

    order_request = {
        "email": email,
        "usageGroup": download_formats.get("userGroup", "GeoGPT"),
        "softwareClient": software_client,
        "softwareClientVersion": software_client_version,
        "orderLines": [
            {
                "metadataUuid": metadata_uuid,
                "areas": [
                    {
                        "code": download_formats.get("areaCode"),
                        "name": download_formats.get("areaName"),
                        "type": download_formats.get("areaType"),
                    }
                ],
                "projections": [
                    {
                        "code": download_formats.get("projectionCode"),
                        "name": download_formats.get("projectionName"),
                        "codespace": download_formats.get("projectionCodespace"),
                    }
                ],
                "formats": [
                    {
                        "code": download_formats.get("formatCode", ""),
                        "name": download_formats.get("formatName"),
                        "type": download_formats.get("formatType", ""),
                    }
                ],
                "usagePurpose": download_formats.get("usagePurpose"),
            }
        ],
    }

    timeout = aiohttp.ClientTimeout(total=15)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(
            "https://nedlasting.geonorge.no/api/order",
            json=order_request
        ) as response:
            if not response.ok:
                error_body = await response.text()
                raise RuntimeError(
                    f"Network response failed: {response.status} {response.reason} - {error_body}"
                )

            data = await response.json()
            files = data.get("files", [])
            if files:
                return files[0].get("downloadUrl")
            return None


async def get_dataset_download_formats(vdb_search_response: List[tuple]) -> List[Dict[str, Any]]:
    """
    For each item in vdb_search_response, fetch only the download formats
    and return minimal dataset information.
    Returns a list of datasets with uuid, title and download formats.
    """
    # Convert tuples to dictionaries with only needed fields
    field_names = ['uuid', 'title', 'abstract', 'image', 'distance']
    dict_response = [dict(zip(field_names, row)) for row in vdb_search_response]

    async def fetch_formats(dataset: Dict[str, Any]) -> Dict[str, Any]:
        try:
            uuid = dataset.get("uuid")
            formats_api_response = await fetch_area_data(uuid)
            
            return {
                "uuid": dataset["uuid"],
                "title": dataset["title"],
                "downloadFormats": formats_api_response
            }
        except Exception as e:
            logger.error(f"Error fetching formats for dataset {dataset.get('uuid', 'unknown')}: {str(e)}")
            return {
                "uuid": dataset.get("uuid", "unknown"),
                "title": dataset.get("title", "Unknown dataset"),
                "downloadFormats": []
            }

    tasks = [fetch_formats(ds) for ds in dict_response]
    
    # Allow individual tasks to fail without affecting others
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Filter out exceptions and keep valid results
    valid_results = []
    for item in results:
        if isinstance(item, Exception):
            logger.error(f"Task failed: {str(item)}")
        else:
            valid_results.append(item)
    
    return valid_results

# --- New WMS Capabilities Helper ---
async def _fetch_wms_capabilities_async(wms_url: str, timeout_seconds: int = 5) -> Optional[Dict[str, Any]]:
    """ Fetches and parses WMS GetCapabilities using aiohttp. Returns dict or None on error. """
    if not wms_url:
        logger.debug("Skipping WMS fetch: No URL provided.")
        return None
    
    logger.debug(f"Preparing WMS GetCapabilities request for base URL: {wms_url}")
    
    # --- Robust URL Parameter Handling ---
    try:
        parsed_url = urlparse(wms_url)
        query_params = parse_qs(parsed_url.query, keep_blank_values=True)
        
        # Normalize parameter keys to lowercase for case-insensitive check
        query_params_lower = {k.lower(): v for k, v in query_params.items()}

        # Add/overwrite standard GetCapabilities parameters
        query_params_lower['service'] = ['WMS'] 
        query_params_lower['request'] = ['GetCapabilities']

        final_query_string = urlencode(query_params_lower, doseq=True)
        
        fetch_url_parts = list(parsed_url)
        fetch_url_parts[4] = final_query_string # Index 4 is the query string
        fetch_url = urlunparse(fetch_url_parts)
        
        logger.debug(f"Constructed WMS GetCapabilities URL: {fetch_url}")

    except Exception as url_error:
        logger.error(f"Failed to parse or build WMS URL from {wms_url}: {url_error}")
        return None
    # --- End URL Handling ---
        
    timeout = aiohttp.ClientTimeout(total=timeout_seconds)

    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            # Add common headers that might help with some servers
            headers = {'Accept': 'application/xml, text/xml, */*;q=0.01'}
            logger.debug(f"Fetching WMS capabilities from: {fetch_url}")
            async with session.get(fetch_url, headers=headers) as response:
                logger.debug(f"WMS Response Status for {fetch_url}: {response.status}")
                response.raise_for_status() 
                
                content_type = response.headers.get('Content-Type', '').lower()
                logger.debug(f"WMS Response Content-Type: {content_type}")
                if 'xml' not in content_type:
                    logger.warning(f"WMS response from {fetch_url} is not XML ({content_type}). Skipping parse.")
                    
                    return None 
                    
                xml_content = await response.read() # Read bytes
                logger.debug(f"Read {len(xml_content)} bytes of XML content from {fetch_url}")
                
                # Attempt to parse XML
                try:
                    root = ElementTree.fromstring(xml_content)
                    default_namespace = None
                    if '}' in root.tag:
                        default_namespace = root.tag.split('}')[0][1:] # Extract namespace URI
                        logger.debug(f"Detected default namespace: {default_namespace}")
                    

                    ns = {
                         "wms": "http://www.opengis.net/wms", 
                         "ows": "http://www.opengis.net/ows/1.1", # Common for exceptions/metadata
                         "xlink": "http://www.w3.org/1999/xlink" # Sometimes used
                    }
                    if default_namespace:
                        ns['defns'] = default_namespace
                        # Prepare path prefixes for findall if default namespace exists
                        wms_prefix = 'defns:' if default_namespace == ns["wms"] else 'wms:' 
                    else:
                         # Assume standard prefixes if no default namespace detected on root
                         wms_prefix = 'wms:'

                    layers = []
                    processed_layer_names = set() # Avoid duplicates if structure is odd

                    for layer in root.findall(f".//{wms_prefix}Layer", ns):
                        name_el = layer.find(f"{wms_prefix}Name", ns)
                        title_el = layer.find(f"{wms_prefix}Title", ns)
                        
                        layer_name = name_el.text if name_el is not None else None
                        layer_title = title_el.text if title_el is not None else None

                        # Include layer if it has a name (essential for requests) and hasn't been seen
                        if layer_name and layer_name not in processed_layer_names:
                            # Title is desirable but not essential for listing; use Name if Title is missing
                            display_title = layer_title if layer_title else layer_name 
                            layers.append({"name": layer_name, "title": display_title})
                            processed_layer_names.add(layer_name)
                            # logger.debug(f"Found layer: Name='{layer_name}', Title='{display_title}'")
                        elif not layer_name:
                             # Log layers without names for debugging, but don't include them
                             pass # logger.debug(f"Skipping layer without Name (Title: '{layer_title}')")
                             
                    # Find available formats for GetMap (usually within Capability section)
                    formats = []
                    getmap_formats = root.findall(f".//{wms_prefix}Capability//{wms_prefix}GetMap/{wms_prefix}Format", ns)
                    if not getmap_formats: # Fallback: search anywhere
                         getmap_formats = root.findall(f".//{wms_prefix}GetMap/{wms_prefix}Format", ns)
                         
                    for fmt in getmap_formats:
                        if fmt.text and fmt.text not in formats:
                            formats.append(fmt.text)

                    logger.info(f"Successfully parsed WMS for {wms_url}. Found {len(layers)} queryable layers and {len(formats)} formats.")
                    return {
                        "available_layers": layers,
                        "available_formats": formats
                    }

                except ElementTree.ParseError as e:
                     logger.warning(f"Failed to parse WMS XML for {wms_url}: {str(e)}")
                     # Optionally log the beginning of the content to see what's wrong
                     # try:
                     #      content_start = xml_content.decode('utf-8', errors='ignore')[:500]
                     #      logger.warning(f"XML Parse Error. Content starts with: {content_start}")
                     # except Exception as decode_err:
                     #      logger.warning(f"Could not decode XML content for logging: {decode_err}")
                     return None # Indicate failure

    except aiohttp.ClientResponseError as e: # Catch HTTP errors specifically
        logger.warning(f"WMS HTTP error for {fetch_url}: {e.status} {e.message}")
        return None
    except aiohttp.ClientError as e: # Catch other client errors (connection, etc.)
        logger.warning(f"WMS request client error for {fetch_url}: {str(e)}")
        return None
    except asyncio.TimeoutError:
        # logger.warning(f"Timeout fetching WMS capabilities from {fetch_url}")
        logger.warning(f"WMS Timeout ({timeout.total}s) fetching capabilities from {fetch_url}") # Log timeout value
        return None
    except Exception as e:
        # Catch-all for unexpected errors during the process
        logger.error(f"Unexpected error fetching WMS for {fetch_url}: {type(e).__name__} - {str(e)}")
        # Log traceback for unexpected errors
        # import traceback
        # logger.error(traceback.format_exc())
        return None
# --- End WMS Helper ---

async def get_dataset_download_and_wms_status(vdb_search_response: List[tuple]) -> List[Dict[str, Any]]:
    """
    For each item in vdb_search_response, fetch:
      - The raw area data (downloadFormats)
      - The WMS capabilities (if getcapabilitiesurl is present)
      - A direct downloadUrl if the dataset supports it (using a default/first area/format).
    Returns a list of enriched dataset dictionaries.
    
    Deduplicates results by keeping only one entry per base document title.
    Uses getcapabilitiesurl from VDB results.
    """
    # Convert tuples to dictionaries. Now includes 'getcapabilitiesurl'.
    # Ensure the order matches the SELECT statement in _vector_search.
    field_names = ['uuid', 'title', 'getcapabilitiesurl', 'distance'] 
    dict_response = [dict(zip(field_names, row)) for row in vdb_search_response]
    
    # --- Deduplication Logic (unchanged) ---
    title_groups = {}
    for dataset in dict_response:
        title = dataset.get("title", "")
        base_title = re.sub(r'\s+\([Dd]el\s+\d+\)$|\s+\([Pp]art\s+\d+\)$', '', title)
        if base_title not in title_groups:
            title_groups[base_title] = []
        title_groups[base_title].append(dataset)
    
    deduplicated_response = []
    for base_title, datasets in title_groups.items():
        datasets.sort(key=lambda x: float(x.get('distance', float('inf'))))
        deduplicated_response.append(datasets[0])
    # --- End Deduplication ---

    # --- New Enrich Dataset Helper ---
    async def enrich_dataset(dataset: Dict[str, Any]) -> Dict[str, Any]:
        start_time = time.monotonic() # Start timer for this dataset
        uuid = dataset.get("uuid")
        title = dataset.get("title") # Title comes from VDB
        wms_capabilities_url = dataset.get("getcapabilitiesurl")
        
        # Store errors encountered during enrichment
        errors = []

        # --- Tasks for concurrent execution ---
        tasks = {}
        # Task 1: Fetch WMS Capabilities (if URL exists)
        if wms_capabilities_url:
            tasks["wms"] = asyncio.create_task(_fetch_wms_capabilities_async(wms_capabilities_url), name=f"wms_{uuid}") # Add name for clarity
        else:
            logger.debug(f"No getcapabilitiesurl found for dataset {uuid}")
        
        # Task 2: Fetch Area Data (download formats)
        tasks["area"] = asyncio.create_task(fetch_area_data(uuid), name=f"area_{uuid}") # Add name for clarity
        
        # --- Await concurrent tasks ---
        concurrent_fetch_start = time.monotonic()
        results = {}
        if tasks:
            done, _ = await asyncio.wait(tasks.values(), return_when=asyncio.ALL_COMPLETED)
            for task in done:
                # Find task name based on the task object
                task_name = next((name for name, t in tasks.items() if t == task), None)
                if task_name:
                    try:
                        results[task_name] = task.result()
                    except Exception as e:
                        log_msg = f"Error in task '{task_name}' for dataset {uuid}: {e}"
                        logger.error(log_msg)
                        errors.append(log_msg)
                        results[task_name] = None # Mark as failed
        concurrent_fetch_duration = time.monotonic() - concurrent_fetch_start
        logger.info(f"[{uuid}] TIMING: Concurrent WMS/Area fetch took {concurrent_fetch_duration:.2f}s")

        # --- Process WMS results ---
        wms_info = None
        wms_capabilities = results.get("wms")
        if wms_capabilities_url:
            if wms_capabilities: # Success
                wms_info = {
                    "wms_url": wms_capabilities_url,
                    "available_layers": wms_capabilities.get("available_layers", []),
                    "available_formats": wms_capabilities.get("available_formats", []),
                    "title": title # Use title from VDB
                }
            elif results.get("wms") is None and "wms" in tasks: # Explicit failure/timeout during initial fetch
                 log_msg = f"Initial WMS fetch failed/timed out for {uuid} from {wms_capabilities_url}. Will retry in background."
                 logger.warning(log_msg) 
                 wms_info = {"loading": True} # Set loading state for frontend
                 # Optionally add to errors list if frontend needs more info about initial failure
                 # errors.append("Initial WMS fetch timed out")
            # Else (no wms_capabilities_url), wms_info remains None
        

        # --- Process Area Data results ---
        formats_api_response = results.get("area", []) # Default to empty list if fetch failed or no task
        if results.get("area") is None and "area" in tasks: # Log if area task failed
            log_msg = f"Failed to fetch area (download formats) data for dataset {uuid}"
            # errors.append(log_msg) # Already logged in task exception handling


        # --- Get Download URL (sequentially after area data is processed) ---
        download_url_fetch_start = time.monotonic()
        download_url = None
        restricted = False # Initialize restriction flag
        if formats_api_response: # Only attempt if area data was successful
            try:
                # Note: get_standard_or_first_format might call fetch_area_data again if prefetched is None/empty
                # Pass the fetched data to potentially avoid this.
                standard_format = await get_standard_or_first_format(uuid, formats_api_response) 
                if standard_format:
                    try:
                        download_url = await get_download_url(uuid, standard_format)
                        logger.debug(f"Got download URL for {uuid}: {download_url}")
                    except RuntimeError as e:
                        if "Order contains restricted datasets" in str(e):
                            restricted = True # Mark dataset as restricted
                            logger.warning(f"Dataset {uuid} is restricted (via download order).")
                        else:
                            # Log other runtime errors from download order
                            log_msg = f"RuntimeError getting download URL for dataset {uuid}: {str(e)}"
                            logger.error(log_msg)
                            errors.append(log_msg)
                    except Exception as e: # Catch other potential errors during download URL fetch
                         log_msg = f"Exception getting download URL for dataset {uuid}: {str(e)}"
                         logger.error(log_msg)
                         errors.append(log_msg)
                else:
                     logger.debug(f"Could not determine standard/first format for {uuid}")
            except Exception as e:
                log_msg = f"Error processing standard download format for dataset {uuid}: {str(e)}"
                logger.error(log_msg)
                errors.append(log_msg)
        else:
             logger.debug(f"Skipping download URL check for {uuid} due to missing area data.")
        download_url_fetch_duration = time.monotonic() - download_url_fetch_start
        logger.info(f"[{uuid}] TIMING: Download URL fetch took {download_url_fetch_duration:.2f}s")

        # --- Construct final result ---
        final_dataset = {
            "uuid": uuid,
            "title": title,
            "getcapabilitiesurl": wms_capabilities_url, # Keep original URL for retries
            # "distance": dataset.get("distance"), # Keep distance if needed downstream
            "downloadFormats": formats_api_response,
            "wmsUrl": wms_info, # Can be: full object | {loading: true} | None
            "downloadUrl": download_url,
            "restricted": restricted, # Reflects restriction found during download order
            "error": "; ".join(errors) if errors else None # Combine error messages
        }
        
        total_enrich_duration = time.monotonic() - start_time
        logger.info(f"[{uuid}] TIMING: Total enrichment took {total_enrich_duration:.2f}s")
        return final_dataset
    # --- End Enrich Dataset Helper ---

    # Use the deduplicated list for processing
    tasks = [enrich_dataset(ds) for ds in deduplicated_response]
    
    # Allow individual tasks to fail without affecting others
    # gather already handles exceptions per task, enrich_dataset catches internal ones
    results = await asyncio.gather(*tasks, return_exceptions=False) # Set return_exceptions=False as enrich_dataset handles its own exceptions
    
    # Filter out any potential None results if enrich_dataset failed catastrophically (shouldn't happen)
    valid_results = [item for item in results if item is not None]
    
    logger.info(f"Enriched {len(valid_results)} deduplicated datasets for search results.")
    return valid_results

async def check_download_api_connectivity() -> bool:
    """
    Check if the Geonorge download API is accessible.
    Returns True if accessible, False otherwise.
    """
    try:
        # Test URL that should always be accessible
        url = "https://nedlasting.geonorge.no/api/codelists/defaults"
        timeout = aiohttp.ClientTimeout(total=5)
        
        async with aiohttp.ClientSession(timeout=timeout) as session:
            try:
                async with session.get(url) as response:
                    if response.ok:
                        logger.info("Geonorge Download API is accessible")
                        return True
                    else:
                        logger.warning(f"Geonorge Download API returned non-OK status: {response.status}")
                        return False
            except aiohttp.ClientConnectorError as e:
                logger.error(f"Connection error to Geonorge Download API: {str(e)}")
                return False
            except asyncio.TimeoutError:
                logger.error("Timeout connecting to Geonorge Download API")
                return False
    except Exception as e:
        logger.error(f"Error checking Geonorge Download API connectivity: {str(e)}")
        return False
