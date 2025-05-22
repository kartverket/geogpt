# API routes for search-related endpoints will be defined here. 

import asyncio
import logging
import traceback
import requests
from flask import Blueprint, jsonify, request
from typing import Any, Dict, Tuple

from helpers.download import (
    fetch_area_data,
    get_standard_or_first_format,
    get_download_url
)
from helpers.wms_utils import _fetch_wms_capabilities

logger = logging.getLogger(__name__)

search_bp = Blueprint('search_bp', __name__)

@search_bp.route('/search-http', methods=['GET'])
def search_http_endpoint():
    """ Performs search against Geonorge HTTP API and fetches all details. """
    term = request.args.get('term')
    if not term or not term.strip():
        return jsonify({"error": "Search term is required"}), 400

    logger.info(f"Received HTTP search request for term: '{term}'")
    limit = 20
    geonorge_api_url = f"https://kartkatalog.geonorge.no/api/search?text={requests.utils.quote(term)}&facets[1]name=type&facets[1]value=dataset&limit={limit}"

    try:
        logger.info(f"Calling Geonorge API: {geonorge_api_url}")
        async def _fetch_geonorge():
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, lambda: requests.get(geonorge_api_url, timeout=15))
            response.raise_for_status()
            return response.json()
        geonorge_data = asyncio.run(_fetch_geonorge())
        initial_results = geonorge_data.get("Results", [])
        logger.info(f"Geonorge API returned {len(initial_results)} results.")

        if not initial_results:
            return jsonify([])

        def find_wms_service_url(item):
            if item.get("ServiceDistributionUrlForDataset"):
                 return item.get("ServiceDistributionUrlForDataset")
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

        async def _get_single_dataset_details(dataset_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
             uuid = dataset_info.get('uuid')
             wms_service_url = dataset_info.get('wmsServiceUrl') 
             details = {"downloadFormats": [], "downloadUrl": None, "wmsCapabilities": None, "restricted": False, "error": None}
             if not uuid: return 'missing_uuid', details

             try:
                 area_data = await fetch_area_data(uuid)
                 details["downloadFormats"] = area_data
                 
                 tasks_to_run = []
                 async def get_default_url_task():
                     default_formats = await get_standard_or_first_format(uuid, prefetched_area_data=area_data)
                     if default_formats:
                         try:
                             return await get_download_url(uuid, default_formats)
                         except RuntimeError as e:
                             if "Order contains restricted datasets" in str(e):
                                 details["restricted"] = True
                                 details["error"] = "Restricted"
                             else:
                                 details["error"] = f"Download order failed: {str(e)}"
                             return None
                     else:
                         details["error"] = details.get("error") or "No default formats found"
                         return None
                 tasks_to_run.append(asyncio.create_task(get_default_url_task(), name=f"url_{uuid}"))
                 
                 if wms_service_url:
                     tasks_to_run.append(asyncio.create_task(_fetch_wms_capabilities(wms_service_url), name=f"wms_{uuid}"))

                 if tasks_to_run:
                    done, pending = await asyncio.wait(tasks_to_run, return_when=asyncio.ALL_COMPLETED)
                    for task in done:
                         task_name = task.get_name()
                         try:
                             result = task.result()
                             if task_name.startswith("url_"):
                                 details["downloadUrl"] = result
                             elif task_name.startswith("wms_"):
                                 details["wmsCapabilities"] = result
                         except Exception as task_exc:
                            logger.error(f"Error in detail fetch task {task_name} for UUID {uuid}: {task_exc}")
                            if task_name.startswith("url_"):
                                details["error"] = details.get("error") or f"Failed to get download URL: {task_exc}"
                            elif task_name.startswith("wms_"):
                                details["error"] = details.get("error") or f"Failed to get WMS caps: {task_exc}"

             except Exception as e:
                 logger.error(f"Error processing details for UUID {uuid}: {str(e)}")
                 details["error"] = f"Unexpected error fetching details: {str(e)}" 
             return uuid, details

        async def run_all_details(datasets_input):
            tasks = [_get_single_dataset_details(ds_info) for ds_info in datasets_input]
            results = await asyncio.gather(*tasks)
            return dict(results)
        
        aggregated_details = asyncio.run(run_all_details(datasets_to_fetch))
        logger.info(f"Fetched details for {len(aggregated_details)} UUIDs.")
        
        final_results_list = []
        for item in initial_results:
            uuid = item.get("Uuid")
            if not uuid:
                continue
            
            details = aggregated_details.get(uuid)
            if not details: 
                logger.warning(f"No details found for UUID {uuid} after fetching. Skipping.")
                continue

            wms_url_obj = None
            wms_service_url = find_wms_service_url(item)
            if wms_service_url:
                wms_url_obj = {
                    "wms_url": wms_service_url,
                    "available_layers": [],
                    "title": item.get("Title", "")
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
            }
            final_results_list.append(result_obj)

        logger.info(f"Prepared {len(final_results_list)} final results for term '{term}'.")
        return jsonify(final_results_list)

    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to call Geonorge API for term '{term}': {str(e)}")
        return jsonify({"error": f"Failed to contact Geonorge Search API: {str(e)}"}), 502
    except Exception as e:
        logger.error(f"Unexpected error in /search-http endpoint for term '{term}': {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "An unexpected server error occurred during search."}), 500 