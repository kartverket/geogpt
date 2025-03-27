
from helpers.fetch_valid_download_api import fetch_get_data_api
from xml.etree import ElementTree
import aiohttp

async def get_wms(uuid: str) -> dict:
    """Get WMS capabilities information for a dataset.

    Args:
        uuid (str): The dataset UUID

    Returns:
        dict: WMS capabilities information or error message
    """
    try:
        raw = await fetch_get_data_api(uuid)
        if not raw:
            return "None"
            
        related_view_services = raw.get('Distributions', {}).get('RelatedViewServices', [])
        if not related_view_services:
            return "None"
            
        capabilities_url = related_view_services[0].get('GetCapabilitiesUrl') if related_view_services else None
        
        if not capabilities_url:
            return {'error': 'No WMS capabilities URL found'}

        dataset_title = raw.get('Title', '')

        async with aiohttp.ClientSession() as session:
            async with session.get(capabilities_url) as response:
                if not response.ok:
                    return {'error': f'HTTP error! status: {response.status}'}
                
                content = await response.text()
                tree = ElementTree.fromstring(content)
                
                ns = {"wms": "http://www.opengis.net/wms"}
                
                # Get layers with both Name and Title
                layers = []
                for layer in tree.findall(".//wms:Layer", ns):
                    name = layer.find("wms:Name", ns)
                    title = layer.find("wms:Title", ns)
                    if name is not None and title is not None:
                        layers.append({
                            "name": name.text,
                            "title": title.text
                        })

                # Get available formats
                formats = [
                    fmt.text for fmt in tree.findall(".//wms:GetMap/wms:Format", ns)
                ]

                return {
                    "wms_url": capabilities_url,
                    "available_layers": layers,
                    "available_formats": formats,
                    "title": dataset_title
                }

    except ElementTree.ParseError:
        return {'error': 'Failed to parse WMS XML response'}
    except Exception as e:
        return {'error': str(e)}