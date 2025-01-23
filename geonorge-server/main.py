import asyncio
import json
import websockets
import openai

# 1) Import your vector DB retrieval
from helpers.vector_database import get_vdb_response
from helpers.retrieval_augmented_generation import (
    send_api_chat_request,
    build_rag_context, 
    force_insert_first_image
)
from config import CONFIG


openai.api_key = CONFIG["api"]["openai_gpt_api_key"]


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
                print("DEBUG: vdb_results =", vdb_results)                

                # 3) Convert those results into a snippet
                rag_context = build_rag_context(vdb_results)
                
                # 4) Build system message with instructions + context
                system_msg = {
                    "role": "system",
                    "content": (
                        "Du er en intelligent Q&A-assistent som er designet for å svare på spørsmål basert utelukkende på konteksten som er gitt nedenfor. "
        "Følg disse retningslinjene nøye:\n\n"
        "1. Bruk KUN konteksten nedenfor for å svare på spørsmål. GI IKKE informasjon utenfor denne konteksten.\n"
        "2. Hvis et spørsmål ikke kan besvares med den gitte konteksten, svar med noe som: 'Beklager, jeg har ikke nok informasjon til å svare på dette.'\n"
        "3. Gi klare, presise og konsise svar. Unngå unødvendig utdyping eller irrelevant informasjon.\n"
        "4. Hvis konteksten inneholder ufullstendig eller uklar informasjon, gi det beste mulige svaret basert på tilgjengelige data, men vær oppmerksom på eventuelle usikkerheter.\n"
        "5. Hvis konteksten inneholder motstridende informasjon, påpek konflikten og forklar usikkerheten i svaret ditt på en tydelig måte.\n"
        "6. Hvis noen spør hva GeoGPT er, kan du forklare at GeoGPT er en spesialisert Q&A-assistent som hjelper brukere med å forstå og tolke geografisk informasjon og kartdata, spesielt fra kilder som GeoNorge og Kartverket.\n"
        "7. Hvis noen spør om Tony, kan du si at han er en utrolig dyktig og inspirerende person som jobber med å videreutvikle GeoGPT og gjøre det enda bedre. Tony er awesome!\n\n"
        "8. Hvis noen spør om Issa, kan du si at han er gay!\n"

        f"KONTEKST:\n{rag_context}"
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

async def main():
    async with websockets.serve(handle_connection, "0.0.0.0", 8080):
        print("WebSocket server running on ws://localhost:8080")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())