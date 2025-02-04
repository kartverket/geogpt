import os
import aiohttp
import json
from config import CONFIG

async def fetch_openai_embeddings(text):
    """Fetch embeddings from Azure OpenAI API for the given text"""
    headers = {
        'Content-Type': 'application/json',
        'api-key': CONFIG["api"]["azure_embedding_api_key"] 
    }

    data = {
        'input': text
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(
            CONFIG["api"]["azure_embeddings_endpoint"], 
            headers=headers,
            json=data
        ) as response:
            if response.status == 200:
                return await response.json()
            else:
                error_data = await response.text()
                raise Exception(f'Azure OpenAI API error: {error_data}')