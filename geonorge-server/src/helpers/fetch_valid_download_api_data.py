from helpers.fetch_valid_download_api import fetch_get_data_api

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
        print(f"Error getting WMS URL: {e}")  # Add error logging
        return "None"