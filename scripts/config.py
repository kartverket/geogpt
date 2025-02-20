import os
from dotenv import load_dotenv

# Finn riktig sti til .env-filen
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'geonorge-server', 'src', '.env')

# Last inn miljøvariabler fra .env-filen hvis den finnes
if os.path.exists(env_path):
    load_dotenv(env_path)
    print("✅ .env-fil lastet inn!")
else:
    print("⚠️ .env-fil ikke funnet! Bruker miljøvariabler fra GitHub Secrets.")

# Database-tilkobling
DB_HOST = os.getenv("DB_HOST", os.environ.get("DB_HOST", "pgvector_container"))
DB_PORT = os.getenv("DB_PORT", os.environ.get("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME") or os.environ.get("postgres")
DB_USER = os.getenv("DB_USER") or os.environ.get("asd")
DB_PASSWORD = os.getenv("DB_PASSWORD") or os.environ.get("asd")

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