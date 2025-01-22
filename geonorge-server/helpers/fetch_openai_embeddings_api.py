# fetch_openai_embeddings_api.py
import aiohttp
from config import CONFIG

async def fetch_openai_embeddings(input_text: str) -> dict:
    """
    Calls OpenAI Embeddings API. Returns JSON response.
    """
    openai_key = CONFIG["api"]["openai_embedding_api_key"]
    model = CONFIG["api"]["model"]

    url = "https://api.openai.com/v1/embeddings"
    headers = {
        "Authorization": f"Bearer {openai_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "input": input_text,
        "model": model,
        "encoding_format": "float",
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, headers=headers) as resp:
            if not resp.ok:
                error_body = await resp.text()
                raise RuntimeError(f"Network response failed: {resp.status} {resp.reason} - {error_body}")
            return await resp.json()

# If you want to store logs in CSV, you could replicate "appendToCsv" here:
# import csv
# def append_to_csv(string_input: str, filename: str = "./sokLog.csv"):
#     with open(filename, "a", newline="", encoding="utf-8") as f:
#         writer = csv.writer(f)
#         writer.writerow([string_input])