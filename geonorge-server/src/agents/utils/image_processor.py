"""
Image processing functions for the RAG chain.
"""
import re
from helpers.websocket import send_websocket_message
from helpers.download import dataset_has_download, get_download_url, get_standard_or_first_format, fetch_area_data
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
    print(f"DEBUG check_image_signal: Checking for images in response")
    print(f"DEBUG check_image_signal: metadata_context_list type: {type(metadata_context_list)}")
    print(f"DEBUG check_image_signal: metadata_context_list length: {len(metadata_context_list) if metadata_context_list else 0}")
    
    if not metadata_context_list:
        print("DEBUG check_image_signal: No metadata context provided")
        return False
        
    if isinstance(metadata_context_list, list) and len(metadata_context_list) > 0:
        print(f"DEBUG check_image_signal: First metadata item: {metadata_context_list[0]}")
    
    field_names = ['uuid', 'title', 'abstract', 'image', 'distance']
    dict_response = process_vdb_response(metadata_context_list, field_names)
    
    bold_titles = re.findall(r'\*\*(.*?)\*\*', gpt_response)
    print(f"DEBUG check_image_signal: Found {len(bold_titles)} bold titles: {bold_titles}")
    
    # If there are bold titles, try to match them with dataset names
    if bold_titles:
        for obj in dict_response:
            if not obj.get("title"):
                print(f"DEBUG check_image_signal: Dataset missing title: {obj}")
                continue
                
            title = obj.get("title", "").lower()
            print(f"DEBUG check_image_signal: Checking dataset: {title}")
            
            for bold_text in bold_titles:
                bold_lower = bold_text.lower().replace(" ", "")
                title_lower = title.replace(" ", "")
                print(f"DEBUG check_image_signal: Comparing '{title_lower}' with '{bold_lower}'")
                
                # Use more flexible matching criteria
                match_found = False
                
                # Direct substring matching
                if bold_lower in title_lower or title_lower in bold_lower:
                    print(f"DEBUG check_image_signal: Found direct match! Dataset: {obj.get('title')}")
                    match_found = True
                else:
                    # Try word-based matching for partial matches
                    title_words = set(title_lower.split())
                    bold_words = set(bold_lower.split())
                    common_words = title_words.intersection(bold_words)
                    
                    # If they share at least 2 significant words or more than 40% of words
                    significant_match = (len(common_words) >= 2 and 
                                       len(common_words) / max(len(title_words), len(bold_words)) > 0.4)
                    
                    if significant_match:
                        print(f"DEBUG check_image_signal: Found word-based match! Dataset: {obj.get('title')}")
                        print(f"DEBUG check_image_signal: Common words: {common_words}")
                        match_found = True
                
                if match_found:
                    if obj.get("uuid") and obj.get("image"):
                        print(f"DEBUG check_image_signal: Dataset has image: {obj.get('image')}")
                        image_field = obj["image"]
                        image_urls = [s.strip() for s in image_field.split(",") if s.strip()]
                        
                        if not image_urls:
                            print(f"DEBUG check_image_signal: No valid image URLs in image field")
                            continue
                            
                        dataset_image_url = image_urls[-1]
                        dataset_uuid = obj["uuid"]
                        dataset_title = obj["title"]
                        download_url = None
                        wms_url = None
                        download_formats = []

                        # --- FETCH WMS/DOWNLOAD INFO HERE (ON DEMAND) ---
                        try:
                            wms_url = await get_wms(dataset_uuid)
                            formats_api_response = await fetch_area_data(dataset_uuid)
                            download_formats = formats_api_response
                            if await dataset_has_download(dataset_uuid):
                                standard_format = await get_standard_or_first_format(dataset_uuid)
                                if standard_format:
                                    download_url = await get_download_url(dataset_uuid, standard_format)
                                    print(f"DEBUG check_image_signal: Found download URL: {download_url}")
                        except Exception as e:
                            print(f"DEBUG check_image_signal: Failed to get WMS/download info for {dataset_uuid}: {e}")
                        # --- END FETCH ON DEMAND ---

                        return {
                            "uuid": dataset_uuid,
                            "title": dataset_title,
                            "datasetImageUrl": dataset_image_url,
                            "downloadUrl": download_url,
                            "wmsUrl": wms_url,
                            "downloadFormats": download_formats
                        }
                    else:
                        print(f"DEBUG check_image_signal: Dataset missing UUID or image: UUID={obj.get('uuid')}, has_image={obj.get('image') is not None}")
    
    # FALLBACK: If no bold titles matched but we have valid datasets with images, use the first one
    print("DEBUG check_image_signal: No matching dataset found. Trying fallback to first dataset with image")
    for obj in dict_response:
        if obj.get("uuid") and obj.get("image"):
            print(f"DEBUG check_image_signal: Using fallback dataset: {obj.get('title')}")
            image_field = obj["image"]
            image_urls = [s.strip() for s in image_field.split(",") if s.strip()]
            
            if not image_urls:
                continue
                
            dataset_image_url = image_urls[-1]
            dataset_uuid = obj["uuid"]
            dataset_title = obj["title"]
            download_url = None
            wms_url = None
            download_formats = []

            # --- FETCH WMS/DOWNLOAD INFO HERE (FALLBACK ON DEMAND) ---
            try:
                wms_url = await get_wms(dataset_uuid)
                formats_api_response = await fetch_area_data(dataset_uuid)
                download_formats = formats_api_response
                if await dataset_has_download(dataset_uuid):
                    standard_format = await get_standard_or_first_format(dataset_uuid)
                    if standard_format:
                        download_url = await get_download_url(dataset_uuid, standard_format)
            except Exception as e:
                print(f"DEBUG check_image_signal: Failed to get WMS/download info for fallback {dataset_uuid}: {e}")
            # --- END FETCH ON DEMAND ---

            return {
                "uuid": dataset_uuid,
                "title": dataset_title,
                "datasetImageUrl": dataset_image_url,
                "downloadUrl": download_url,
                "wmsUrl": wms_url,
                "downloadFormats": download_formats
            }
    
    print("DEBUG check_image_signal: No datasets with images found at all")
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
    print(f"DEBUG insert_image_rag_response: Starting image insertion")
    
    # Validate inputs
    if not full_response:
        print("DEBUG insert_image_rag_response: Empty response, cannot process images")
        return
        
    print(f"DEBUG insert_image_rag_response: Response length: {len(full_response)}")
    print(f"DEBUG insert_image_rag_response: vdb_response type: {type(vdb_response)}")
    print(f"DEBUG insert_image_rag_response: vdb_response length: {len(vdb_response) if isinstance(vdb_response, list) else 'not a list'}")
    
    # Check if websocket is valid
    if not websocket:
        print("DEBUG insert_image_rag_response: Invalid websocket")
        return
    
    try:
        # If vdb_response is not a list or is empty, try to get fresh metadata
        if not isinstance(vdb_response, list) or len(vdb_response) == 0:
            print("DEBUG insert_image_rag_response: Invalid metadata, trying to extract query from response")
            # Try to extract a query from the response to get metadata
            import re
            
            # Look for potential dataset names (in bold)
            bold_titles = re.findall(r'\*\*(.*?)\*\*', full_response)
            if bold_titles:
                query = bold_titles[0]  # Use the first bold title as a query
                print(f"DEBUG insert_image_rag_response: Extracted query from bold text: {query}")
                
                # Get fresh metadata for this query
                try:
                    import asyncio
                    from helpers.vector_database import get_vdb_response
                    
                    vdb_response = await get_vdb_response(query)
                    print(f"DEBUG insert_image_rag_response: Got fresh metadata with {len(vdb_response)} items")
                except Exception as e:
                    print(f"DEBUG insert_image_rag_response: Failed to get fresh metadata: {e}")
                    return
            else:
                print("DEBUG insert_image_rag_response: Could not extract query from response")
                return
        
        # Check for image signals and get dataset info
        dataset_info = await check_image_signal(full_response, vdb_response)
        if dataset_info:
            print(f"DEBUG insert_image_rag_response: Found dataset image, sending to websocket")
            try:
                # Ensure all required fields are present
                if not dataset_info.get("uuid"):
                    print("DEBUG insert_image_rag_response: Missing UUID in dataset info")
                    return
                    
                if not dataset_info.get("datasetImageUrl"):
                    print("DEBUG insert_image_rag_response: Missing image URL in dataset info")
                    return
                
                # Send the websocket message with image data
                await send_websocket_message(
                    "insertImage",
                    {
                        "datasetUuid": dataset_info["uuid"],
                        "datasetTitle": dataset_info.get("title", ""),
                        "datasetImageUrl": dataset_info["datasetImageUrl"],
                        "datasetDownloadUrl": dataset_info.get("downloadUrl"),  # This may be null
                        "wmsUrl": dataset_info.get("wmsUrl"),  # This may be null
                        "downloadFormats": dataset_info.get("downloadFormats", [])  # This may be empty list
                    },
                    websocket
                )
                print("DEBUG insert_image_rag_response: Successfully sent image message to websocket")
            except Exception as e:
                print(f"DEBUG insert_image_rag_response: Error sending image message: {e}")
                import traceback
                traceback.print_exc()
        else:
            print("DEBUG insert_image_rag_response: No dataset image found to insert")
    except Exception as e:
        print(f"ERROR in insert_image_rag_response: {e}")
        import traceback
        traceback.print_exc() 