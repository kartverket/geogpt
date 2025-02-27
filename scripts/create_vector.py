import pandas as pd
import requests
import json
import config
import socket
import os
import warnings
import urllib3
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import sys

# Suppress only the specific InsecureRequestWarning
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configure logging formats
def log_info(message):
    print(f"INFO: {message}")

def log_error(message):
    print(f"ERROR: {message}")

def log_debug(message):
    print(f"DEBUG: {message}")

# Set up session with retry strategy
session = requests.Session()
retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
)
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("https://", adapter)

def test_connection():
    """Test connection to the Azure API endpoint."""
    try:
        endpoint = config.CONFIG["api"]["azure_embeddings_endpoint"]
        host = endpoint.split("//")[1].split("/")[0]
        log_info(f"Testing connection to {host}")
        
        response = session.get(f"https://{host}", timeout=5, verify=False)
        log_debug(f"Connection test status: {response.status_code}")
        return True
    except Exception as e:
        log_error(f"Connection test failed: {str(e)}")
        return False

def fetch_embeddings(texts, model="text-embedding-3-large"):
    """
    Fetch embeddings from Azure API with error handling.
    
    Args:
        texts (list): List of texts to get embeddings for
        model (str): Model name to use
        
    Returns:
        dict: API response with embeddings
    """
    try:
        headers = {
            "api-key": config.CONFIG["api"]["azure_embedding_api_key"],
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        data = {"input": texts}
        url = config.CONFIG["api"]["azure_embeddings_endpoint"]
        
        log_debug(f"Making API request for {len(texts)} texts")
        response = session.post(
            url, 
            headers=headers, 
            json=data, 
            verify=False,
            timeout=30
        )
        
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        log_error(f"API request failed: {str(e)}")
        if hasattr(e, 'response'):
            log_error(f"Response status: {e.response.status_code}")
            log_error(f"Response text: {e.response.text}")
        raise

def process_batch(df, start_idx, batch_size, process_type="title"):
    """
    Process a batch of texts for embeddings.
    
    Args:
        df (pd.DataFrame): DataFrame containing the texts
        start_idx (int): Starting index for the batch
        batch_size (int): Size of the batch
        process_type (str): Type of processing ('title' or 'combined')
        
    Returns:
        list: Embeddings for the batch
    """
    try:
        texts = (df['title'] if process_type == 'title' else df['combined_text'])\
                .fillna('')\
                .iloc[start_idx:start_idx+batch_size]\
                .tolist()
        
        embeddings = fetch_embeddings(texts)
        return [json.dumps(e['embedding']) for e in embeddings['data']]
    except Exception as e:
        log_error(f"Batch processing failed for {process_type} batch starting at {start_idx}: {str(e)}")
        raise

def process_csv(file_path, output_path, columns_to_combine):
    """
    Process CSV file to generate and save embeddings.
    """
    try:
        log_info(f"Reading CSV from: {file_path}")
        df = pd.read_csv(file_path, delimiter='|')
        log_info(f"Successfully read {len(df)} rows")

        # Combine specified columns
        df['combined_text'] = df[columns_to_combine].fillna('').agg(' '.join, axis=1)
        
        # Process in batches
        batch_size = 10
        total_batches = (len(df) + batch_size - 1) // batch_size
        all_title_embeddings = []
        all_combined_embeddings = []

        for batch_num in range(total_batches):
            start_idx = batch_num * batch_size
            log_info(f"Processing batch {batch_num + 1}/{total_batches}")
            
            # Process titles
            title_embeddings = process_batch(df, start_idx, batch_size, "title")
            all_title_embeddings.extend(title_embeddings)
            
            # Process combined texts
            combined_embeddings = process_batch(df, start_idx, batch_size, "combined")
            all_combined_embeddings.extend(combined_embeddings)

        # Add embeddings to DataFrame
        df['title_vector'] = all_title_embeddings
        df['combined_text_vector'] = all_combined_embeddings

        # Save results
        log_info(f"Saving results to: {output_path}")
        df.to_csv(output_path, sep='|', index=False)
        log_info("Processing completed successfully")
        
        return df
    except pd.errors.EmptyDataError:
        log_error(f"The CSV file {file_path} is empty")
        raise
    except Exception as e:
        log_error(f"CSV processing failed: {str(e)}")
        raise

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