import os
from dotenv import load_dotenv

# Last inn .env hvis den finnes
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'geonorge-server', 'src', '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    print("⚠️ Advarsel: .env-filen ble ikke funnet. Bruker systemmiljøvariabler (GitHub Secrets).")

# Database-tilkobling
DB_HOST = os.getenv("DB_HOST", "")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "asd")
DB_PASSWORD = os.getenv("DB_PASSWORD", "asd")

# Azure API-konfigurasjon
AZURE_EMBEDDING_API_KEY = os.getenv("AZURE_EMBEDDING_API_KEY")
AZURE_EMBEDDING_BASEURL = os.getenv("AZURE_EMBEDDING_BASEURL")
AZURE_GPT_API_KEY = os.getenv("AZURE_GPT_API_KEY")

# Sjekk om viktige variabler er satt
if not AZURE_EMBEDDING_BASEURL:
    raise ValueError("❌ Feil: AZURE_EMBEDDING_BASEURL er ikke satt!")
if not AZURE_GPT_API_KEY:
    raise ValueError("❌ Feil: AZURE_GPT_API_KEY er ikke satt!")