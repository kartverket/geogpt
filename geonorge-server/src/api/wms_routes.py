# API routes for WMS-related endpoints will be defined here. 

import asyncio
import requests
from xml.etree import ElementTree
from flask import Blueprint, jsonify, request
import logging

# Import the helper function
from helpers.wms_utils import _fetch_wms_capabilities

logger = logging.getLogger(__name__)

wms_bp = Blueprint('wms_bp', __name__)

@wms_bp.route('/wms-info', methods=['GET'])
def get_wms_info():
    """ Handle WMS information requests """
    wms_url = request.args.get('url')
    if not wms_url:
        return jsonify({"error": "WMS URL is required"}), 400

    try:
        # Note: _fetch_wms_capabilities is async, so we need to run it in an event loop.
        capabilities = asyncio.run(_fetch_wms_capabilities(wms_url))
        if capabilities:
            return jsonify(capabilities)
        else:
            return jsonify({"error": "Failed to fetch WMS capabilities"}), 500

    except requests.exceptions.RequestException as e:
        logger.error(f"WMS request failed in /wms-info endpoint for {wms_url}: {str(e)}")
        return jsonify({"error": str(e)}), 500
    except ElementTree.ParseError as e:
        logger.error(f"Failed to parse WMS XML in /wms-info endpoint for {wms_url}: {str(e)}")
        return jsonify({"error": "Failed to parse WMS XML response"}), 500
    except Exception as e:
        logger.error(f"Unexpected error in /wms-info endpoint for {wms_url}: {str(e)}")
        return jsonify({"error": "An unexpected server error occurred."}), 500 