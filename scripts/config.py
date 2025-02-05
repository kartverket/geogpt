import os
from dotenv import load_dotenv

# Finn riktig sti til .env-filen
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'geonorge-server', 'src' , '.env')

# Last inn miljøvariabler fra .env-filen
load_dotenv(env_path)

# Database-tilkobling
DB_HOST = os.getenv("DB_HOST", "")
DB_PORT = os.getenv("DB_PORT", "")
DB_NAME = os.getenv("DB_NAME", "")
DB_USER = os.getenv("DB_USER", "")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

# Azure API-konfigurasjon
AZURE_EMBEDDING_API_KEY = os.getenv("AZURE_EMBEDDING_API_KEY", "")
AZURE_EMBEDDING_BASEURL = os.getenv("AZURE_EMBEDDING_BASEURL", "")
AZURE_GPT_API_KEY = os.getenv("AZURE_GPT_API_KEY", "")