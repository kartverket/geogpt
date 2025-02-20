from dotenv import load_dotenv
import os

# Finn riktig sti til .env-filen
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')

# Last inn miljøvariabler fra .env-filen hvis den finnes
if os.path.exists(env_path):
    print("✅ .env-fil funnet! Laster miljøvariabler fra .env...")
    load_dotenv(env_path)
else:
    print("⚠️ .env-fil ikke funnet! Bruker miljøvariabler fra GitHub Secrets.")

CONFIG = {
    "app": {
        "name": "GeoGPT",
    },
    "db": {
        "host": os.getenv("DB_HOST") or os.environ.get("DB_HOST", "pgvector_container"),
        "port": int(os.getenv("DB_PORT") or os.environ.get("DB_PORT", "5432")),
        "name": os.getenv("DB_NAME") or os.environ.get("DB_NAME", "postgres"),
        "user": os.getenv("DB_USER") or os.environ.get("DB_USER", "asd"),
        "password": os.getenv("DB_PASSWORD") or os.environ.get("DB_PASSWORD", "asd"),
    },
    "api": {
        "openai_embedding_api_key": os.getenv("OPENAI_EMBEDDING_API_KEY") or os.environ.get("OPENAI_EMBEDDING_API_KEY", ""),
        "model": os.getenv("OPENAI_MODEL") or os.environ.get("OPENAI_MODEL", ""),
        "openai_organisation_id": os.getenv("OPENAI_ORGANISATION_ID") or os.environ.get("OPENAI_ORGANISATION_ID", ""),
        "openai_gpt_api_key": os.getenv("OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY", ""),
        "openai_gpt_api_model": os.getenv("OPENAI_GPT_API_MODEL") or os.environ.get("OPENAI_GPT_API_MODEL", ""),
        "azure_gpt_api_key": os.getenv("AZURE_GPT_API_KEY") or os.environ.get("AZURE_GPT_API_KEY", ""),
        "azure_gpt_endpoint": os.getenv("AZURE_GPT_ENDPOINT") or os.environ.get("AZURE_GPT_ENDPOINT", ""),
        "azure_embedding_api_key": os.getenv("AZURE_EMBEDDING_API_KEY") or os.environ.get("AZURE_EMBEDDING_API_KEY", ""),
        "azure_embeddings_endpoint": os.getenv("AZURE_EMBEDDING_BASEURL", "https://kartai-openai.openai.azure.com") + "/openai/deployments/text-embedding-3-large/embeddings?api-version=2023-05-15",
    },
}

# Debugging: Skriv ut verdier for å sjekke at de blir hentet riktig
print(f"🔍 DEBUG: DB_HOST={CONFIG['db']['host']}, DB_PORT={CONFIG['db']['port']}")
print(f"🔍 DEBUG: AZURE_EMBEDDING_API_KEY={'Set' if CONFIG['api']['azure_embedding_api_key'] else 'Not Set'}")
print(f"🔍 DEBUG: AZURE_EMBEDDING_BASEURL={CONFIG['api']['azure_embeddings_endpoint']}")

# Sjekk om kritiske variabler er satt
if not CONFIG["api"]["azure_gpt_api_key"]:
    raise ValueError("❌ Feil: AZURE_GPT_API_KEY er ikke satt!")
if not CONFIG["api"]["azure_embedding_api_key"]:
    raise ValueError("❌ Feil: AZURE_EMBEDDING_API_KEY er ikke satt!")