from concurrent.futures import ThreadPoolExecutor
from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
from typing import Any, Dict, List, Set, Optional, Tuple
from xml.etree import ElementTree
from action_enums import Action
import asyncio
import datetime
import json
import logging
import requests
import sys
import traceback
import websockets

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the project root to Python path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

# Import config directly from project root
from config import CONFIG

from rag import get_rag_response
from helpers.download import (
    get_dataset_download_formats, 
    get_dataset_download_and_wms_status,
    get_download_url,
    get_standard_or_first_format,
    fetch_area_data,
    _fetch_wms_capabilities_async
)
from helpers.vector_database import get_vdb_response, get_vdb_search_response
from helpers.websocket import send_websocket_message, send_websocket_action

# Constants
WMS_RETRY_TIMEOUT = 30 

# Initialize Flask app 
app = Flask(__name__)
CORS(app)

# Create a thread pool executor for running blocking operations
executor = ThreadPoolExecutor()

class ChatServer:
    """
    A WebSocket chat server handling chat and search form submissions.
    """

    def __init__(self) -> None:
        self.clients: Set[Any] = set()
        self.client_messages: Dict[Any, List[Dict[str, Any]]] = {}

    async def register(self, websocket: Any) -> None:
        self.clients.add(websocket)
        self.client_messages[websocket] = []

    async def unregister(self, websocket: Any) -> None:
        self.clients.remove(websocket)
        self.client_messages.pop(websocket, None)

    async def handle_chat_form_submit(self, websocket: Any, user_question: str) -> None:
        messages = self.client_messages.get(websocket, [])
        try:
            # Register the websocket directly with common.active_websockets
            from rag.utils.common import active_websockets
            websocket_id = str(id(websocket))
            active_websockets[websocket_id] = websocket
            print(f"DEBUG server: Directly registered websocket with ID {websocket_id} in common.active_websockets")
            print(f"DEBUG server: Active websockets now: {list(active_websockets.keys())}")
            
            vdb_response = await get_vdb_response(user_question)
            
            # Get only download formats for each dataset in vdb_response
            datasets_with_formats = []
            if vdb_response:
                datasets_with_formats = await get_dataset_download_formats(vdb_response)
            
            # await send_websocket_message(Action.USER_MESSAGE.value, user_question, websocket)

            # Send RAG request with streaming
            full_rag_response = await get_rag_response(
                user_question,
                datasets_with_formats, 
                vdb_response,
                websocket
            )
            
            if datasets_with_formats:
                await send_websocket_message(Action.CHAT_DATASETS.value, datasets_with_formats, websocket)
            
    
            # Add messages to history with timestamp and exchange_id
            timestamp = datetime.datetime.now().isoformat()
            exchange_id = len(messages) // 2
            messages.extend([
                {
                    "role": "user",
                    "content": user_question,
                    "timestamp": timestamp,
                    "exchange_id": exchange_id,
                },
                {
                    "role": "system",
                    "content": full_rag_response,
                    "timestamp": timestamp,
                    "exchange_id": exchange_id,
                    "datasets": datasets_with_formats if datasets_with_formats else None
                }
            ])
            
            # Don't send formatMarkdown again - it's already sent by the RAG workflow
            # await send_websocket_action("formatMarkdown", websocket)
    
        except Exception as error:
            logger.error("Server controller failed: %s", str(error))
            logger.error("Stack trace: %s", traceback.format_exc())
            await send_websocket_action(Action.STREAM_COMPLETE.value, websocket)

    async def _retry_and_send_wms_update(self, websocket: Any, uuid: str, wms_capabilities_url: str, title: str) -> None:
        """ Background task to retry fetching WMS capabilities with a longer timeout and send an update. """
        try:
            logger.info(f"Retrying WMS fetch for {uuid} ({title}) with {WMS_RETRY_TIMEOUT}s timeout...")
            wms_capabilities = await _fetch_wms_capabilities_async(wms_capabilities_url, timeout_seconds=WMS_RETRY_TIMEOUT)
            
            if wms_capabilities:
                # Construct the wms_info object structure expected by the frontend
                wms_info = {
                    "wms_url": wms_capabilities_url,
                    "available_layers": wms_capabilities.get("available_layers", []),
                    "available_formats": wms_capabilities.get("available_formats", []),
                    "title": title 
                }
                update_payload = {"uuid": uuid, "wmsInfo": wms_info}
                logger.info(f"Successfully fetched WMS for {uuid} on retry. Sending update.")
                await send_websocket_message(Action.UPDATE_DATASET_WMS.value, update_payload, websocket)
            else:
                logger.warning(f"WMS fetch for {uuid} still failed on retry with {WMS_RETRY_TIMEOUT}s timeout.")
                # Send update with wmsInfo: None to signal loading finished unsuccessfully
                update_payload = {"uuid": uuid, "wmsInfo": None}
                await send_websocket_message(Action.UPDATE_DATASET_WMS.value, update_payload, websocket)

        except Exception as e:
            logger.error(f"Error during WMS retry task for {uuid}: {e}")
            # Avoid crashing the server, just log the error

    async def handle_search_form_submit(self, websocket: Any, query: str) -> None:
        """
        Handle search form submission by processing the query, sending initial results,
        and launching background tasks to retry slow WMS fetches.

        Args:
            websocket: The client websocket connection.
            query: The search query submitted by the user.
        """
        try:
            # 1. Initial Fetch (using short WMS timeout internally)
            vdb_search_response = await get_vdb_search_response(query)
            datasets_with_status = await get_dataset_download_and_wms_status(vdb_search_response)
            
            # 2. Send Initial Results Immediately
            logger.info(f"Sending initial {len(datasets_with_status)} search results for query: '{query}'")
            await send_websocket_message(Action.SEARCH_VDB_RESULTS.value, datasets_with_status, websocket)

            # 3. Launch Background Retries for Timed-out WMS
            for dataset in datasets_with_status:
                # Check if WMS fetch likely timed out initially and needs retry
                # Condition: wmsUrl is the loading object and getcapabilitiesurl exists
                if isinstance(dataset.get('wmsUrl'), dict) and dataset.get('wmsUrl').get('loading') and dataset.get('getcapabilitiesurl'):
                    uuid = dataset.get('uuid')
                    url = dataset.get('getcapabilitiesurl')
                    title = dataset.get('title')
                    if uuid and url and title:
                        logger.info(f"Scheduling background WMS retry for {uuid} ({title})")
                        # Launch the retry task without awaiting it
                        asyncio.create_task(self._retry_and_send_wms_update(websocket, uuid, url, title))
                    else:
                        logger.warning(f"Skipping WMS retry for dataset due to missing info: {dataset}")

        except Exception as error:
            logger.error("Search failed: %s", str(error))
            logger.error("Stack trace: %s", traceback.format_exc())
            # await send_websocket_message("searchError", {"message": str(error)}, websocket)


    async def handle_message(self, websocket: Any, message: str) -> None:
        """
        Dispatch incoming messages to the appropriate handler based on the 'action' field.
        """
        try:
            data = json.loads(message)
            action = data.get("action")
            
            if not action:
                logger.warning("No action specified in message")
                return
                
            if action == Action.CHAT_FORM_SUBMIT.value:
                await self.handle_chat_form_submit(websocket, data["payload"])
                return
                
            elif action == Action.SEARCH_FORM_SUBMIT.value:
                asyncio.create_task(self.handle_search_form_submit(websocket, data["payload"]))
                return
                
            elif action == Action.SHOW_DATASET.value:                
                # TODO: Implement WMS logic
                pass
                
            else:
                logger.warning(f"Invalid action received: {action}")
                
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON message: {e}")
        except KeyError as e:
            logger.error(f"Missing required field in message: {e}")
        except Exception as e:
            logger.error(f"Unexpected error handling message: {e}")
            logger.debug(f"Message that caused error: {message}")

        # elif action == "downloadDataset":
        #     await self.handle_download_dataset(
        #         websocket,
        #         data["payload"]["uuid"],
        #         data["payload"]["selectedFormats"]
        #     )


    async def ws_handler(self, websocket: Any) -> None:
        """
        Handle the lifecycle of a WebSocket connection.
        """
        await self.register(websocket)
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except websockets.ConnectionClosed:
            logger.info("Connection closed")
        finally:
            await self.unregister(websocket)

