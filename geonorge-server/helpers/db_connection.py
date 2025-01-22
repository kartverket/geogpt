# db_connection.py
import psycopg2
from config import CONFIG



_db_connected = False
_connection = None

def connect_client():
    global _db_connected, _connection
    if not _db_connected:
        try:
            _connection = psycopg2.connect(
                host=CONFIG["db"]["host"],
                port=CONFIG["db"]["port"],
                dbname=CONFIG["db"]["name"],
                user=CONFIG["db"]["user"],
                password=CONFIG["db"]["password"],
            )
            print("Connected to Postgres.")
            _db_connected = True
        except Exception as e:
            print("Connection failed to the database.")
            print("Please remember to ensure your database credentials are correct.")
            print(f"Error: {e}")
            exit(1)
    else:
        print("Client is already connected.")

def get_connection():
    """
    Returns the active psycopg2 connection object.
    Remember to call connect_client() once at startup.
    """
    if not _db_connected:
        connect_client()
    return _connection