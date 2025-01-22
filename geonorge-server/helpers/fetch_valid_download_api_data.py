# fetch_valid_download_api_data.py
import aiohttp

API_URLS = {
    "API_V1": "https://nedlasting.geonorge.no/api/codelists/area/",
    "API_V2": "https://nedlasting.ngu.no/api/v2/codelists/area/"
}

ERROR_MESSAGE = {
    "USER_NOT_AUTHORIZED": "User not authorized.",
    "NO_VALID_API": "No valid API url provided",
}

async def fetch_valid_download_data(api_url: str, uuid: str):
    if not api_url:
        print(ERROR_MESSAGE["NO_VALID_API"])
        return ERROR_MESSAGE["NO_VALID_API"]

    url = f"{api_url}{uuid}"

    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status == 404:
                return []
            if "auth2.geoid.no" in str(response.url):
                print(ERROR_MESSAGE["USER_NOT_AUTHORIZED"])
                return ERROR_MESSAGE["USER_NOT_AUTHORIZED"]
            if not response.ok:
                print(f"HTTP error! status: {response.status}")
                raise RuntimeError(f"HTTP error! status: {response.status}")

            return await response.json()

async def fetch_valid_download_data_auto(uuid: str):
    """
    Tries multiple API versions, returns first successful data or empty list if none work.
    """
    for key, api_url in API_URLS.items():
        data = await fetch_valid_download_data(api_url, uuid)
        if isinstance(data, list) and len(data) > 0:
            if key == "API_V1":
                data = convert_v1_to_v2(data)
            data.insert(0, {"api_version": key})
            return data
        if isinstance(data, list) and len(data) > 0:
            return data
        print(f"Warn: {key} is not available for this uuid: {uuid}")
    return []

async def fetch_get_data_api(uuid: str):
    """
    Calls: https://kartkatalog.geonorge.no/api/getdata/{uuid}
    Returns a JSON object or empty list if 404.
    """
    url = f"https://kartkatalog.geonorge.no/api/getdata/{uuid}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status == 404:
                return []
            if not response.ok:
                print(f"HTTP error! status: {response.status}")
            return await response.json()

async def get_wms(uuid: str) -> str:
    """
    Return the MapUrl if found, else 'None'.
    """
    try:
        raw = await fetch_get_data_api(uuid)
        if not raw:
            return "None"
        dist = raw.get("Distributions", {})
        rvs = dist.get("RelatedViewServices", [])
        if len(rvs) > 0:
            return rvs[0].get("MapUrl", "None")
        return "None"
    except Exception as e:
        return "None"

def convert_v1_to_v2(json_data: list) -> list:
    """
    Convert API_V1 format to something resembling API_V2 format.
    """
    results = []
    for item in json_data:
        if item.get("code") == "0000":
            results.append(dict(item))
            continue

        unique_projections = []
        format_names = set()

        projections = item.get("projections", [])
        for proj in projections:
            # Collect a "projection" as dict
            projection_dict = {
                "code": proj.get("code"),
                "name": proj.get("name"),
                "codespace": proj.get("codespace"),
            }
            # Store them in a list to  track duplicates
            if projection_dict not in unique_projections:
                unique_projections.append(projection_dict)

            # Gather format names
            for f in proj.get("formats", []):
                format_names.add(f.get("name"))

        result = {
            "code": item.get("code"),
            "type": item.get("type"),
            "name": item.get("name"),
            "projections": unique_projections,
            "formats": [{"name": fn} for fn in format_names]
        }

        if result["projections"] or result["formats"]:
            results.append(result)

    return results