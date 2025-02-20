import pandas as pd
import requests
import json
import config
import os

print(f"🔍 DEBUG: AZURE_EMBEDDING_BASEURL = {config.AZURE_EMBEDDING_BASEURL}")
print(f"🔍 DEBUG: AZURE_EMBEDDING_API_KEY = {config.AZURE_EMBEDDING_API_KEY}")
print(f"🔍 DEBUG: API_URL = {config.AZURE_EMBEDDING_BASEURL}/openai/deployments/text-embedding-3-large/embeddings?api-version=2023-05-15")

if not config.AZURE_EMBEDDING_BASEURL:
    raise ValueError("❌ Feil: AZURE_EMBEDDING_BASEURL er ikke satt!")

API_URL = f"{config.AZURE_EMBEDDING_BASEURL}/openai/deployments/text-embedding-3-large/embeddings?api-version=2023-05-15"
API_KEY = config.AZURE_EMBEDDING_API_KEY
MODEL = config.AZURE_GPT_API_KEY  # Brukes for modellspesifikasjon

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
        df['combined_text'] = df[columns_to_combine].fillna('').agg(' '.join, axis=1)
        titles = df['title'].fillna('').tolist()
        title_embeddings = fetch_embeddings(titles)

        if not title_embeddings:
            print("❌ Kunne ikke hente embeddings for titler!")
            return

        df['title_vector'] = [json.dumps(e['embedding']) for e in title_embeddings['data']]
        combined_texts = df['combined_text'].tolist()
        combined_embeddings = fetch_embeddings(combined_texts)

        if not combined_embeddings:
            print("❌ Kunne ikke hente embeddings for kombinert tekst!")
            return

        df['combined_text_vector'] = [json.dumps(e['embedding']) for e in combined_embeddings['data']]
        df.to_csv(output_path, sep='|', index=False)
        print(f"✅ Embeddings lagret i: {output_path}")
    except Exception as e:
        print(f"❌ En feil oppsto: {e}")

if __name__ == "__main__":
    try:
        process_csv("../cleaned_metadata.csv", "all_columns_vectorized.csv", ["title", "abstract", "keyword"])
    except Exception as e:
        print(f"🚨 Feil under prosessering av CSV: {e}")
    finally:
        print("🚀 Ferdig med create_vector.py, kjører insert_csv.py")
        os.system("python /app/scripts/insert_csv.py")
