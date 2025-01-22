# vector_database.py
import pgvector
from .fetch_openai_embeddings_api import fetch_openai_embeddings
from .db_connection import connect_client, get_connection

# Ensure the client is connected once at startup
connect_client()

def vector_search(vector_array):
    conn = get_connection()
    with conn.cursor() as cur:
        sql = """
            SELECT uuid, title, title_vector <-> %s::vector AS distance
            FROM text_embedding_3_large
            ORDER BY title_vector <-> %s::vector
            LIMIT 20
        """
        cur.execute(sql, (vector_array, vector_array))
        rows = cur.fetchall()
    return [{"uuid": row[0], "title": row[1], "distance": row[2]} for row in rows]

def rag_vector_search(vector_array):
    conn = get_connection()
    with conn.cursor() as cur:
        sql = """
            SELECT uuid, title, abstract, image, title_vector <-> %s::vector AS distance
            FROM text_embedding_3_large
            ORDER BY title_vector <-> %s::vector
            LIMIT 3
        """
        cur.execute(sql, (vector_array, vector_array))
        rows = cur.fetchall()

    results = []
    for row in rows:
        uuid, title, abstract, image, distance = row
        results.append({
            "uuid": uuid,
            "title": title,
            "abstract": abstract,
            "image": image,
            "distance": distance
        })
    return results

async def get_vdb_response(user_question: str) -> list[dict]:
    """
    Embeds user_question, then searches the DB for top 3 matches (RAG).
    """
    embedding_json = await fetch_openai_embeddings(user_question)
    embedding_vector = embedding_json["data"][0]["embedding"]
    return rag_vector_search(embedding_vector)

async def get_vdb_search_response(query: str) -> list[dict]:
    """
    Embeds query, then does a standard vector search to get ~20 matches.
    """
    embedding_json = await fetch_openai_embeddings(query)
    embedding_vector = embedding_json["data"][0]["embedding"]
    return vector_search(embedding_vector)