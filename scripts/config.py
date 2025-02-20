import os
from dotenv import load_dotenv

# Prøv å laste miljøvariabler fra .env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'geonorge-server', 'src', '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
    print("✅ .env-fil lastet inn!")
else:
    print("⚠️ .env-fil ikke funnet! Bruker miljøvariabler fra GitHub Secrets.")

# Database-tilkobling
DB_HOST = os.getenv("DB_HOST", os.environ.get("DB_HOST", "pgvector_container"))
DB_PORT = os.getenv("DB_PORT", os.environ.get("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", os.environ.get("DB_NAME", "postgres"))
DB_USER = os.getenv("DB_USER", os.environ.get("DB_USER", "asd"))
DB_PASSWORD = os.getenv("DB_PASSWORD", os.environ.get("DB_PASSWORD", "asd"))

# Azure API-konfigurasjon
AZURE_EMBEDDING_API_KEY = os.getenv("AZURE_EMBEDDING_API_KEY", os.environ.get("AZURE_EMBEDDING_API_KEY", ""))
AZURE_EMBEDDING_BASEURL = os.getenv("AZURE_EMBEDDING_BASEURL", os.environ.get("AZURE_EMBEDDING_BASEURL", ""))
AZURE_GPT_API_KEY = os.getenv("AZURE_GPT_API_KEY", os.environ.get("AZURE_GPT_API_KEY", ""))

# Debugging: Skriv ut verdiene for å sjekke at de blir hentet riktig
print(f"🔍 DEBUG: DB_HOST={DB_HOST}, DB_PORT={DB_PORT}")
print(f"🔍 DEBUG: AZURE_EMBEDDING_BASEURL={AZURE_EMBEDDING_BASEURL}")

# Sjekk om kritiske variabler er satt
if not AZURE_EMBEDDING_BASEURL:
    raise ValueError("❌ Feil: AZURE_EMBEDDING_BASEURL er ikke satt!")
if not AZURE_GPT_API_KEY:
    raise ValueError("❌ Feil: AZURE_GPT_API_KEY er ikke satt!")
