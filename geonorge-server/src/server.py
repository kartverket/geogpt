from concurrent.futures import ThreadPoolExecutor
from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
from typing import Any, Dict, List, Set
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
    get_dataset_download_and_wms_status
)
from helpers.vector_database import get_vdb_response, get_vdb_search_response
from helpers.websocket import send_websocket_message, send_websocket_action

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
            vdb_response = await get_vdb_response(user_question)
            
            # Get only download formats for each dataset in vdb_response
            datasets_with_formats = []
            if vdb_response:
                datasets_with_formats = await get_dataset_download_formats(vdb_response)
            
            await send_websocket_message(Action.USER_MESSAGE.value, user_question, websocket)

            # Send RAG request with streaming
            full_rag_response = await get_rag_response(
                user_question,
                datasets_with_formats, 
                vdb_response,
                websocket
            )
            
            if datasets_with_formats:
                await send_websocket_message(Action.CHAT_DATASETS.value, datasets_with_formats, websocket)
            
            await send_websocket_action(Action.STREAM_COMPLETE.value, websocket)
    
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
            
            await send_websocket_action(Action.FORMAT_MARKDOWN.value, websocket)
    
        except Exception as error:
            logger.error("Server controller failed: %s", str(error))
            logger.error("Stack trace: %s", traceback.format_exc())
            await send_websocket_action(Action.STREAM_COMPLETE.value, websocket)

    async def handle_search_form_submit(self, websocket: Any, query: str) -> None:
        """
        Handle search form submission by processing the query and sending search results.

        Args:
            websocket: The client websocket connection.
            query: The search query submitted by the user.
        """
        try:
            vdb_search_response = await get_vdb_search_response(query)
            datasets_with_status = await get_dataset_download_and_wms_status(vdb_search_response)
            await send_websocket_message(Action.SEARCH_VDB_RESULTS.value, datasets_with_status, websocket)

        except Exception as error:
            logger.error("Search failed: %s", str(error))
            logger.error("Stack trace: %s", traceback.format_exc())

    # Uncomment and update if needed for dataset download functionality.
    # async def handle_download_dataset(self, websocket: Any, dataset_uuid: str, chosen_formats: List[str]) -> None:
    #     try:
    #         is_downloadable = await dataset_has_download(dataset_uuid)
    #         if is_downloadable:
    #             dataset_download_url = await get_download_url(dataset_uuid, chosen_formats)
    #             await send_websocket_message("downloadDatasetOrder", dataset_download_url, websocket)
    #     except Exception as error:
    #         logger.error("Download failed: %s", str(error))
    #         logger.error("Stack trace: %s", traceback.format_exc())

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

# Add WMS endpoint
@app.route('/wms-info', methods=['GET'])
def get_wms_info():
    """ Handle WMS information requests """
    wms_url = request.args.get('url')
    if not wms_url:
        return jsonify({"error": "WMS URL is required"}), 400

    try:
        response = requests.get(wms_url, timeout=10)
        response.raise_for_status()
        tree = ElementTree.fromstring(response.content)

        ns = {"wms": "http://www.opengis.net/wms"}

        layers = []
        for layer in tree.findall(".//wms:Layer", ns):
            name = layer.find("wms:Name", ns)
            title = layer.find("wms:Title", ns)
            if name is not None and title is not None:
                layers.append({"name": name.text, "title": title.text})

        formats = [
            fmt.text for fmt in tree.findall(".//wms:GetMap/wms:Format", ns)
        ]

        return jsonify({
            "wms_url": wms_url,
            "available_layers": layers,
            "available_formats": formats
        })

    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500
    except ElementTree.ParseError:
        return jsonify({"error": "Failed to parse WMS XML response"}), 500

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

    # Start WebSocket server
    ws_server = await websockets.serve(
        server.ws_handler,
        host,
        ws_port,
        compression=None
    )
    logger.info("WebSocket server running on ws://%s:%s", host, ws_port)

    # Start Flask server in a separate thread
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, run_flask)

    # Keep the WebSocket server running
    await ws_server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())
