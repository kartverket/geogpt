import pytest # type: ignore
import requests
import psycopg2
import time


def test_database_connection():
    """Test if we can connect to the database"""
    try:
        conn = psycopg2.connect(
            host="localhost",
            database="asd",
            user="asd",
            password="asd",
            port="5432"
        )
        assert conn is not None
        conn.close()
    except Exception as e:
        pytest.fail(f"Failed to connect to database: {str(e)}")

def test_backend_health():
    """Test if backend is responding"""
    try:
        response = requests.get("http://localhost:8080")
        assert response.status_code in [200, 404]  # 404 is ok if endpoint doesn't exist
    except requests.exceptions.ConnectionError:
        pytest.fail("Backend service is not responding")

def test_frontend_health():
    """Test if frontend is responding"""
    try:
        response = requests.get("http://localhost:3000")
        assert response.status_code == 200
    except requests.exceptions.ConnectionError:
        pytest.fail("Frontend service is not responding")

def test_vector_creation():
    """Test if vectors are being created"""
    # Add custom logic to verify vector creation
    pass