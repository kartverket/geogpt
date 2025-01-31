import asyncio
import json
import websockets
import sys
from pathlib import Path
import datetime

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

from config import CONFIG
from helpers.retrieval_augmented_generation import get_rag_context, get_rag_response, insert_image_rag_response
from helpers.download import get_standard_or_first_format, dataset_has_download, get_download_url, get_dataset_download_and_wms_status
from helpers.vector_database import get_vdb_response, get_vdb_search_response
from helpers.websocket import send_websocket_message, send_websocket_action

class ChatServer:
    def __init__(self):
        self.clients = set()

    async def register(self, websocket):
        self.clients.add(websocket)
        websocket.messages = []

    async def unregister(self, websocket):
        self.clients.remove(websocket)

    async def handle_chat_form_submit(self, websocket, user_question):
        memory = websocket.messages[-10:]
        try:
            # Get VDB response and RAG context
            vdb_response = await get_vdb_response(user_question)
            rag_context = await get_rag_context(vdb_response)
    
            # Enhanced memory context formatting
            if memory:
                memory_context = "\n\nTidligere samtalehistorikk:\n"
                conversation_pairs = []
                
                # Group messages into Q&A pairs for big brain context
                for i in range(0, len(memory), 2):
                    if i + 1 < len(memory):
                        q = memory[i]['content']
                        a = memory[i + 1]['content']
                        conversation_pairs.append(f"Spørsmål: {q}\nSvar: {a}")
                
                memory_context += "\n\n".join(conversation_pairs)
                memory_context += "\n\nVIKTIG: Dette er et oppfølgingsspørsmål. Prioriter informasjon fra den tidligere samtalen før du introduserer nye datasett. Hvis spørsmålet er relatert til tidligere nevnte datasett, fokuser på disse først.\n\n"
                rag_context = memory_context + rag_context
                print("Context being used:", rag_context[:500] + "...")  # Debug print first 500 chars
                print("TESTESTSTEST", conversation_pairs)
    
            # Display user question in chat
            await send_websocket_message("userMessage", user_question, websocket)
    
            # Send RAG request with context and instruction
            full_rag_response = await get_rag_response(
                user_question,
                memory,
                rag_context,
                websocket
            )
            await send_websocket_action("streamComplete", websocket)

            # Add messages to history
            timestamp = datetime.datetime.now().isoformat()
            websocket.messages.extend([
                {
                    "role": "user",
                    "content": user_question,
                    "timestamp": timestamp,
                    "exchange_id": len(websocket.messages) // 2
                },
                {
                    "role": "system",
                    "content": full_rag_response,
                    "timestamp": timestamp,
                    "exchange_id": len(websocket.messages) // 2
                }
            ])

            # Handle image UI and markdown formatting
            await insert_image_rag_response(full_rag_response, vdb_response, websocket)
            await send_websocket_action("formatMarkdown", websocket) # Should be used in frontend for formatting based on action :=)

        except Exception as error:
            print(f"Server controller failed: {str(error)}")
            print(f"Stack trace: {error.__traceback__}")
            await send_websocket_action("streamComplete", websocket)

    async def handle_search_form_submit(self, websocket, query):
        try:
            vdb_search_response = await get_vdb_search_response(query)
            datasets_with_status = await get_dataset_download_and_wms_status(vdb_search_response)
            await send_websocket_message("searchVdbResults", datasets_with_status, websocket)

        except Exception as error:
            print(f"Search failed: {str(error)}")
            print(f"Stack trace: {error.__traceback__}")

    # async def handle_download_dataset(self, websocket, dataset_uuid, chosen_formats):
    #     try:
    #         is_downloadable = await dataset_has_download(dataset_uuid)
    #         if is_downloadable:
    #             dataset_download_url = await get_download_url(dataset_uuid, chosen_formats)
    #             await send_websocket_message("downloadDatasetOrder", dataset_download_url, websocket)

    #     except Exception as error:
    #         print(f"Download failed: {str(error)}")
    #         print(f"Stack trace: {error.__traceback__}")

    async def handle_message(self, websocket, message):
        data = json.loads(message)
        action = data.get('action')

        if action == "chatFormSubmit":
            await self.handle_chat_form_submit(websocket, data['payload'])
        elif action == "searchFormSubmit":
            await self.handle_search_form_submit(websocket, data['payload'])
        # elif action == "downloadDataset":
        #     await self.handle_download_dataset(
        #         websocket,
        #         data['payload']['uuid'],
        #         data['payload']['selectedFormats']
        #     )
        elif action == "showDataset":
            # TODO: Implement WMS logic
            pass
        else:
            print(f"Invalid action received: {action}")

    async def ws_handler(self, websocket):  # Remove path parameter
        await self.register(websocket)
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        finally:
            await self.unregister(websocket)

async def main():
    server = ChatServer()
    async with websockets.serve(
        server.ws_handler,
        "localhost",
        8080,
        compression=None  # Disable compression for better compatibility
    ):
        print("WebSocket server running on ws://localhost:8080")
        await asyncio.Future()  # Keep the server running

if __name__ == "__main__":
    asyncio.run(main())