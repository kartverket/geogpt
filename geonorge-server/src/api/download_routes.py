# API routes for download-related endpoints will be defined here. 

import asyncio
import logging
import traceback
from flask import Blueprint, jsonify, request

from helpers.download import (
    get_download_url,
    get_standard_or_first_format,
    fetch_area_data
)

logger = logging.getLogger(__name__)

download_bp = Blueprint('download_bp', __name__)

@download_bp.route('/download-dataset', methods=['POST'])
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

        async def run_get_url():
             return await get_download_url(metadata_uuid, download_formats)
        download_url = asyncio.run(run_get_url())

        if download_url:
            logger.info(f"Successfully obtained download URL for {metadata_uuid}: {download_url}")
            return jsonify({"downloadUrl": download_url})
        else:
            logger.warning(f"Order completed for {metadata_uuid} but no download URL was returned.")
            return jsonify({"error": "Order processed, but no download URL available."}), 404

    except RuntimeError as e:
        logger.error(f"Error ordering download for {metadata_uuid}: {str(e)}")
        if "Order contains restricted datasets" in str(e):
             return jsonify({"error": "Dataset is restricted and cannot be ordered automatically."}), 403
        return jsonify({"error": f"Failed to process download order: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Unexpected error in /download-dataset endpoint: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "An unexpected server error occurred."}), 500

@download_bp.route('/get-default-download-url/<metadata_uuid>', methods=['GET'])
def get_default_download_url_endpoint(metadata_uuid: str):
    """ Get a download URL for a dataset using default format/area/projection settings. """
    if not metadata_uuid:
        return jsonify({"error": "Metadata UUID is required"}), 400

    logger.info(f"Received request for default download URL for UUID: {metadata_uuid}")

    try:
        async def run_get_defaults_and_url():
            default_formats = await get_standard_or_first_format(metadata_uuid)
            if not default_formats:
                logger.warning(f"Could not find default/any download formats for {metadata_uuid}")
                return None, "No default formats found"
            logger.info(f"Found default formats for {metadata_uuid}: {default_formats}")
            url = await get_download_url(metadata_uuid, default_formats)
            return url, None

        download_url, error_message = asyncio.run(run_get_defaults_and_url())

        if error_message == "No default formats found":
             return jsonify({"error": "No default download formats found for this dataset."}), 404
        elif error_message:
             return jsonify({"error": error_message}), 500

        if download_url:
            logger.info(f"Successfully obtained default download URL for {metadata_uuid}: {download_url}")
            return jsonify({"downloadUrl": download_url})
        else:
            logger.warning(f"Order completed for {metadata_uuid} using defaults, but no download URL was returned.")
            return jsonify({"error": "Order processed using defaults, but no download URL available."}), 404

    except RuntimeError as e:
        logger.error(f"Error ordering default download for {metadata_uuid}: {str(e)}")
        if "Order contains restricted datasets" in str(e):
             return jsonify({"error": "Dataset is restricted and cannot be ordered automatically."}), 403
        return jsonify({"error": f"Failed to process default download order: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Unexpected error in /get-default-download-url endpoint for {metadata_uuid}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "An unexpected server error occurred."}), 500

@download_bp.route('/get-download-formats/<metadata_uuid>', methods=['GET'])
def get_download_formats_endpoint(metadata_uuid: str):
    """ Get the raw list of available download formats (areas, projections, formats) for a dataset. """ 
    if not metadata_uuid:
        return jsonify({"error": "Metadata UUID is required"}), 400

    logger.info(f"Received request for download formats for UUID: {metadata_uuid}")

    try:
        async def run_fetch_area_data():
            return await fetch_area_data(metadata_uuid)
        
        formats_list = asyncio.run(run_fetch_area_data())
        
        if not formats_list:
             logger.warning(f"No download formats found or dataset is restricted/inaccessible for {metadata_uuid}")
             return jsonify([]), 404 
        
        logger.info(f"Successfully fetched download formats for {metadata_uuid}")
        return jsonify(formats_list)

    except Exception as e:
        logger.error(f"Unexpected error in /get-download-formats endpoint for {metadata_uuid}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "An unexpected server error occurred fetching formats."}), 500 