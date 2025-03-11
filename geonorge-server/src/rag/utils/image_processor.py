"""
Image processing functions for the RAG chain.
"""
import re
from helpers.websocket import send_websocket_message
from helpers.download import dataset_has_download, get_download_url, get_standard_or_first_format
from helpers.fetch_valid_download_api_data import get_wms
from .dataset_utils import process_vdb_response


async def check_image_signal(gpt_response, metadata_context_list):
    """
    Check for image signals in the response and prepare image data.
    
    Args:
        gpt_response: Generated text response that may contain bold titles
        metadata_context_list: List of dataset metadata
        
    Returns:
        Dictionary with image data or False if no images found
    """
    field_names = ['uuid', 'title', 'abstract', 'image', 'distance']
    dict_response = process_vdb_response(metadata_context_list, field_names)
    
    for row in dict_response:
        row['wmsUrl'] = await get_wms(row['uuid'])
    
    bold_titles = re.findall(r'\*\*(.*?)\*\*', gpt_response)
    if not bold_titles:
        return False
        
    for obj in dict_response:
        title = obj.get("title", "").lower()
        for bold_text in bold_titles:
            bold_lower = bold_text.lower().replace(" ", "")
            title_lower = title.replace(" ", "")
            print(f"Comparing with bold text: {bold_text}")
            print(f"Normalized comparison: '{title_lower}' vs '{bold_lower}'")
            if bold_lower in title_lower:
                if obj.get("uuid") and obj.get("image"):
                    image_field = obj["image"]
                    image_urls = [s.strip() for s in image_field.split(",") if s.strip()]
                    if not image_urls:
                        continue
                    dataset_image_url = image_urls[-1]
                    dataset_uuid = obj["uuid"]
                    download_url = None
                    try:
                        if await dataset_has_download(dataset_uuid):
                            standard_format = await get_standard_or_first_format(dataset_uuid)
                            if standard_format:
                                download_url = await get_download_url(dataset_uuid, standard_format)
                    except Exception as e:
                        print(f"Failed to get download URL: {e}")
                    return {
                        "uuid": dataset_uuid,
                        "datasetImageUrl": dataset_image_url,
                        "downloadUrl": download_url,
                        "wmsUrl": obj.get("wmsUrl", None)
                    }
    return False


async def insert_image_rag_response(full_response, vdb_response, websocket):
    """
    Insert image data into the RAG response.
    
    Args:
        full_response: Complete text response from the LLM
        vdb_response: Vector database response with dataset metadata
        websocket: Websocket connection to send the image data
        
    Returns:
        None
    """
    dataset_info = await check_image_signal(full_response, vdb_response)
    if dataset_info:
        await send_websocket_message(
            "insertImage",
            {
                "datasetUuid": dataset_info["uuid"],
                "datasetImageUrl": dataset_info["datasetImageUrl"],
                "datasetDownloadUrl": dataset_info["downloadUrl"],
                "wmsUrl": dataset_info["wmsUrl"]
            },
            websocket
        ) 