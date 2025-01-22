import os
from dotenv import load_dotenv

load_dotenv()

CONFIG = {
    "db": {
        "host": os.getenv("DB_HOST", ""),
        "port": int(os.getenv("DB_PORT", "5432")),
        "name": os.getenv("DB_NAME", ""),
        "user": os.getenv("DB_USER", ""),
        "password": os.getenv("DB_PASSWORD", ""),
    },
    "api": {
        "model": os.getenv("OPENAI_MODEL", ""),
        "openai_organisation_id": os.getenv("OPENAI_ORGANISATION_ID", ""),
        "openai_embedding_api_key": os.getenv("OPENAI_EMBEDDING_API_KEY", ""),
        "openai_gpt_api_key": os.getenv("OPENAI_GPT_API_KEY", ""),
        "openai_gpt_api_model": os.getenv("OPENAI_GPT_API_MODEL", ""),
    },
}