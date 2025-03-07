import psycopg2
import asyncio
from config import DB_CONFIG, CONFIG
import aiohttp

# HELPER INCASE FILES ARENT BEING EMBEDDED or if you insert later.

async def get_embedding(text):
    """Get embedding from Azure OpenAI API."""
    headers = {
        'Content-Type': 'application/json',
        'api-key': CONFIG["api"]["azure_embedding_api_key"]
    }
    
    data = {
        'input': text,
        'model': 'text-embedding-3-large'
    }
    
    base_url = CONFIG["api"]["azure_embeddings_endpoint"]
    deployment_name = "text-embedding-3-large"
    api_version = "2024-02-15-preview"
    
    endpoint = f"{base_url}/openai/deployments/{deployment_name}/embeddings?api-version={api_version}"
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            endpoint,
            headers=headers,
            json=data
        ) as response:
            if response.status == 200:
                result = await response.json()
                return result['data'][0]['embedding']
            else:
                error_data = await response.text()
                raise Exception(f'Azure OpenAI API error: {error_data}')

async def update_entry_embeddings(cur, uuid, title, abstract):
    """Update embeddings for a single database entry."""
    try:
        # Get embeddings for both title and combined text
        title_vector = await get_embedding(title)
        combined_text = f"{title} {abstract}"
        combined_text_vector = await get_embedding(combined_text)
        
        # Update the entry with the embeddings
        cur.execute("""
            UPDATE text_embedding_3_large
            SET title_vector = %s,
                combined_text_vector = %s
            WHERE uuid = %s
        """, (title_vector, combined_text_vector, uuid))
        
        print(f"Successfully updated embeddings for: {title}")
        return True
    except Exception as e:
        print(f"Error updating embeddings for {title}: {e}")
        return False

async def update_all_embeddings():
    """Update embeddings for all entries that need them."""
    try:
        # Connect to database
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Get all entries that need embeddings updated
        # This includes entries where either vector is NULL
        cur.execute("""
            SELECT uuid, title, abstract
            FROM text_embedding_3_large
            WHERE title_vector IS NULL 
               OR combined_text_vector IS NULL;
        """)
        
        results = cur.fetchall()
        if not results:
            print("No entries found that need embeddings updated")
            return
            
        print(f"Found {len(results)} entries that need embeddings updated")
        
        # Update each entry
        success_count = 0
        for uuid, title, abstract in results:
            if await update_entry_embeddings(cur, uuid, title, abstract):
                success_count += 1
                conn.commit()  # Commit after each successful update
        
        print(f"\nSummary:")
        print(f"Total entries processed: {len(results)}")
        print(f"Successfully updated: {success_count}")
        print(f"Failed updates: {len(results) - success_count}")
        
    except Exception as e:
        print(f"Error in update process: {e}")
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    asyncio.run(update_all_embeddings()) 