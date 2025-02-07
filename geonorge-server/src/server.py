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

# Import configuration and helpers
from config import CONFIG
from helpers.retrieval_augmented_generation import (
    get_rag_context,
    get_rag_response,
    insert_image_rag_response,
)
from helpers.download import (
    get_standard_or_first_format,
    dataset_has_download,
    get_download_url,
    get_dataset_download_and_wms_status,
)
from helpers.vector_database import get_vdb_response, get_vdb_search_response
from helpers.websocket import send_websocket_message, send_websocket_action
from helpers.memory_utils import build_memory_context

# --- LangChain conversation chain imports ---
from langchain.chains import ConversationChain
from langchain.memory import ConversationBufferMemory
# Use the updated AzureChatOpenAI from langchain_openai package (install via `pip install -U langchain-openai`)
from langchain_openai import AzureChatOpenAI

class ChatServer:
    """
    A WebSocket chat server handling chat and search form submissions.
    This version uses a ConversationChain with memory for each client.
    """

    def __init__(self) -> None:
        self.clients: Set[Any] = set()
        # Each client gets its own ConversationChain instance.
        self.client_chains: Dict[Any, ConversationChain] = {}

    async def register(self, websocket: Any) -> None:
        """
        Register a new websocket client and initialize its conversation chain.
        """
        self.clients.add(websocket)
        # Update memory key to "history" (the prompt expects ['history', 'input']).
        memory = ConversationBufferMemory(memory_key="history", return_messages=True)
        # Create a dedicated LLM instance (non‑streaming for chain memory management).
        llm = AzureChatOpenAI(
            deployment_name="gpt-4o-mini",  # Use your Azure deployment name
            openai_api_key=CONFIG["api"]["azure_gpt_api_key"],
            openai_api_version="2024-02-15-preview",
            azure_endpoint=CONFIG["api"]["azure_gpt_endpoint"],
            streaming=False,
            verbose=True
        )
        # ConversationChain is still available for now but will be deprecated in future versions.
        chain = ConversationChain(llm=llm, memory=memory)
        self.client_chains[websocket] = chain

    async def unregister(self, websocket: Any) -> None:
        """
        Unregister a websocket client.
        """
        self.clients.remove(websocket)
        self.client_chains.pop(websocket, None)

    async def handle_chat_form_submit(self, websocket: Any, user_question: str) -> None:
        """
        Handle chat form submission by processing the user's question using
        the ConversationChain (which automatically includes past chat history).
        We also integrate additional RAG context from our vector database.
        """
        try:
            # Get the vector DB response and build the base RAG context.
            vdb_response = await get_vdb_response(user_question)
            base_rag_context = await get_rag_context(vdb_response)

            # Retrieve the chain for this client.
            chain = self.client_chains.get(websocket)
            if not chain:
                logger.error("No conversation chain found for client.")
                return

            # Build an enhanced memory context (for example, summarizing previous messages)
            # The chain's memory messages are stored under the "history" key.
            memory_context = await build_memory_context(chain.memory.chat_memory.messages)
            # Combine the memory context, RAG context, and the new user question.
            combined_input = memory_context + base_rag_context + "\n\n" + user_question

            # Display the user's question.
            await send_websocket_message("userMessage", user_question, websocket)

            # Use the conversation chain to get the answer.
            answer = chain.predict(input=combined_input)

            await send_websocket_message("chatStream", answer, websocket)
            await send_websocket_action("streamComplete", websocket)
            await insert_image_rag_response(answer, vdb_response, websocket)

            # Tell the frontend to format markdown if needed.
            await send_websocket_action("formatMarkdown", websocket)

        except Exception as error:
            logger.error("Server controller failed: %s", str(error))
            logger.error("Stack trace: %s", traceback.format_exc())
            await send_websocket_action("streamComplete", websocket)

    async def handle_search_form_submit(self, websocket: Any, query: str) -> None:
        """
        Handle search form submission by processing the query and sending search results.
        """
        try:
            vdb_search_response = await get_vdb_search_response(query)
            datasets_with_status = await get_dataset_download_and_wms_status(vdb_search_response)
            await send_websocket_message("searchVdbResults", datasets_with_status, websocket)

        except Exception as error:
            logger.error("Search failed: %s", str(error))
            logger.error("Stack trace: %s", traceback.format_exc())

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
                # TODO: Implement WMS logic if needed.
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