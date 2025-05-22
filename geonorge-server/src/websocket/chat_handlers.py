# WebSocket ChatServer class and handlers will be defined here. 

import asyncio
import datetime
import json
import logging
import traceback
from typing import Any, Dict, List, Set
import websockets

from action_enums import Action
from agents.rag import get_rag_response
# from agents.utils.common import active_websockets # This will be handled by the calling code in server.py for now or refactored
from helpers.download import (
    get_dataset_download_formats,
    get_dataset_download_and_wms_status,
    _fetch_wms_capabilities_async
)
from helpers.vector_database import get_vdb_response, get_vdb_search_response
from helpers.websocket import send_websocket_message, send_websocket_action

logger = logging.getLogger(__name__)

# Constants
WMS_RETRY_TIMEOUT = 30

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
            from agents.utils.common import active_websockets # Keep this local for now
            websocket_id = str(id(websocket))
            active_websockets[websocket_id] = websocket
            print(f"DEBUG server: Directly registered websocket with ID {websocket_id} in common.active_websockets")
            print(f"DEBUG server: Active websockets now: {list(active_websockets.keys())}")
            
            vdb_response = await get_vdb_response(user_question)
            
            datasets_with_formats = []
            if vdb_response:
                datasets_with_formats = await get_dataset_download_formats(vdb_response)
            
            full_rag_response = await get_rag_response(
                user_question,
                datasets_with_formats, 
                vdb_response,
                websocket
            )
            
            if datasets_with_formats:
                await send_websocket_message(Action.CHAT_DATASETS.value, datasets_with_formats, websocket)
            
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
                update_payload = {"uuid": uuid, "wmsInfo": None}
                await send_websocket_message(Action.UPDATE_DATASET_WMS.value, update_payload, websocket)

        except Exception as e:
            logger.error(f"Error during WMS retry task for {uuid}: {e}")

    async def handle_search_form_submit(self, websocket: Any, query: str) -> None:
        """
        Handle search form submission by processing the query, sending initial results,
        and launching background tasks to retry slow WMS fetches.
        """
        try:
            vdb_search_response = await get_vdb_search_response(query)
            datasets_with_status = await get_dataset_download_and_wms_status(vdb_search_response)
            
            logger.info(f"Sending initial {len(datasets_with_status)} search results for query: '{query}'")
            await send_websocket_message(Action.SEARCH_VDB_RESULTS.value, datasets_with_status, websocket)

            for dataset in datasets_with_status:
                if isinstance(dataset.get('wmsUrl'), dict) and dataset.get('wmsUrl').get('loading') and dataset.get('getcapabilitiesurl'):
                    uuid = dataset.get('uuid')
                    url = dataset.get('getcapabilitiesurl')
                    title = dataset.get('title')
                    if uuid and url and title:
                        logger.info(f"Scheduling background WMS retry for {uuid} ({title})")
                        asyncio.create_task(self._retry_and_send_wms_update(websocket, uuid, url, title))
                    else:
                        logger.warning(f"Skipping WMS retry for dataset due to missing info: {dataset}")

        except Exception as error:
            logger.error("Search failed: %s", str(error))
            logger.error("Stack trace: %s", traceback.format_exc())

    async def handle_message(self, websocket: Any, message: str) -> None:
        """
        Dispatch incoming messages to the appropriate handler based on the 'action' field.
        """
        try:
            data = json.loads(message)
            action_value = data.get("action")
            
            if not action_value:
                logger.warning("No action specified in message")
                return
                
            if action_value == Action.CHAT_FORM_SUBMIT.value:
                await self.handle_chat_form_submit(websocket, data["payload"])
                return
                
            elif action_value == Action.SEARCH_FORM_SUBMIT.value:
                asyncio.create_task(self.handle_search_form_submit(websocket, data["payload"]))
                return
                
            elif action_value == Action.SHOW_DATASET.value:                
                pass
                
            else:
                logger.warning(f"Invalid action received: {action_value}")
                
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON message: {e}")
        except KeyError as e:
            logger.error(f"Missing required field in message: {e}")
        except Exception as e:
            logger.error(f"Unexpected error handling message: {e}")
            logger.debug(f"Message that caused error: {message}")

    async def ws_handler(self, websocket: Any) -> None:
        """
        Handle the lifecycle of a WebSocket connection.
        """
        await self.register(websocket)
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except websockets.ConnectionClosed: # Ensure websockets is imported in this file
            logger.info("Connection closed")
        finally:
            await self.unregister(websocket) 