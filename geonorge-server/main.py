import asyncio
import json
import websockets
import openai
# from fastapi import FastAPI
# import httpx

# 1) Import your vector DB retrieval
from helpers.vector_database import get_vdb_response, get_vdb_search_response
from helpers.retrieval_augmented_generation import (
    send_api_chat_request,
    build_rag_context, 
    force_insert_first_image
)
from helpers.download import get_dataset_download_and_wms_status
from helpers.websocket_utils import send_websocket_message
from config import CONFIG


openai.api_key = CONFIG["api"]["openai_gpt_api_key"]

# app = FastAPI()

# @app.get("/proxy/norgeskart")
# async def proxy_norgeskart(url: str):
#     async with httpx.AsyncClient() as client:
#         response = await client.get(url)
#         return response.json()

async def handle_connection(websocket):
    messages_history = []
    while True:
        try:
            raw_message = await websocket.recv()
        except websockets.exceptions.ConnectionClosed:
            print("Client disconnected.")
            break

        data = json.loads(raw_message)
        action = data.get("action")
        payload = data.get("payload")

        if action == "chatFormSubmit":
            user_question = payload
            memory = messages_history[-6:]  # keep last 6 messages

            try:
                # Send user message to the client
                await websocket.send(json.dumps({
                    "action": "userMessage",
                    "payload": user_question
                }))

                # 2) Retrieve top relevant rows from your vector DB
                #    (this is the "retrieval" part of RAG)
                vdb_results = await get_vdb_response(user_question)
                # print("DEBUG: vdb_results =", vdb_results)                

                # 3) Convert those results into a snippet
                rag_context = build_rag_context(vdb_results)
                
                # 4) Build system message with instructions + context
                system_msg = {
                    "role": "system",
                    "content": (
                        "You are a Q&A assistant. Use ONLY the context below. "
                        "If the answer isn't in the context, say 'I don't know.'\n\n"
                        f"CONTEXT:\n{rag_context}"
                    )
                }

                # 5) Build final messages for GPT
                user_msg = {"role": "user", "content": user_question}
                messages = [*memory, system_msg, user_msg]

                # 6) Stream GPT response (the “generation” part of RAG)
                full_rag_response = await send_api_chat_request(
                    messages, websocket, "gpt-4o-mini"
                )

                # 7) Indicate streaming is finished
                await websocket.send(json.dumps({"action": "streamComplete"}))

                # 8) Attempt to insert image if GPT signaled "[bilde]"
                # ADD THIS LINE:
                await force_insert_first_image(vdb_results, websocket)

                # 9) Save conversation to the local history
                messages_history.append({"role": "user", "content": user_question})
                messages_history.append({"role": "system", "content": full_rag_response})

            except Exception as e:
                print("chatFormSubmit error:", e)
                
                await websocket.send(json.dumps({"action": "streamComplete"}))
                # ...existing code...
                
        elif action == "searchFormSubmit":
            query = payload
            print(f"Server controller received search query: {query}")
            try:
                # 1) Vector DB search
                vdbSearchResponse = await get_vdb_search_response(query)

                # 2) For each dataset, gather WMS + download info (including direct link)
                datasetsWithDownloadAndWmsStatus = await get_dataset_download_and_wms_status(vdbSearchResponse)

                # 3) Send back to the client
                await send_websocket_message(
                    "searchVdbResults",
                    datasetsWithDownloadAndWmsStatus,
                    websocket
                )
            except Exception as e:
                print(f"Failed to retrieve or send VDB results: {e}")

async def main():
    async with websockets.serve(handle_connection, "0.0.0.0", 8080):
        print("WebSocket server running on ws://localhost:8080")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())