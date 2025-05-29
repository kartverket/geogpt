# API routes for dataset details endpoints will be defined here. 

import asyncio
import logging
import traceback
from flask import Blueprint, jsonify, request
from typing import Any, Dict, Tuple

from helpers.download import (
    fetch_area_data,
    get_standard_or_first_format,
    get_download_url
)
from helpers.wms_utils import _fetch_wms_capabilities

logger = logging.getLogger(__name__)

details_bp = Blueprint('details_bp', __name__)

@details_bp.route('/get-datasets-details', methods=['POST'])
def get_datasets_details_endpoint():
    """ Fetch aggregated details (formats, default URL, WMS caps) for multiple datasets. """
    try:
        request_data = request.get_json()
        if not request_data or 'datasets' not in request_data or not isinstance(request_data['datasets'], list):
            return jsonify({"error": "Invalid payload. Expected {'datasets': [{'uuid': ..., 'wmsServiceUrl': ...}] }"}), 400
        
        datasets_input = request_data['datasets']
        logger.info(f"Received request for details for {len(datasets_input)} datasets.")

        async def _get_single_dataset_details(dataset_info: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
            uuid = dataset_info.get('uuid')
            wms_service_url = dataset_info.get('wmsServiceUrl')
            details = {
                "downloadFormats": [],
                "downloadUrl": None,
                "wmsCapabilities": None,
                "restricted": False,
                "error": None
            }

            if not uuid:
                details["error"] = "Missing UUID"
                return dataset_info.get('uuid', 'missing_uuid'), details 

            try:
                formats_task = asyncio.create_task(fetch_area_data(uuid))
                default_format_task = asyncio.create_task(get_standard_or_first_format(uuid))
                
                wms_task = None
                if wms_service_url:
                    wms_task = asyncio.create_task(_fetch_wms_capabilities(wms_service_url))
                
                details["downloadFormats"] = await formats_task

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
                else:
                    details["error"] = details.get("error") or "No default formats found"

                if wms_task:
                    details["wmsCapabilities"] = await wms_task
                
            except Exception as e:
                logger.error(f"Error processing details for UUID {uuid}: {str(e)}")
                details["error"] = f"Unexpected error fetching details: {str(e)}" 
            
            return uuid, details

        async def run_all_details():
            tasks = [_get_single_dataset_details(ds_info) for ds_info in datasets_input]
            results = await asyncio.gather(*tasks)
            return dict(results)
        
        aggregated_details = asyncio.run(run_all_details())
        
        logger.info(f"Successfully processed details for {len(aggregated_details)} datasets.")
        return jsonify(aggregated_details)

    except Exception as e:
        logger.error(f"Unexpected error in /get-datasets-details endpoint: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "An unexpected server error occurred."}), 500 