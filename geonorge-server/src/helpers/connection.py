from psycopg2 import pool
from config import CONFIG  # Ensure CONFIG is imported from config

# Get database configuration
db_config = CONFIG["db"]

# Create a connection pool
connection_pool = pool.SimpleConnectionPool(
    minconn=1,
    maxconn=10,
    user=db_config['user'],
    host=db_config['host'],
    database=db_config['name'],
    password=db_config['password'],
    port=db_config['port']
)

connected = False

def get_connection():
    """Get a connection from the pool"""
    global connected
    try:
        if not connected:
            conn = connection_pool.getconn()
            if conn:
                print('Connected to postgres')
                connected = True
                return conn
            else:
                print("Connection failed to the database")
                print("Please remember to make sure your database connection setup is correct")
                raise Exception("Failed to get database connection")
        else:
            print('Client is already connected.')
            return connection_pool.getconn()
    except Exception as e:
        print(f"Connection error: {str(e)}")
        raise

def return_connection(conn):
    """Return a connection to the pool"""
    connection_pool.putconn(conn)

def close_all():
    """Close all connections in the pool"""
    connection_pool.closeall()