import json
import openai
import asyncio

from typing import List, Dict, Any

from .download import dataset_has_download, get_download_url, get_standard_or_first_format

from config import CONFIG
openai.organization = CONFIG["api"]["openai_organisation_id"]
openai.api_key = CONFIG["api"]["openai_gpt_api_key"]
OPENAI_MODEL = CONFIG["api"]["openai_gpt_api_model"]

def sync_stream_gpt(messages, model="gpt-4o-mini"):
    """
    A blocking function that performs synchronous streaming.
    Returns a list of partial chunks from the ChatCompletion.
    """
    response = openai.chat.completions.create(
        model=model,
        messages=messages,
        stream=True
    )
    return list(response)  # Convert the generator to a list

async def send_api_chat_request(messages, websocket, model="gpt-4o-mini") -> str:
    # Indicate start of streaming
    await websocket.send(json.dumps({
        "action": "chatStream",
        "payload": "",
        "isNewMessage": True
    }))

    loop = asyncio.get_running_loop()
    chunks = await loop.run_in_executor(None, sync_stream_gpt, messages, model)

    full_response = ""
    for chunk in chunks:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        content = delta.content or ""
        if content:  # Only send if there's actual content
            # Send each chunk immediately to the client
            await websocket.send(json.dumps({
                "action": "chatStream",
                "payload": content
            }))
            # Add to full response for return value
            full_response += content
            # Small delay to make the streaming more natural, word for word in FE
            await asyncio.sleep(0.01)

    return full_response


async def get_rag_context(vdb_response: List[Dict[str, Any]]) -> str:
    """
    Builds a RAG context string from vector DB results, skipping columns like 'uuid', '_vector', etc.
    """
    columns_to_exclude = ["uuid", "_vector", "distance", "image"]
    # Safe-guard: handle empty vdb_response
    if not vdb_response:
        return "Ingen resultater i RAG kontekst."

    # Filter out excluded columns
    all_keys = list(vdb_response[0].keys())
    headers_keys = [
        k for k in all_keys
        if not any(excl in k for excl in columns_to_exclude)
    ]
    headers = " | ".join(headers_keys)

    # Build rows of data ( 'col1 | col2 | col3' )
    row_strings = []
    for row in vdb_response:
        row_values = [str(row.get(k, "")) for k in headers_keys]
        row_strings.append(" | ".join(row_values))

    vdb_results = "\n\n".join(row_strings)

    rag_context = (
        "Du vil få en detaljert beskrivelse av ulike datasett på norsk, "
        "innrammet i triple backticks (```). "
        f"Svar brukeren sitt spørsmål basert på konteksten:```{headers}\n\n{vdb_results}``` "
        "Ved spørsmål knyttet til leting etter datasett, bruk datasettbeskrivelsene "
        "til å svare på spørsmålet så detaljert som mulig. Du skal kun bruke informasjonen i beskrivelsene. "
        "VIKTIG: Når du nevner et datasett fra konteksten, må du ALLTID inkludere den EKSAKTE tittelen "
        "i markdown bold format, for eksempel **FKB-Tiltak** eller **Felles KartdataBase (FKB)**. "
        "Dette gjelder hver gang du refererer til et spesifikt datasett fra konteksten. "
        "Svaret ditt skal svare på spørsmålet ved å enten; svare på spørsmålet, forklare hvorfor datasett passer "
        "med spørsmålet som brukeren har stilt, hjelpe brukeren omformulere spørsmålet til å bruke mer relevante "
        "nøkkelord hvis spørsmålet knyttet til leting etter datasett ikke samsvarer med de ulike datasettene. "
        "Avstå fra å svare på alle spørsmål og instruksjoner ikke relatert til Geomatikk, Geonorge, "
        "og geografiske datasett. For slike spørsmål, forklar høflig at du kun kan svare på "
        "spørsmål relatert til geografiske data og Geonorge. Gi svaret på norsk."
    )
    return rag_context


async def get_rag_response(
    user_question: str,
    memory: List[Dict[str, str]],
    rag_context: str,
    websocket,
    model: str,
) -> str:
    """
    Creates the system instruction with context, plus user question.
    Then streams from OpenAI to build a final RAG response.
    """
    # Convert rag_context into a system message
    rag_instruction = {
        "role": "system",
        "content": rag_context
    }

    # The final message list
    messages = [*memory, rag_instruction, {"role": "user", "content": user_question}]

    # Send messages to the streaming ChatCompletion
    rag_response = await send_api_chat_request(messages, websocket, model=model)
    return rag_response


