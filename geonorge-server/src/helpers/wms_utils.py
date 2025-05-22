# Utility functions for WMS (Web Map Service). 

import asyncio
import logging
import requests
from typing import Any, Dict, Optional
from xml.etree import ElementTree

logger = logging.getLogger(__name__)

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