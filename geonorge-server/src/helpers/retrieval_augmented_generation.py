import os
import json
import aiohttp
from openai import AzureOpenAI
from config import CONFIG
from helpers.websocket import send_websocket_message
from helpers.download import dataset_has_download, get_download_url, get_standard_or_first_format
from helpers.fetch_valid_download_api_data import get_wms
from helpers.langchain_memory import EnhancedConversationMemory
import asyncio
from typing import List, Dict, Any
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.prompts import ChatPromptTemplate
from langchain.schema import StrOutputParser

# Initialize Azure OpenAI client
client = AzureOpenAI(
    api_key=CONFIG["api"]["azure_gpt_api_key"],
    api_version="2024-02-15-preview",
    azure_endpoint=CONFIG["api"]["azure_gpt_endpoint"]
)

async def get_rag_context(vdb_response):
    """Generate RAG context from vector database response using Langchain's text splitter"""
    # Convert tuple results to dictionaries with named fields
    field_names = ['uuid', 'title', 'abstract', 'image']
    dict_response = [dict(zip(field_names, row)) for row in vdb_response]
    
    # Create a text splitter
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )
    
    # Prepare the context
    context_texts = []
    for row in dict_response:
        context = f"Tittel: {row['title']}\nBeskrivelse: {row['abstract']}"
        context_texts.append(context)
    
    # Split the context into chunks
    chunks = text_splitter.create_documents(context_texts)
    
    # Create the system prompt template
    system_template = """Du er en ekspert på geografiske datasett fra Geonorge. 
    Bruk følgende kontekst for å svare på spørsmål:
    
    {context}
    
    VIKTIG: Hvis du refererer til et datasett, MÅ du starte svaret med datasettets tittel i markdown bold format (f.eks. **FKB-Tiltak**).
    Gi svaret på norsk og bruk kun informasjonen i konteksten."""
    
    human_template = "{question}"
    
    chat_prompt = ChatPromptTemplate.from_messages([
        ("system", system_template),
        ("human", human_template),
    ])
    
    # Join the chunks with appropriate spacing
    context = "\n\n".join([chunk.page_content for chunk in chunks])
    
    return chat_prompt, context

async def get_rag_response(user_question, memory, rag_context, websocket):
    chat_prompt, context = rag_context
    conversation_memory = EnhancedConversationMemory()
    
    # Add existing memory messages
    for msg in memory:
        conversation_memory.add_message(msg["role"], msg["content"])
    
    # Combine the context with memory
    full_context = context + conversation_memory.get_context_string()
    
    # Create the chain
    chain = chat_prompt | client.chat.completions.create | StrOutputParser()
    
    # Stream the response
    await send_websocket_message("chatStream", {"payload": "", "isNewMessage": True}, websocket)
    
    messages = [
        {"role": "system", "content": full_context},
        {"role": "user", "content": user_question}
    ]
    
    # Get response using streaming
    full_response = await send_api_chat_request(messages, websocket)
    
    # Add response to memory
    conversation_memory.add_message("assistant", full_response)
    
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
                    await asyncio.sleep(0.01)
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