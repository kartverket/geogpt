import pgvector.psycopg2 as pgvector
from helpers.fetch_openai_embeddings_api import fetch_openai_embeddings
import sys
from pathlib import Path

# ????
sys.path.append(str(Path(__file__).parent.parent))

from helpers.connection import get_connection, return_connection

async def vector_search(vector_array):
    """Search for vectors in the database"""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT uuid, title, title_vector <-> %s::vector AS distance 
                   FROM text_embedding_3_large 
                   ORDER BY title_vector <-> %s::vector LIMIT 20""",
                (vector_array, vector_array)
            )
            rows = cur.fetchall()
        return rows
    finally:
        return_connection(conn)

async def rag_vector_search(vector_array):
    """Search function used for RAG"""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT uuid, title, abstract, image, title_vector <-> %s::vector AS distance 
                   FROM text_embedding_3_large 
                   ORDER BY title_vector <-> %s::vector LIMIT 3""",
                (vector_array, vector_array)
            )
            rows = cur.fetchall()
        return rows
    finally:
        return_connection(conn)

async def get_vdb_response(user_question):
    """Get vector database response for a user question"""
    json_input = await fetch_openai_embeddings(user_question)
    vectorized_input = json_input['data'][0]['embedding']
    vdb_response = await rag_vector_search(vectorized_input)
    return vdb_response

async def get_vdb_search_response(query):
    """Get vector database response for a search query"""
    json_input = await fetch_openai_embeddings(query)
    vectorized_input = json_input['data'][0]['embedding']
    vdb_response = await vector_search(vectorized_input)
    return vdb_response
