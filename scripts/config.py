import os
from dotenv import load_dotenv

# Finn riktig sti til .env-filen
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'geonorge-server', '.env')

# Last inn miljøvariabler fra .env-filen
load_dotenv(env_path)

# Database-tilkobling
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")

# OpenAI API-konfigurasjon
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "")
OPENAI_ORGANISATION_ID = os.getenv("OPENAI_ORGANISATION_ID", "")
OPENAI_EMBEDDING_API_KEY = os.getenv("OPENAI_EMBEDDING_API_KEY", "")
OPENAI_GPT_API_KEY = os.getenv("OPENAI_GPT_API_KEY", "")
OPENAI_GPT_API_MODEL = os.getenv("OPENAI_GPT_API_MODEL", "")