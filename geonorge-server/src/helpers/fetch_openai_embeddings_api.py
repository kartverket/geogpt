import os
import aiohttp
import json
from config import CONFIG
from langsmith import Client, traceable
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Azure OpenAI embedding model name
EMBEDDING_MODEL = "text-embedding-3-large"

# Initialize LangSmith client if tracing is enabled
langsmith_tracing = os.environ.get("LANGSMITH_TRACING", "false").lower() == "true"
langsmith_client = None
if langsmith_tracing:
    try:
        langsmith_client = Client()
        logger.info("LangSmith tracing enabled for embeddings")
    except Exception as e:
        logger.error(f"Error initializing LangSmith for embeddings: {str(e)}")
        langsmith_tracing = False

@traceable(run_type="embedding", name="Azure OpenAI Embedding")
async def fetch_openai_embeddings(text):
    """Fetch embeddings from Azure OpenAI API for the given text"""
    
    headers = {
        'Content-Type': 'application/json',
        'api-key': CONFIG["api"]["azure_embedding_api_key"] 
    }

    data = {
        'input': text
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                CONFIG["api"]["azure_embeddings_endpoint"], 
                headers=headers,
                json=data
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return result
                else:
                    error_data = await response.text()
                    raise Exception(f'Azure OpenAI API error: {error_data}')
    except Exception as e:
        raise