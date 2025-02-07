import os
import json
import asyncio
import re

from config import CONFIG
from helpers.websocket import send_websocket_message
from helpers.download import dataset_has_download, get_download_url, get_standard_or_first_format
from helpers.fetch_valid_download_api_data import get_wms

# LangChain imports
from langchain.chat_models import AzureChatOpenAI
from langchain.schema import HumanMessage, SystemMessage, AIMessage, BaseMessage
from langchain.callbacks.base import AsyncCallbackHandler

# =============================================================================
# Custom Callback Handler for Websocket Streaming
# =============================================================================

class WebsocketCallbackHandler(AsyncCallbackHandler):
    """A custom LangChain callback handler to stream tokens over a websocket."""
    def __init__(self, websocket):
        self.websocket = websocket

    async def on_llm_new_token(self, token: str, **kwargs) -> None:
        # Send each new token to the client via websocket.
        await send_websocket_message("chatStream", {"payload": token}, self.websocket)

    async def on_llm_start(self, serialized: dict, prompts: list, **kwargs) -> None:
        # Optionally notify the client that streaming has started.
        await send_websocket_message("chatStream", {"payload": "", "isNewMessage": True}, self.websocket)

# =============================================================================
# Functions to Build the RAG Context and Response
# =============================================================================

async def get_rag_context(vdb_response):
    """Generate RAG context from vector database response"""
    columns_to_exclude = ['uuid', '_vector', 'distance', 'image']
    
    # Convert tuple results to dictionaries with named fields
    field_names = ['uuid', 'title', 'abstract', 'image']
    dict_response = [dict(zip(field_names, row)) for row in vdb_response]
    
    # Filter headers
    headers_keys = [k for k in field_names if not any(excl in k for excl in columns_to_exclude)]
    headers = " | ".join(headers_keys)
    
    # Build results string
    vdb_results = "\n\n".join(" | ".join(str(row[k]) for k in headers_keys) for row in dict_response)
    
    rag_context = (
        "Du vil få en detaljert beskrivelse av ulike datasett på norsk, "
        f"innrammet i triple backticks (```). Svar brukeren sitt spørsmål basert på konteksten:```{headers}\n\n{vdb_results}``` "
        "Ved spørsmål knyttet til leting etter datasett, bruk datasettbeskrivelsene "
        "til å svare på spørsmålet så detaljert som mulig. "
        "VIKTIG: Hvis du refererer til et datasett, MÅ du starte svaret med "
        "datasettets tittel i markdown bold format (f.eks. **FKB-Tiltak**). "
        "Dette er OBLIGATORISK hver gang du nevner et datasett fra konteksten. "
        "For generelle spørsmål om GIS, Geomatikk, og geografiske data, gi et informativt svar "
        "selv om det ikke finnes relevante datasett i konteksten. "
        "For datasett-relaterte spørsmål, prioriter alltid å referere til relevante datasett fra konteksten. "
        "Avstå kun fra å svare på spørsmål som IKKE er relatert til Geomatikk, Geonorge, "
        "geografiske datasett, eller GIS. Gi svaret på norsk."
    )
    return rag_context

async def get_rag_response(user_question, memory, rag_context, websocket):
    """
    Build a LangChain message list from conversation memory,
    attach the RAG context and user question, and get the streamed response.
    """
    # Convert memory (list of dicts with "role" and "content") to LangChain message objects.
    lc_messages: list[BaseMessage] = []
    for msg in memory:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "system":
            lc_messages.append(SystemMessage(content=content))
        elif role == "assistant":
            lc_messages.append(AIMessage(content=content))
        else:  # default to user message
            lc_messages.append(HumanMessage(content=content))
    
    # Append the RAG context as a system message and the new user question.
    lc_messages.append(SystemMessage(content=rag_context))
    lc_messages.append(HumanMessage(content=user_question))
    
    # Create a callback handler for streaming via websocket.
    callback_handler = WebsocketCallbackHandler(websocket)
    
    # Create the LangChain AzureChatOpenAI LLM.
    llm = AzureChatOpenAI(
        openai_api_base=CONFIG["api"]["azure_gpt_endpoint"],
        openai_api_key=CONFIG["api"]["azure_gpt_api_key"],
        openai_api_version="2024-02-15-preview",
        deployment_name="gpt-4o-mini",  # Use your Azure deployment name
        streaming=True,
        callbacks=[callback_handler],
        verbose=True
    )
    
    # Get the response using LangChain's async predict method.
    response_message = await llm.apredict_messages(lc_messages)
    return response_message.content

# =============================================================================
# Functions for Handling Images Based on GPT Response
# =============================================================================

async def check_image_signal(gpt_response, metadata_context_list):
    """
    Check the GPT response for bolded dataset titles and then try to fetch
    corresponding image and download URLs.
    """
    # Convert tuples to dictionaries
    field_names = ['uuid', 'title', 'abstract', 'image', 'distance']
    dict_response = [dict(zip(field_names, row)) for row in metadata_context_list]
    
    # Fetch WMS URLs for each dataset
    for row in dict_response:
        row['wmsUrl'] = await get_wms(row['uuid'])
    
    print("\nGPT Response:", gpt_response)
    bold_titles = re.findall(r'\*\*(.*?)\*\*', gpt_response)
    print("Detected bold titles:", bold_titles)
    
    if not bold_titles:
        return False

    # Check each dataset with detailed logging
    for obj in dict_response:
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
                    
                    # Try to get download URL
                    download_url = None
                    try:
                        if await dataset_has_download(dataset_uuid):
                            standard_format = await get_standard_or_first_format(dataset_uuid)
                            if standard_format:
                                download_url = await get_download_url(dataset_uuid, standard_format)
                    except Exception as e:
                        print(f"Failed to get download URL: {e}")
                    
                    return {
                        "uuid": dataset_uuid,
                        "datasetImageUrl": dataset_image_url,
                        "downloadUrl": download_url,
                        "wmsUrl": obj.get("wmsUrl", None)
                    }
                else:
                    print(f"Missing required fields - UUID: {obj.get('uuid')}, Image: {obj.get('image')}")
    print("No matching dataset found with required fields")
    return False

async def insert_image_rag_response(full_response, vdb_response, websocket):
    """Insert image UI elements into RAG response based on detected dataset signals."""
    dataset_info = await check_image_signal(full_response, vdb_response)
    if dataset_info:
        await send_websocket_message(
            "insertImage",
            {
                "datasetUuid": dataset_info["uuid"],
                "datasetImageUrl": dataset_info["datasetImageUrl"],
                "datasetDownloadUrl": dataset_info["downloadUrl"],
                "wmsUrl": dataset_info["wmsUrl"]
            },
            websocket
        )