import os
import json
import aiohttp
from openai import AzureOpenAI
from config import CONFIG
from helpers.websocket import send_websocket_message
from helpers.download import dataset_has_download, get_download_url, get_standard_or_first_format
from helpers.fetch_valid_download_api_data import get_wms
import asyncio
from typing import List, Dict, Any
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.schema import StrOutputParser
from langchain_community.chat_message_histories import ChatMessageHistory

# Initialize Azure OpenAI client
client = AzureOpenAI(
    api_key=CONFIG["api"]["azure_gpt_api_key"],
    api_version="2024-02-15-preview",
    azure_endpoint=CONFIG["api"]["azure_gpt_endpoint"]
)

class GeoNorgeRAGChain:
    def __init__(self):
        self.store = {}
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )

    def get_session_history(self, session_id: str) -> ChatMessageHistory:
        if session_id not in self.store:
            self.store[session_id] = ChatMessageHistory()
        return self.store[session_id]

    async def create_context_aware_prompt(self, vdb_response):
        field_names = ['uuid', 'title', 'abstract', 'image']
        dict_response = [dict(zip(field_names, row)) for row in vdb_response]
        
        context_texts = []
        for row in dict_response:

            
            url_formatted_title = row['title'].replace(' ', '-')
            
            context = f"Kilde: https://kartkatalog.geonorge.no/metadata/{url_formatted_title}/{row['uuid']}"
            # \nBeskrivelse: {row['abstract']}"
            # print("HVA ER ABSTRACT", row['abstract'])
            # print("HVA ER IMAGEGEGE", row['image'])
            context_texts.append(context)
        
        chunks = self.text_splitter.create_documents(context_texts)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """Du er en assistent som heter GeoGPT. Når du gir et svar, skal du inkludere 
            en tydelig referanse til kilden eller dokumentet der du fant informasjonen. Hvis du ikke vet svaret, 
            skal du si at du ikke vet. Følgende kontekst er tilgjengelig: {context}
            
            VIKTIG: Hvis du refererer til et datasett, MÅ du starte svaret med datasettets tittel i markdown 
            bold format (f.eks. **FKB-Tiltak**). Dette er OBLIGATORISK hver gang du nevner et datasett fra konteksten."""),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{question}"),
            ("system", "Bruk følgende kontekst for å svare på spørsmålet:\n{context}")
        ])
        
        return prompt, "\n\n".join([chunk.page_content for chunk in chunks])



# Initialize the global RAG chain
rag_chain = GeoNorgeRAGChain()

async def get_rag_context(vdb_response):
    return await rag_chain.create_context_aware_prompt(vdb_response)

async def get_rag_response(user_question, memory, rag_context, websocket):
    chat_prompt, context = rag_context
    session_id = str(id(websocket))
    
    history = rag_chain.get_session_history(session_id)
    history.add_user_message(user_question)
    
    # Format messages using the chat prompt
    langchain_messages = chat_prompt.format_messages(
        question=user_question,
        context=context,
        chat_history=history.messages
    )
    
    # Convert Langchain messages to OpenAI format
    openai_messages = [
        {"role": "system" if msg.type == "system" else "user" if msg.type == "human" else "assistant",
         "content": msg.content}
        for msg in langchain_messages
    ]
    
    # Stream the response
    full_response = await send_api_chat_request(openai_messages, websocket)
    
    # Add the response to history
    history.add_ai_message(full_response)
    
    return full_response

async def send_api_chat_request(messages, websocket):
    await send_websocket_message("chatStream", {"payload": "", "isNewMessage": True}, websocket)
    
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        stream=True
    )
    
    full_response = ""
    try:
        for chunk in stream:
            if chunk and hasattr(chunk, 'choices') and chunk.choices:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    content = delta.content
                    await send_websocket_message("chatStream", {"payload": content}, websocket)
                    # await asyncio.sleep(0.01)
                    full_response += content
    
    except Exception as e:
        print(f"Error during streaming: {e}")
        logger.error(f"Streaming error details: {str(e)}")
        raise
    
    if not full_response:
        logger.warning("No response content received from Azure OpenAI")
        full_response = "Beklager, jeg kunne ikke generere et svar. Vennligst prøv igjen."
    
    return full_response

async def check_image_signal(gpt_response, metadata_context_list):
    import re
    
    # Convert tuples to dictionaries
    field_names = ['uuid', 'title', 'abstract', 'image', 'distance']
    dict_response = [dict(zip(field_names, row)) for row in metadata_context_list]
    
    # Fetch WMS URLs for each dataset
    for row in dict_response:
        row['wmsUrl'] = await get_wms(row['uuid'])
    
    # Debug print for dataset titles and full objects
    # print("\nDebug: Full dataset objects:")
    # for row in dict_response:
    #     print(f"UUID: {row.get('uuid')}")
    #     print(f"Title: {row.get('title')}")
    #     print(f"Image: {row.get('image')}")
    #     print(f"WMS URL: {row.get('wmsUrl')}")
    #     print("---")

    print("\nGPT Response:", gpt_response)
    bold_titles = re.findall(r'\*\*(.*?)\*\*', gpt_response)
    print("Detected bold titles:", bold_titles)
    
    if not bold_titles:
        return False

    # Check each dataset with detailed logging
    for obj in dict_response:  # Use the converted dictionary response
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
    """Insert image UI elements into RAG response"""
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