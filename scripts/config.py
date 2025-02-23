import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

CONFIG = {
    "app": {
        "name": "GeoGPT",
    },
    "db": {
        "host": os.getenv("DB_HOST"),
        "port": int(os.getenv("DB_PORT")),
        "name": os.getenv("DB_NAME"),
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
    },
    "api": {
        "azure_gpt_api_key": os.getenv("AZURE_GPT_API_KEY"),
        "azure_gpt_endpoint": os.getenv("AZURE_GPT_ENDPOINT"),
        "azure_embedding_api_key": os.getenv("AZURE_EMBEDDING_API_KEY"),
        "azure_embeddings_endpoint": os.getenv("AZURE_EMBEDDING_ENDPOINT"),
    },
}