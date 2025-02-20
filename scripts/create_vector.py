import pandas as pd
import requests
import json
import config
import os

# Debugging: Skriv ut de faktiske verdiene som brukes
print(f"🔍 DEBUG: AZURE_EMBEDDING_BASEURL = {config.AZURE_EMBEDDING_BASEURL}")
print(f"🔍 DEBUG: AZURE_EMBEDDING_API_KEY = {config.AZURE_EMBEDDING_API_KEY}")
print(f"🔍 DEBUG: API_URL = {config.AZURE_EMBEDDING_BASEURL}/openai/deployments/text-embedding-3-large/embeddings?api-version=2023-05-15")

# Sjekk om kritiske variabler er satt
if not config.AZURE_EMBEDDING_BASEURL:
    raise ValueError("❌ Feil: AZURE_EMBEDDING_BASEURL er ikke satt!")

API_URL = f"{config.AZURE_EMBEDDING_BASEURL}/openai/deployments/text-embedding-3-large/embeddings?api-version=2023-05-15"
API_KEY = config.AZURE_EMBEDDING_API_KEY
MODEL = config.AZURE_GPT_API_KEY  # Hvis det er en spesifikk modell

def fetch_embeddings(texts, model=MODEL):
    headers = {
        "api-key": f"{API_KEY}",
        "Content-Type": "application/json",
    }
    data = {"model": model, "input": texts}

    try:
        response = requests.post(API_URL, headers=headers, json=data)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Feil under API-kall: {e}")
        return None

def process_csv(file_path, output_path, columns_to_combine):
    """
    Kombiner kolonner, hent embeddings og lagre resultatene i en ny CSV.
    """
    try:
        df = pd.read_csv(file_path, delimiter='|')

        # Kombiner spesifiserte kolonner
        df['combined_text'] = df[columns_to_combine].fillna('').agg(' '.join, axis=1)

        # Hent embeddings for 'title'
        titles = df['title'].fillna('').tolist()
        title_embeddings = fetch_embeddings(titles)

        if not title_embeddings:
            print("❌ Kunne ikke hente embeddings for titler!")
            return

        # Legg til 'title_vector' i DataFrame
        df['title_vector'] = [json.dumps(e['embedding']) for e in title_embeddings['data']]

        # Hent embeddings for kombinerte tekster (hvis nødvendig)
        combined_texts = df['combined_text'].tolist()
        combined_embeddings = fetch_embeddings(combined_texts)

        if not combined_embeddings:
            print("❌ Kunne ikke hente embeddings for kombinert tekst!")
            return

        # Legg til 'combined_text_vector' i DataFrame
        df['combined_text_vector'] = [json.dumps(e['embedding']) for e in combined_embeddings['data']]

        # Lagre ny CSV
        df.to_csv(output_path, sep='|', index=False)
        print(f"✅ Embeddings lagret i: {output_path}")
    except Exception as e:
        print(f"❌ En feil oppsto: {e}")

# Eksempel på bruk
if __name__ == "__main__":
    try:
        process_csv(
            "../cleaned_metadata.csv",  # Inndatafil
            "all_columns_vectorized.csv",  # Utdatafil
            ["title", "abstract", "keyword"]  # Kolonner som skal kombineres
        )
    except Exception as e:
        print(f"🚨 Feil under prosessering av CSV: {e}")
    finally:
        print("🚀 Ferdig med create_vector.py, kjører insert_csv.py")
        os.system("python /app/scripts/insert_csv.py")