# --- Helper function for WMS Capabilities --- 
async def _fetch_wms_capabilities(wms_url: str) -> Optional[Dict[str, Any]]:
    """ Fetches and parses WMS GetCapabilities. Returns dict with layers/formats or None on error. """
    if not wms_url:
        return None
    
    logger.info(f"Helper: Fetching WMS capabilities for {wms_url}")
    try:
        # Run blocking requests call in executor
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, lambda: requests.get(wms_url, timeout=10))
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        
        # Run blocking XML parsing in executor
        xml_content = response.content
        tree = await loop.run_in_executor(None, lambda: ElementTree.fromstring(xml_content))

        ns = {"wms": "http://www.opengis.net/wms"}
        layers = []
        for layer in tree.findall(".//wms:Layer", ns):
            name = layer.find("wms:Name", ns)
            title = layer.find("wms:Title", ns)
            if name is not None and title is not None:
                layers.append({"name": name.text, "title": title.text})

        formats = [fmt.text for fmt in tree.findall(".//wms:GetMap/wms:Format", ns)]
        
        logger.info(f"Helper: Successfully fetched {len(layers)} layers for {wms_url}")
        return {
            "available_layers": layers,
            "available_formats": formats
        }

    except requests.exceptions.RequestException as e:
        logger.error(f"Helper: WMS request failed for {wms_url}: {str(e)}")
        return None # Indicate failure
    except ElementTree.ParseError as e:
        logger.error(f"Helper: Failed to parse WMS XML for {wms_url}: {str(e)}")
        return None # Indicate failure
    except Exception as e:
        logger.error(f"Helper: Unexpected error fetching WMS for {wms_url}: {str(e)}")
        return None # Indicate failure
