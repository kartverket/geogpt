import os
import sys
from aiohappyeyeballs import start_connection
import pandas as pd
import requests
import json
import config
import socket

# Correct API URL format using the correct domain
BASE_URL = config.CONFIG["api"]["azure_embeddings_endpoint"] or os.environ.get("AZURE_EMBEDDING_URL") or os.environ.get("AZURE_EMBEDDING_ENDPOINT")
# Exit early if BASE_URL is empty
if not BASE_URL:
    raise ValueError("Azure Embedding Endpoint URL is empty. Please check your configuration or environment variables.")

# Ensure BASE_URL doesn't end with a slash
BASE_URL = "https://kartai-openai.openai.azure.com"
API_KEY = config.CONFIG["api"]["azure_embedding_api_key"]
MODEL = "text-embedding-3-large"
API_URL = f"{BASE_URL}/openai/deployments/{MODEL}/embeddings?api-version=2023-05-15"

print(f"BASE_URL: {BASE_URL}")
print(f"Full API URL: {API_URL}")

def test_connection():
    try:
        # Extract hostname from URL
        from urllib.parse import urlparse
        parsed_url = urlparse(BASE_URL)
        hostname = parsed_url.hostname
        if not hostname:
            print(f"Invalid hostname in URL: {BASE_URL}")
            return False
            
        # Attempt to resolve the hostname
        socket.gethostbyname(hostname)
        return True
    except Exception as e:
        print(f"Connection test failed: {e}")
        return False


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

def log_error(message):
    print(f"ERROR: {message}")

# Eksempel på bruk
if __name__ == "__main__":
    try:
        # Initial setup and validation
        input_file = os.path.abspath("/app/cleaned_metadata.csv")
        output_file = os.path.abspath("/app/all_columns_vectorized.csv")
        
        # Validate input file
        if not os.path.exists(input_file):
            raise FileNotFoundError(f"Input file not found: {input_file}")
            
        # Test connection
        if not test_connection():
            raise ConnectionError("Failed to establish connection to Azure API")
        
        # Process the CSV
        process_csv(
            input_file,
            output_file,
            ["title", "abstract", "keyword"]
        )
        
        
    except FileNotFoundError as e:
        log_error(f"File error: {str(e)}")
        sys.exit(1)
    except ConnectionError as e:
        log_error(f"Connection error: {str(e)}")
        sys.exit(1)
    except Exception as e:
        log_error(f"Unexpected error: {str(e)}")
        sys.exit(1)