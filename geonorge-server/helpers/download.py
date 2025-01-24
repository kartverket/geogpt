# download.py
import asyncio
import aiohttp
from .fetch_valid_download_api_data import get_wms  
from typing import Any

async def fetch_area_data(uuid: str) -> list[dict]:
    """
    Calls: https://nedlasting.geonorge.no/api/codelists/area/{uuid}
    Returns a list (parsed JSON). If not valid, returns an empty list.
    """
    url = f"https://nedlasting.geonorge.no/api/codelists/area/{uuid}"
    print(f"Fetching area data for UUID: {uuid} from URL: {url}")


    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            print(f"Response status: {response.status}, URL: {response.url}")

            if not response.ok:
                raise RuntimeError(f"HTTP error! status: {response.status}")
            # Check if redirected to a login page
            if str(response.url).startswith("https://auth2.geoid.no"):
                print(f"Dataset requires authentication. Uuid: {uuid}")
                return []
            return await response.json()

async def dataset_has_download(uuid: str) -> bool:
    print(f"Checking if dataset with UUID: {uuid} has downloads...")
    api_json = await fetch_area_data(uuid)
    print(f"API response for UUID {uuid}: {api_json}")

    # If there's at least one object in the list, we consider it downloadable
    return len(api_json) > 0

async def get_standard_or_first_format(uuid: str) -> dict[str, Any]:
    """
    Attempts to pick "Hele landet", "EUREF89 UTM sone 33, 2d", "FGDB" as defaults.
    Fallback to the first available if not found.
    """
    area_name = "Hele landet"
    area_code = "0000"
    area_type = "landsdekkende"

    projection_name = "EUREF89 UTM sone 33, 2d"
    projection_code = "25833"
    projection_codespace = ""

    format_name = "FGDB"
    format_code = ""
    format_type = ""

    user_group = "GeoGPT"
    usage_purpose = "GeoGPT"

    api_json = await fetch_area_data(uuid)
    areas = api_json  # already a list of dict

    if not areas:
        print("No valid area data found.")
        return {}

    # Find area object
    area_obj = next((a for a in areas if a.get("name") == area_name), None)
    if not area_obj:
        area_obj = areas[0]

    area_name = area_obj.get("name")
    area_code = area_obj.get("code")
    area_type = area_obj.get("type")

    # Projections
    projections = area_obj.get("projections", [])
    if not projections:
        print("No projections found in area.")
        return {}

    proj_obj = next((p for p in projections if p.get("name") == projection_name), None)
    if not proj_obj:
        proj_obj = projections[0]

    projection_name = proj_obj.get("name")
    projection_code = proj_obj.get("code")
    projection_codespace = proj_obj.get("codespace", "")

    # Formats
    formats = proj_obj.get("formats", [])
    if not formats:
        print("No formats found in projection.")
        return {}

    fmt_obj = next((f for f in formats if f.get("name") == format_name), None)
    if not fmt_obj:
        fmt_obj = formats[0]

    format_name = fmt_obj.get("name")
    format_code = fmt_obj.get("code", "")
    format_type = fmt_obj.get("type", "")

    # Debug logs
    print(f"The standard Area: {area_name}, code: {area_code}, type: {area_type}")
    print(f"The standard Projection: {projection_name}, code: {projection_code}, cs: {projection_codespace}")
    print(f"The standard Format: {format_name}, code: {format_code}, type: {format_type}")
    print(f"UserGroup: {user_group}, UsagePurpose: {usage_purpose}")

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
        "usagePurpose": usage_purpose
    }

async def get_download_url(metadata_uuid: str, download_formats: dict[str, Any]) -> str | None:
    """
    POSTs an order to https://nedlasting.geonorge.no/api/order and returns the first downloadUrl if any.
    """
    email = ""
    software_client = "GeoGpt"
    software_client_version = "0.1.0"

    # Debug logs
    print(f"Area: {download_formats.get('areaName')}, {download_formats.get('areaCode')}, {download_formats.get('areaType')}")
    print(f"Projection: {download_formats.get('projectionName')}, {download_formats.get('projectionCode')}, {download_formats.get('projectionCodespace')}")
    print(f"Format: {download_formats.get('formatName')}, {download_formats.get('formatCode')}, {download_formats.get('formatType')}")
    print(f"UserGroup: {download_formats.get('userGroup')}, UsagePurpose: {download_formats.get('usagePurpose')}")

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

    async with aiohttp.ClientSession() as session:
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
            if len(files) > 0:
                return files[0].get("downloadUrl")
            else:
                return None

async def get_dataset_download_and_wms_status(vdb_search_response: list[dict]) -> list[dict]:
    """
    For each item in vdb_search_response, fetch:
      - The raw area data (downloadFormats)
      - The WMS URL
      - A direct downloadUrl if the dataset supports it (using a default/first area/format).
    """

    async def enrich_dataset(dataset: dict) -> dict:
        uuid = dataset.get("uuid")

        # 1) Get WMS URL
        wms_url = await get_wms(uuid)

        # 2) Fetch the raw area/projection/format matrix
        formats_api_response = await fetch_area_data(uuid)

        # 3) Attempt to get a direct download link using defaults
        download_url = None
        if formats_api_response:
            # Build standard or "first found" format info
            standard_format = await get_standard_or_first_format(uuid)
            if standard_format:
                # Attempt an order to get the direct link
                # Inside enrich_dataset or wherever you call get_download_url:
                try:
                    download_url = await get_download_url(uuid, standard_format)
                except RuntimeError as e:
                    if "Order contains restricted datasets" in str(e):
                        # Mark as restricted
                        return {
                            **dataset,
                            "downloadFormats": formats_api_response,
                            "wmsUrl": wms_url,
                            "downloadUrl": None,       # no direct URL
                            "restricted": True         # or "isRestricted": True
                        }
                    else:
                        # If it's some other error, re-raise or handle differently
                        raise

        # Return the entire object + extra info
        return {
            **dataset,
            "downloadFormats": formats_api_response,  # raw listing from geonorge
            "wmsUrl": wms_url,
            "downloadUrl": download_url,  # direct link, or None if not possible
        }

    # Run them all in parallel
    tasks = [enrich_dataset(ds) for ds in vdb_search_response]
    results = await asyncio.gather(*tasks)
    return results

