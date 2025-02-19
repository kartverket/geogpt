from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

CONFIG = {
    "app": {
        "name": "GeoGPT",
    },
    "db": {
        "host": os.getenv("DB_HOST"),
        "port": int(os.getenv("DB_PORT")),
        "http_port": 5000,
        "name": os.getenv("DB_NAME"),
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
    },
    "api": {
        "openai_embedding_api_key": os.getenv("OPENAI_EMBEDDING_API_KEY"),
        "model": os.getenv("OPENAI_MODEL"),
        "openai_organisation_id": os.getenv("OPENAI_ORGANISATION_ID"),
        "openai_gpt_api_key": os.getenv("OPENAI_API_KEY"),
        "openai_gpt_api_model": os.getenv("OPENAI_GPT_API_MODEL"),
        "azure_gpt_api_key": os.getenv("AZURE_GPT_API_KEY", ""),  
        "azure_gpt_endpoint": os.getenv("AZURE_GPT_ENDPOINT", ""),  
        "azure_embedding_api_key": os.getenv("AZURE_EMBEDDING_API_KEY"),
        "azure_embeddings_endpoint": "https://kartai-openai.openai.azure.com/openai/deployments/text-embedding-3-large/embeddings?api-version=2023-05-15", 
        "gemini_api_key": os.getenv("GEMINI_API_KEY"),
        "gemini_base_endpoint": os.getenv("GEMINI_BASE_ENDPOINT"),
        "gemini_full_endpoint": os.getenv("GEMINI_FULL_ENDPOINT"),
    },
}