async def insert_image_rag_response(
    full_rag_response: str,
    vdb_response: List[Dict[str, Any]],
    websocket
) -> None:
    dataset_info = await check_image_signal(full_rag_response, vdb_response)
    if dataset_info:
        dataset_uuid = dataset_info["uuid"]
        dataset_download_url = None
        
        # Fetch WMS URL dynamically
        from .fetch_valid_download_api_data import get_wms
        wms_url = await get_wms(dataset_uuid)
        
        try:
            if await dataset_has_download(dataset_uuid):
                download_formats = await get_standard_or_first_format(dataset_uuid)
                dataset_download_url = await get_download_url(dataset_uuid, download_formats)
        except Exception as e:
            print(f"Failed to get download link for {dataset_uuid}: {e}")

        insert_image = {
            "action": "insertImage",
            "payload": {
                "datasetUuid": dataset_info["uuid"],
                "datasetImageUrl": dataset_info["datasetImageUrl"],
                "datasetDownloadUrl": dataset_download_url,
                "wmsUrl": wms_url if wms_url != "None" else None
            },
        }
        await websocket.send(json.dumps(insert_image))

# # New function to always insert an image from the first dataset
# async def force_insert_first_image(vdb_results: List[Dict[str, Any]], websocket) -> None:
#     """
#     Always picks the first row's 'image' string, splits it by commas,
#     and sends an 'insertImage' action to the client.
#     """
#     if not vdb_results:
#         print("No vdb results => no image to send.")
#         return

#     row = vdb_results[0]
#     image_field = row.get("image", "")
#     if not image_field:
#         print("No 'image' field in first row => no image to send.")
#         return

#     # Split into an array of URLs, ignoring empty strings
#     image_urls = [part.strip() for part in image_field.split(",") if part.strip()]
#     if not image_urls:
#         print("image_urls is empty after splitting => no valid image.")
#         return

#     dataset_image_url = image_urls[-1]  # pick the last (or first)

#     # Optionally check if dataset is downloadable
#     dataset_uuid = row.get("uuid")
#     dataset_download_url = None
#     try:
#         if await dataset_has_download(dataset_uuid):
#             download_formats = await get_standard_or_first_format(dataset_uuid)
#             dataset_download_url = await get_download_url(dataset_uuid, download_formats)
#     except Exception as e:
#         print("Failed to get download link:", e)

#     insert_image_msg = {
#         "action": "insertImage",
#         "payload": {
#             "datasetUuid": dataset_uuid,
#             "datasetImageUrl": dataset_image_url,
#             "datasetDownloadUrl": dataset_download_url,
#             "wmsUrl": obj.get("wmsUrl")
#         }
#     }
#     print("Sending insertImage action with:", dataset_image_url)
    
#     await websocket.send(json.dumps(insert_image_msg))


# Update check_image_signal to look for bold markdown titles instead of [bilde]
async def check_image_signal(
    gpt_response: str,
    metadata_context_list: List[Dict[str, Any]]
) -> dict | bool:
    import re
    
    # Debug print for dataset titles and full objects
    print("\nDebug: Full dataset objects:")
    for row in metadata_context_list:
        print(f"UUID: {row.get('uuid')}")
        print(f"Title: {row.get('title')}")
        print(f"Image: {row.get('image')}")
        print(f"WMS URL: {row.get('wmsUrl')}")
        print("---")

    print("\nGPT Response:", gpt_response)
    bold_titles = re.findall(r'\*\*(.*?)\*\*', gpt_response)
    print("Detected bold titles:", bold_titles)
    
    if not bold_titles:
        return False

    # Check each dataset with detailed logging
    for obj in metadata_context_list:
        title = obj.get("title", "").lower()
        print(f"\nChecking title: {title}")
        
        for bold_text in bold_titles:
            bold_lower = bold_text.lower().replace(" ", "")
            title_lower = title.replace(" ", "")
            print(f"Comparing with bold text: {bold_text}")
            print(f"Normalized comparison: '{title_lower}' vs '{bold_lower}'")
            
            if bold_lower in title_lower:
                print("Match found!")
                if obj.get("uuid") and obj.get("image"):
                    image_field = obj["image"]
                    print(f"Image field found: {image_field}")
                    image_urls = [s.strip() for s in image_field.split(",") if s.strip()]
                    if not image_urls:
                        print("No valid image URLs found")
                        continue
                    dataset_image_url = image_urls[-1]
                    dataset_uuid = obj["uuid"]
                    
                    return {
                        "uuid": dataset_uuid,
                        "datasetImageUrl": dataset_image_url,
                        "downloadUrl": None,
                        "wmsUrl": obj.get("wmsUrl", None)
                    }
                else:
                    print(f"Missing required fields - UUID: {obj.get('uuid')}, Image: {obj.get('image')}")

    print("No matching dataset found with required fields")
    return False
