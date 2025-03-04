import asyncio
import aiohttp
import logging
from typing import Any, Dict, List, Optional
import re

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
                logger.error(f"Timeout while fetching area data for {uuid}")
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


async def get_standard_or_first_format(uuid: str) -> Dict[str, Any]:
    """
    Attempts to select a default format using predefined preferences.
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

    api_json = await fetch_area_data(uuid)
    areas: List[Dict[str, Any]] = api_json  # already a list of dict

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

async def get_dataset_download_and_wms_status(vdb_search_response: List[tuple]) -> List[Dict[str, Any]]:
    """
    For each item in vdb_search_response, fetch:
      - The raw area data (downloadFormats)
      - The WMS URL
      - A direct downloadUrl if the dataset supports it (using a default/first area/format).
    Returns a list of enriched dataset dictionaries.
    
    Deduplicates results by keeping only one entry per base document title.
    """
    # Convert tuples to dictionaries.
    field_names = ['uuid', 'title', 'abstract', 'image', 'distance']
    dict_response = [dict(zip(field_names, row)) for row in vdb_search_response]
    
    # REMOVE PART INDICATORS
    title_groups = {}
    
    for dataset in dict_response:
        title = dataset.get("title", "")
        
        # Extract base title by removing part indicators like "(Del 2)" or "(Part 2)" brazy regex
        # This regex looks for patterns like " (Del X)" or " (Part X)" at the end of titles
        base_title = re.sub(r'\s+\([Dd]el\s+\d+\)$|\s+\([Pp]art\s+\d+\)$', '', title)
        
        if base_title not in title_groups:
            title_groups[base_title] = []
            
        title_groups[base_title].append(dataset)
    
    deduplicated_response = []
    
    for base_title, datasets in title_groups.items():
        # DISTANCE SORT, LOWER IS GOOD
        datasets.sort(key=lambda x: float(x.get('distance', float('inf'))))
        
        # KEEP THE BEST MATCH
        deduplicated_response.append(datasets[0])

    async def enrich_dataset(dataset: Dict[str, Any]) -> Dict[str, Any]:
        try:
            uuid = dataset.get("uuid")
            # 1) Get WMS URL.
            wms_url = await get_wms(uuid)

            # 2) Fetch the raw area/projection/format data.
            formats_api_response = await fetch_area_data(uuid)

            # 3) Attempt to get a direct download link using defaults.
            download_url = None
            if formats_api_response:
                try:
                    standard_format = await get_standard_or_first_format(uuid)
                    if standard_format:
                        try:
                            download_url = await get_download_url(uuid, standard_format)
                        except RuntimeError as e:
                            if "Order contains restricted datasets" in str(e):
                                # Mark dataset as restricted.
                                return {
                                    **dataset,
                                    "downloadFormats": formats_api_response,
                                    "wmsUrl": wms_url,
                                    "downloadUrl": None,
                                    "restricted": True
                                }
                except Exception as e:
                    logger.error(f"Error getting download format for dataset {uuid}: {str(e)}")

            return {
                **dataset,
                "downloadFormats": formats_api_response,
                "wmsUrl": wms_url,
                "downloadUrl": download_url,
            }
        except Exception as e:
            logger.error(f"Error enriching dataset {dataset.get('uuid', 'unknown')}: {str(e)}")
            return {
                **dataset,
                "downloadFormats": [],
                "wmsUrl": None,
                "downloadUrl": None,
                "error": str(e)
            }

    # Use the deduplicated list for processing
    tasks = [enrich_dataset(ds) for ds in deduplicated_response]
    
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
