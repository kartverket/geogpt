import asyncio
import json
import websockets
import sys
from pathlib import Path
import datetime
import logging
import traceback
from typing import Any, Dict, List, Set

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the project root to Python path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

# Import config directly from project root
from config import CONFIG

from helpers.retrieval_augmented_generation import (
    get_rag_context,
    get_rag_response
)
from helpers.download import (
    get_standard_or_first_format,
    dataset_has_download,
    get_download_url,
    get_dataset_download_and_wms_status,
)
from helpers.vector_database import get_vdb_response, get_vdb_search_response
from helpers.websocket import send_websocket_message, send_websocket_action

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
            # Get VDB response (still needed for image handling)
            vdb_response = await get_vdb_response(user_question)
            
            # Display user question in chat
            await send_websocket_message("userMessage", user_question, websocket)
    
            # Send RAG request with streaming
            full_rag_response = await get_rag_response(
                user_question,
                None,
                None,
                websocket
            )
            
            await send_websocket_action("streamComplete", websocket)
    
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
                }
            ])
    
            await send_websocket_action("formatMarkdown", websocket)
    
        except Exception as error:
            logger.error("Server controller failed: %s", str(error))
            logger.error("Stack trace: %s", traceback.format_exc())
            await send_websocket_action("streamComplete", websocket)

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
            await send_websocket_message("searchVdbResults", datasets_with_status, websocket)

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
                
            if action == "chatFormSubmit":
                await self.handle_chat_form_submit(websocket, data["payload"])
                return
                
            elif action == "searchFormSubmit":
                asyncio.create_task(self.handle_search_form_submit(websocket, data["payload"]))
                return
                
            elif action == "showDataset":
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


async def main() -> None:
    """
    Initialize and run the WebSocket server.
    """
    server = ChatServer()
    # Use host and port from configuration if available, else default values
    host = CONFIG.get("host", "localhost")
    port = CONFIG.get("port", 8080)
    async with websockets.serve(
        server.ws_handler,
        host,
        port,
        compression=None  # Disable compression for better compatibility
    ):
        logger.info("WebSocket server running on ws://%s:%s", host, port)
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    asyncio.run(main())
