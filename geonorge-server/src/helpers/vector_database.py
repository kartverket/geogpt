import asyncio
import sys
from pathlib import Path
from functools import partial

import pgvector.psycopg2 as pgvector
from helpers.fetch_openai_embeddings_api import fetch_openai_embeddings

# Add the project root to Python path
sys.path.append(str(Path(__file__).parent.parent))

from helpers.connection import get_connection, return_connection


def _vector_search(vector_array):
    """Synchronous search for vectors in the database returning 20 results."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT uuid, title, title_vector <-> %s::vector AS distance 
                FROM text_embedding_3_large 
                ORDER BY title_vector <-> %s::vector LIMIT 20
                """,
                (vector_array, vector_array)
            )
            rows = cur.fetchall()
        return rows
    finally:
        return_connection(conn)


def _rag_vector_search(vector_array):
    """Synchronous search function used for RAG returning 3 results."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT uuid, title, abstract, image, title_vector <-> %s::vector AS distance 
                FROM text_embedding_3_large 
                ORDER BY title_vector <-> %s::vector LIMIT 10
                """,
                (vector_array, vector_array)
            )
            rows = cur.fetchall()
        return rows
    finally:
        return_connection(conn)


async def vector_search(vector_array):
    """
    Asynchronously search for vectors in the database by offloading
    the synchronous query to a separate thread.
    """
    return await asyncio.to_thread(_vector_search, vector_array)


async def rag_vector_search(vector_array):
    """
    Asynchronously search for vectors used for RAG by offloading
    the synchronous query to a separate thread.
    """
    return await asyncio.to_thread(_rag_vector_search, vector_array)


async def get_vdb_response(user_question):
    """
    Get the vector database response for a user question. This is used in RAG
    and limits results to 3 datasets.
    """
    json_input = await fetch_openai_embeddings(user_question)
    vectorized_input = json_input['data'][0]['embedding']
    vdb_response = await rag_vector_search(vectorized_input)
    return vdb_response


async def get_vdb_search_response(query):
    """
    Get the vector database response for a search query. This is used to build
    the 'kartkatalogen' (catalog) with 20 elements.
    """
    json_input = await fetch_openai_embeddings(query)
    vectorized_input = json_input['data'][0]['embedding']
    vdb_response = await vector_search(vectorized_input)
    return vdb_response