# --- End WMS Helper --- 

# Add WMS endpoint
@app.route('/wms-info', methods=['GET'])
def get_wms_info():
    """ Handle WMS information requests """
    wms_url = request.args.get('url')
    if not wms_url:
        return jsonify({"error": "WMS URL is required"}), 400

    try:
        capabilities = asyncio.run(_fetch_wms_capabilities(wms_url))
        if capabilities:
            return jsonify(capabilities)
        else:
            return jsonify({"error": "Failed to fetch WMS capabilities"}), 500

    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500
    except ElementTree.ParseError:
        return jsonify({"error": "Failed to parse WMS XML response"}), 500

# Add Download Dataset Endpoint
@app.route('/download-dataset', methods=['POST'])
def download_dataset_endpoint():
    """ Handle requests to order a dataset download link """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON payload"}), 400

        metadata_uuid = data.get('metadataUuid')
        download_formats = data.get('downloadFormats')

        if not metadata_uuid or not download_formats:
            return jsonify({"error": "Missing metadataUuid or downloadFormats"}), 400
        
        logger.info(f"Received download request for UUID: {metadata_uuid} with formats: {download_formats}")

        # --- Run async helper in event loop ---
        async def run_get_url():
             return await get_download_url(metadata_uuid, download_formats)
        download_url = asyncio.run(run_get_url())
        # -------------------------------------

        if download_url:
            logger.info(f"Successfully obtained download URL for {metadata_uuid}: {download_url}")
            return jsonify({"downloadUrl": download_url})
        else:
            # This might happen if the order completes but returns no files (unlikely but possible)
            logger.warning(f"Order completed for {metadata_uuid} but no download URL was returned.")
            return jsonify({"error": "Order processed, but no download URL available."}), 404

    except RuntimeError as e:
        # Handle specific errors like restricted datasets or network issues from get_download_url
        logger.error(f"Error ordering download for {metadata_uuid}: {str(e)}")
        # Check if it's a restriction error specifically
        if "Order contains restricted datasets" in str(e):
             return jsonify({"error": "Dataset is restricted and cannot be ordered automatically."}), 403 # Forbidden
        return jsonify({"error": f"Failed to process download order: {str(e)}"}), 500
    except Exception as e:
        # Catch any other unexpected errors
        logger.error(f"Unexpected error in /download-dataset endpoint: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "An unexpected server error occurred."}), 500

# Add Endpoint to get Download URL with Default Formats
@app.route('/get-default-download-url/<metadata_uuid>', methods=['GET'])
def get_default_download_url_endpoint(metadata_uuid: str):
    """ Get a download URL for a dataset using default format/area/projection settings. """
    if not metadata_uuid:
        return jsonify({"error": "Metadata UUID is required"}), 400

    logger.info(f"Received request for default download URL for UUID: {metadata_uuid}")

    try:
        # --- Run async helpers in event loop ---
        async def run_get_defaults_and_url():
            # 1. Get default format selection
            default_formats = await get_standard_or_first_format(metadata_uuid)

            if not default_formats:
                logger.warning(f"Could not find default/any download formats for {metadata_uuid}")
                # Need a way to signal this specific failure case back
                return None, "No default formats found"
            
            logger.info(f"Found default formats for {metadata_uuid}: {default_formats}")

            # 2. Request the download URL using these formats
            url = await get_download_url(metadata_uuid, default_formats)
            return url, None # Return url and no error message

        download_url, error_message = asyncio.run(run_get_defaults_and_url())
        # ------------------------------------

        # Handle error cases from the async run
        if error_message == "No default formats found":
             return jsonify({"error": "No default download formats found for this dataset."}), 404
        elif error_message:
             # This case shouldn't be hit based on current logic, but for safety
             return jsonify({"error": error_message}), 500

        # Handle success cases
        if download_url:
            logger.info(f"Successfully obtained default download URL for {metadata_uuid}: {download_url}")
            return jsonify({"downloadUrl": download_url})
        else:
            logger.warning(f"Order completed for {metadata_uuid} using defaults, but no download URL was returned.")
            return jsonify({"error": "Order processed using defaults, but no download URL available."}), 404

    except RuntimeError as e:
        # Handle specific errors like restricted datasets or network issues
        logger.error(f"Error ordering default download for {metadata_uuid}: {str(e)}")
        if "Order contains restricted datasets" in str(e):
             return jsonify({"error": "Dataset is restricted and cannot be ordered automatically."}), 403
        return jsonify({"error": f"Failed to process default download order: {str(e)}"}), 500
    except Exception as e:
        # Catch any other unexpected errors
        logger.error(f"Unexpected error in /get-default-download-url endpoint for {metadata_uuid}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "An unexpected server error occurred."}), 500

# Add Endpoint to get raw Download Formats list (area/projection/format details)
@app.route('/get-download-formats/<metadata_uuid>', methods=['GET'])
def get_download_formats_endpoint(metadata_uuid: str):
    """ Get the raw list of available download formats (areas, projections, formats) for a dataset. """
    if not metadata_uuid:
        return jsonify({"error": "Metadata UUID is required"}), 400

    logger.info(f"Received request for download formats for UUID: {metadata_uuid}")

    try:
        # --- Run async helper in event loop ---
        async def run_fetch_area_data():
            return await fetch_area_data(metadata_uuid)
        
        formats_list = asyncio.run(run_fetch_area_data())
        # ------------------------------------
        
        # fetch_area_data returns [] on error or if not found/restricted
        if not formats_list:
             logger.warning(f"No download formats found or dataset is restricted/inaccessible for {metadata_uuid}")
             # Return empty list with 404 to indicate not found or no formats
             return jsonify([]), 404 
        
        logger.info(f"Successfully fetched download formats for {metadata_uuid}")
        return jsonify(formats_list)

    except Exception as e:
        # Catch any other unexpected errors during the endpoint execution itself
        logger.error(f"Unexpected error in /get-download-formats endpoint for {metadata_uuid}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "An unexpected server error occurred fetching formats."}), 500

# Add Endpoint to get Aggregated Details for Multiple Datasets
@app.route('/get-datasets-details', methods=['POST'])
def get_datasets_details_endpoint():
    """ Fetch aggregated details (formats, default URL, WMS caps) for multiple datasets. """
    try:
        request_data = request.get_json()
        if not request_data or 'datasets' not in request_data or not isinstance(request_data['datasets'], list):
            return jsonify({"error": "Invalid payload. Expected {'datasets': [{'uuid': ..., 'wmsServiceUrl': ...}] }"}), 400
        
        datasets_input = request_data['datasets']
        logger.info(f"Received request for details for {len(datasets_input)} datasets.")

        # --- Run async helper for all datasets concurrently ---
        async def _get_single_dataset_details(dataset_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
            uuid = dataset_info.get('uuid')
            wms_service_url = dataset_info.get('wmsServiceUrl') # Can be None
            details = {
                "downloadFormats": [],
                "downloadUrl": None,
                "wmsCapabilities": None,
                "restricted": False, # Default
                "error": None
            }

            if not uuid:
                details["error"] = "Missing UUID"
                # Return immediately with error for this entry, but don't fail others
                # Use a placeholder UUID if missing to avoid key errors later, though this shouldn't happen with validation
                return dataset_info.get('uuid', 'missing_uuid'), details 

            try:
                # Fetch formats and default URL concurrently for this UUID
                formats_task = asyncio.create_task(fetch_area_data(uuid))
                default_format_task = asyncio.create_task(get_standard_or_first_format(uuid))
                
                # Fetch WMS caps concurrently if URL provided
                wms_task = None
                if wms_service_url:
                    wms_task = asyncio.create_task(_fetch_wms_capabilities(wms_service_url))
                
                # Await download formats
                details["downloadFormats"] = await formats_task

                # Await default format and then try to get URL
                default_formats = await default_format_task
                if default_formats:
                    try:
                        details["downloadUrl"] = await get_download_url(uuid, default_formats)
                    except RuntimeError as e:
                        if "Order contains restricted datasets" in str(e):
                            details["restricted"] = True
                            details["error"] = "Dataset is restricted"
                        else:
                             details["error"] = f"Download order failed: {str(e)}"
                        # Don't re-raise, just note the error and restriction status
                else:
                    # If no default formats, no download URL can be obtained
                    details["error"] = details.get("error") or "No default formats found" # Keep restriction error if it happened

                # Await WMS capabilities if task exists
                if wms_task:
                    details["wmsCapabilities"] = await wms_task
                
            except Exception as e:
                logger.error(f"Error processing details for UUID {uuid}: {str(e)}")
                details["error"] = f"Unexpected error fetching details: {str(e)}" 
            
            return uuid, details

        async def run_all_details():
            tasks = [_get_single_dataset_details(ds_info) for ds_info in datasets_input]
            results = await asyncio.gather(*tasks) # Returns list of (uuid, details) tuples
            return dict(results) # Convert list of tuples to dictionary
        
        aggregated_details = asyncio.run(run_all_details())
        # -----------------------------------------------
        
        logger.info(f"Successfully processed details for {len(aggregated_details)} datasets.")
        return jsonify(aggregated_details)

    except Exception as e:
        logger.error(f"Unexpected error in /get-datasets-details endpoint: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "An unexpected server error occurred."}), 500

# Add Endpoint to perform HTTP Search + Detail Fetching combined
@app.route('/search-http', methods=['GET'])
def search_http_endpoint():
    """ Performs search against Geonorge HTTP API and fetches all details. """
    term = request.args.get('term')
    if not term or not term.strip():
        return jsonify({"error": "Search term is required"}), 400

    logger.info(f"Received HTTP search request for term: '{term}'")
    limit = 20 # Keep limit consistent with frontend
    geonorge_api_url = f"https://kartkatalog.geonorge.no/api/search?text={requests.utils.quote(term)}&facets[1]name=type&facets[1]value=dataset&limit={limit}"

    try:
        # --- Step 1: Call Geonorge Search API ---
        logger.info(f"Calling Geonorge API: {geonorge_api_url}")
        # Use asyncio.run for the async operation within the sync endpoint
        async def _fetch_geonorge():
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, lambda: requests.get(geonorge_api_url, timeout=15))
            response.raise_for_status()
            return response.json()
        geonorge_data = asyncio.run(_fetch_geonorge()) # <-- Use asyncio.run
        initial_results = geonorge_data.get("Results", [])
        logger.info(f"Geonorge API returned {len(initial_results)} results.")
        # ----------------------------------------

        if not initial_results:
            return jsonify([]) # Return empty list if no results

        # --- Step 2: Prepare for Detail Fetching ---
        # Helper to find WMS URL from Geonorge result item
        def find_wms_service_url(item):
            # Prioritize ServiceDistributionUrlForDataset if available
            if item.get("ServiceDistributionUrlForDataset"):
                 return item.get("ServiceDistributionUrlForDataset")
            # Fallback check in DatasetServices (less common for direct dataset WMS)
            if item.get("DatasetServices"):
                for service in item["DatasetServices"]:
                    if isinstance(service, dict):
                        if service.get("Protocol") == "OGC:WMS" and service.get("GetCapabilitiesUrl"):
                            return service.get("GetCapabilitiesUrl")
            return None

        datasets_to_fetch = [
            {
                "uuid": item.get("Uuid"),
                "wmsServiceUrl": find_wms_service_url(item)
            }
            for item in initial_results if item.get("Uuid")
        ]
        # -------------------------------------------

        # --- Step 3: Fetch Details (Optimized) ---
        async def _get_single_dataset_details(dataset_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
             uuid = dataset_info.get('uuid')
             wms_service_url = dataset_info.get('wmsServiceUrl') 
             details = {"downloadFormats": [], "downloadUrl": None, "wmsCapabilities": None, "restricted": False, "error": None}
             if not uuid: return 'missing_uuid', details

             try:
                 # 1. Fetch Area/Formats data first
                 area_data = await fetch_area_data(uuid)
                 details["downloadFormats"] = area_data # Store it immediately
                 
                 # 2. Prepare concurrent tasks for Default URL and WMS
                 tasks_to_run = []

                 # Task for Default URL generation
                 async def get_default_url_task():
                     default_formats = await get_standard_or_first_format(uuid, prefetched_area_data=area_data)
                     if default_formats:
                         try:
                             return await get_download_url(uuid, default_formats)
                         except RuntimeError as e:
                             if "Order contains restricted datasets" in str(e):
                                 details["restricted"] = True # Mark restriction
                                 details["error"] = "Restricted" # Set error
                             else:
                                 details["error"] = f"Download order failed: {str(e)}"
                             return None # Indicate URL fetch failed
                     else:
                         # If no default formats, combine error message if needed
                         details["error"] = details.get("error") or "No default formats found"
                         return None
                 tasks_to_run.append(asyncio.create_task(get_default_url_task(), name=f"url_{uuid}"))
                 
                 # Task for WMS capabilities
                 if wms_service_url:
                     tasks_to_run.append(asyncio.create_task(_fetch_wms_capabilities(wms_service_url), name=f"wms_{uuid}"))

                 # 3. Run tasks concurrently and process results
                 if tasks_to_run:
                    done, pending = await asyncio.wait(tasks_to_run, return_when=asyncio.ALL_COMPLETED)
                    for task in done:
                         task_name = task.get_name()
                         try:
                             result = task.result()
                             if task_name.startswith("url_"):
                                 details["downloadUrl"] = result # Will be None if it failed
                             elif task_name.startswith("wms_"):
                                 details["wmsCapabilities"] = result # Will be None if it failed
                         except Exception as task_exc:
                            # Catch exceptions from the tasks themselves (e.g., network errors inside helpers)
                            logger.error(f"Error in detail fetch task {task_name} for UUID {uuid}: {task_exc}")
                            # Add/update error field, don't overwrite restriction error
                            if task_name.startswith("url_"):
                                details["error"] = details.get("error") or f"Failed to get download URL: {task_exc}"
                            elif task_name.startswith("wms_"):
                                details["error"] = details.get("error") or f"Failed to get WMS caps: {task_exc}"

             except Exception as e:
                 # Catch errors during the initial area_data fetch or task setup
                 logger.error(f"Error processing details for UUID {uuid}: {str(e)}")
                 details["error"] = f"Unexpected error fetching details: {str(e)}" 
             return uuid, details

        async def run_all_details(datasets_input):
            tasks = [_get_single_dataset_details(ds_info) for ds_info in datasets_input]
            results = await asyncio.gather(*tasks)
            return dict(results)
        
        # Use asyncio.run for the async operation within the sync endpoint
        aggregated_details = asyncio.run(run_all_details(datasets_to_fetch)) # <-- Use asyncio.run
        logger.info(f"Fetched details for {len(aggregated_details)} UUIDs.")
        # ---------------------------------------------------------------------
        
        # --- Step 4: Combine and Format Output ---
        final_results_list = []
        for item in initial_results:
            uuid = item.get("Uuid")
            if not uuid:
                continue # Skip results without UUID
            
            details = aggregated_details.get(uuid)
            if not details: 
                logger.warning(f"No details found for UUID {uuid} after fetching. Skipping.")
                continue

            # Construct WMS URL object for frontend
            wms_url_obj = None
            wms_service_url = find_wms_service_url(item)
            if wms_service_url:
                wms_url_obj = {
                    "wms_url": wms_service_url,
                    "available_layers": [], # Default empty
                    "title": item.get("Title", "") # Use dataset title as placeholder
                }
                if details.get("wmsCapabilities") and details["wmsCapabilities"].get("available_layers"):
                     wms_url_obj["available_layers"] = details["wmsCapabilities"]["available_layers"]

            result_obj = {
                "uuid": uuid,
                "title": item.get("Title"),
                "restricted": details.get("restricted", item.get("AccessIsRestricted", False)),
                "downloadUrl": details.get("downloadUrl"),
                "downloadFormats": details.get("downloadFormats", []), 
                "wmsUrl": wms_url_obj,
                # Add other fields if needed/available and expected by frontend SearchResult type
            }
            final_results_list.append(result_obj)
        # -----------------------------------------

        logger.info(f"Prepared {len(final_results_list)} final results for term '{term}'.")
        return jsonify(final_results_list)

    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to call Geonorge API for term '{term}': {str(e)}")
        return jsonify({"error": f"Failed to contact Geonorge Search API: {str(e)}"}), 502 # Bad Gateway
    except Exception as e:
        logger.error(f"Unexpected error in /search-http endpoint for term '{term}': {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "An unexpected server error occurred during search."}), 500

def run_flask():
    """Run Flask in a separate thread"""
    host = CONFIG.get("server", {}).get("host", "0.0.0.0") # Bind to all interfaces
    http_port = CONFIG.get("server", {}).get("http_port", 5000)
    app.run(host=host, port=http_port, debug=False, use_reloader=False)

async def main() -> None:
    """
    Initialize and run both the WebSocket server and Flask app
    """
    server = ChatServer()
    host = CONFIG.get("server", {}).get("host", "0.0.0.0") # Bind to all interfaces
    ws_port = CONFIG.get("server", {}).get("port", 8080)

    # --- CORS Handling for websockets --- 
    # ALLOWED ORIGINS, TODO: Make this dynamic for production/docker
    allowed_origins = [
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://geogpt.geokrs.no"
    ]
    logger.info(f"Allowed WebSocket origins: {allowed_origins}")

    async def process_request(path: str, request_headers: websockets.Headers) -> Optional[Tuple[int, websockets.Headers, bytes]]:
        """Handles CORS preflight requests and checks origin for WebSocket connections."""
        
        actual_headers = None
        if hasattr(request_headers, 'get'): # Check if it behaves like a dict/Headers object
            actual_headers = request_headers
        elif hasattr(request_headers, 'headers') and hasattr(request_headers.headers, 'get'): # Check if it has a .headers attribute which behaves like a dict
            actual_headers = request_headers.headers
        else:
            logger.error(f"Could not extract headers from request_headers object of type: {type(request_headers)}")
            return (500, {}, b"Internal Server Error\n") # Cannot process headers

        origin = actual_headers.get("Origin")
        if origin not in allowed_origins:
            logger.warning(f"Rejected WebSocket connection from invalid origin: {origin}")
            return (403, {}, b"Forbidden\n") 

        # Handle CORS preflight (OPTIONS) request
        # Check based on the extracted headers
        if actual_headers.get("Access-Control-Request-Method"):
            # This is likely an OPTIONS request
            response_headers = [
                ("Access-Control-Allow-Origin", origin),
                ("Access-Control-Allow-Methods", "GET, OPTIONS"),
                ("Access-Control-Allow-Headers", "content-type"), 
                ("Access-Control-Max-Age", "86400"), # Cache preflight response for 1 day
                ("Access-Control-Allow-Credentials", "true"),
            ]
            logger.debug(f"Responding to OPTIONS request from {origin}")
            # Ensure response headers are in the correct format for the tuple
            response_headers_dict = websockets.datastructures.Headers(response_headers)
            return (200, response_headers_dict, b"OK\n") # Return HTTP 200 OK

        # If it's not an OPTIONS request and origin is allowed, let the handshake proceed
        logger.debug(f"Allowing GET request from allowed origin: {origin}")
        return None # Let websockets library handle the handshake

    # Start WebSocket server with CORS handling
    ws_server = await websockets.serve(
        server.ws_handler,
        host,
        ws_port,
        compression=None,
        process_request=process_request
    )
    logger.info("WebSocket server running on ws://%s:%s", host, ws_port)

    # Start Flask server in a separate thread
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, run_flask)

    # Keep the WebSocket server running
    await ws_server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())
