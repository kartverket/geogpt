import aiohttp
import json

# API configuration
API_URLS = {
    'API_V1': 'https://nedlasting.geonorge.no/api/codelists/area/',
    'API_V2': 'https://nedlasting.ngu.no/api/v2/codelists/area/'
}

ERROR_MESSAGE = {
    'USER_NOT_AUTHORIZED': 'User not authorized.',
    'NO_VALID_API': 'No valid API url provided'
}

async def fetch_valid_download_data(api_url, uuid):
    """Fetch download data from a specific API version.

    Args:
        api_url (str): The base API URL to use
        uuid (str): The dataset UUID

    Returns:
        list/str: API response data or error message
    """
    if not api_url:
        print(ERROR_MESSAGE['NO_VALID_API'])
        return ERROR_MESSAGE['NO_VALID_API']

    url = f"{api_url}{uuid}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                # Handle non-200 responses and possible redirection to login page
                if response.status == 404:
                    return []  
                
                if 'https://auth2.geoid.no' in str(response.url):
                    print(ERROR_MESSAGE['USER_NOT_AUTHORIZED'])
                    return ERROR_MESSAGE['USER_NOT_AUTHORIZED']
                
                if not response.ok:
                    print(f'HTTP error! status: {response.status}')
                    raise aiohttp.ClientError(f'HTTP error! status: {response.status}')
                
                return await response.json()
    except Exception as error:
        print('Error fetching data:', str(error))
        return []

async def fetch_valid_download_data_auto(uuid):
    """Try multiple API versions and return the result of the one that works.

    Args:
        uuid (str): The dataset UUID

    Returns:
        list: API response data or empty list if all APIs fail
    """
    for key, api_url in API_URLS.items():
        data = await fetch_valid_download_data(api_url, uuid)
        if isinstance(data, list) and len(data) > 0:
            if key == 'API_V1':
                data = convert_v1_to_v2(data)
            data.insert(0, {'api_version': key})
            return data
        if data and not isinstance(data, list):
            return data

        print(f"Warn: {key} is not available for this uuid: {uuid}")
    return []

async def fetch_get_data_api(uuid):
    """Fetch data from the getdata API.

    Args:
        uuid (str): The dataset UUID

    Returns:
        dict/list: API response data or empty list on failure
    """
    url = f"https://kartkatalog.geonorge.no/api/getdata/{uuid}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 404:
                    return []
                if not response.ok:
                    print(f'HTTP error! status: {response.status}')
                return await response.json()
    except Exception as error:
        print(f'Error fetching wms-data for {uuid}', str(error))
        return []

async def get_wms(uuid):
    """Get the WMS URL for a dataset.

    Args:
        uuid (str): The dataset UUID

    Returns:
        str: WMS URL or 'None' if not found
    """
    try:
        raw = await fetch_get_data_api(uuid)
        res = raw.get('Distributions', {}).get('RelatedViewServices', [{}])[0].get('MapUrl')
        return res if res else 'None'
    except Exception:
        return 'None'

def convert_v1_to_v2(json_data):
    """Convert API V1 format to V2 format.

    Args:
        json_data (list): Data in API V1 format

    Returns:
        list: Data converted to API V2 format
    """
    result = []
    for item in json_data:
        if item.get('code') == '0000':
            result.append(dict(item))
            continue

        unique_projections = set()
        format_names = set()

        projections = item.get('projections', [])
        if isinstance(projections, list):
            for projection in projections:
                unique_projections.add(json.dumps({
                    'code': projection.get('code'),
                    'name': projection.get('name'),
                    'codespace': projection.get('codespace')
                }))
                formats = projection.get('formats', [])
                if isinstance(formats, list):
                    for format_item in formats:
                        format_names.add(format_item.get('name'))

        converted_item = {
            'code': item.get('code'),
            'type': item.get('type'),
            'name': item.get('name'),
            'projections': [json.loads(p) for p in unique_projections],
            'formats': [{'name': name} for name in format_names]
        }

        if converted_item['projections'] or converted_item['formats']:
            result.append(converted_item)

    return result