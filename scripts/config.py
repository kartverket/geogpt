import os
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'geonorge-server', 'src' , '.env')

load_dotenv(env_path)

DB_CONFIG = {
    "host": os.getenv("DB_HOST", ""),
    "port": os.getenv("DB_PORT", ""),
    "database": os.getenv("DB_NAME", ""),
    "user": os.getenv("DB_USER", ""),
    "password": os.getenv("DB_PASSWORD", "")
}

CONFIG = {
    "api": {
        "azure_embedding_api_key": os.getenv("AZURE_EMBEDDING_API_KEY", ""),
        "azure_embeddings_endpoint": os.getenv("AZURE_EMBEDDING_BASEURL", ""),
        "azure_gpt_api_key": os.getenv("AZURE_GPT_API_KEY", "")
    }
}