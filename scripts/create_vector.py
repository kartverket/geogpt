import pandas as pd
import requests
import json
import config

# Correct API URL format using the correct domain
BASE_URL = config.CONFIG["api"]["azure_embeddings_endpoint"]
API_KEY = config.CONFIG["api"]["azure_embedding_api_key"]
MODEL = "text-embedding-3-large"
API_URL = f"{BASE_URL}/openai/deployments/{MODEL}/embeddings?api-version=2023-05-15"

def fetch_embeddings(texts, model=MODEL):
    headers = {
        "api-key": f"{API_KEY}",
        "Content-Type": "application/json",
    }
    data = {"model": model, "input": texts}
    response = requests.post(API_URL, headers=headers, json=data)
    response.raise_for_status()
    return response.json()

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

        # Legg til 'title_vector' i DataFrame
        df['title_vector'] = [json.dumps(e['embedding']) for e in title_embeddings['data']]

        # Hent embeddings for kombinerte tekster (hvis nødvendig)
        combined_texts = df['combined_text'].tolist()
        combined_embeddings = fetch_embeddings(combined_texts)

        # Legg til 'combined_text_vector' i DataFrame
        df['combined_text_vector'] = [json.dumps(e['embedding']) for e in combined_embeddings['data']]

        # Lagre ny CSV
        df.to_csv(output_path, sep='|', index=False)
        print(f"Embeddings lagret i: {output_path}")
    except Exception as e:
        print(f"En feil oppsto: {e}")

# Eksempel på bruk
if __name__ == "__main__":
    process_csv(
        "../cleaned_metadata.csv",  # Inndatafil
        "all_columns_vectorized.csv",  # Utdatafil
        ["title", "abstract", "keyword"]  # Kolonner som skal kombineres
    )