from concurrent.futures import ThreadPoolExecutor
from flask import Flask
from flask_cors import CORS
from pathlib import Path
from typing import Optional, Tuple
import asyncio
import logging
import sys
import websockets

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the project root to Python path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

# Import config directly from project root
from config import CONFIG

# Import Blueprints
from api.wms_routes import wms_bp
from api.download_routes import download_bp
from api.details_routes import details_bp
from api.search_routes import search_bp

# Import ChatServer
from websocket.chat_handlers import ChatServer

# Import Swagger
from flask_swagger_ui import get_swaggerui_blueprint

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Register Blueprints
app.register_blueprint(wms_bp, url_prefix='/api')
app.register_blueprint(download_bp, url_prefix='/api')
app.register_blueprint(details_bp, url_prefix='/api')
app.register_blueprint(search_bp, url_prefix='/api')

# Swagger UI setup
SWAGGER_URL = '/api/docs'  # URL for exposing Swagger UI (without trailing '/')
API_URL = '/static/swagger.json'  # Our API url (can of course be a local resource)

# Call factory function to create our blueprint
swaggerui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL,
    API_URL,
    config={  # Swagger UI config overrides
        'app_name': "GeoGPT API"
    }
)

app.register_blueprint(swaggerui_blueprint)

def run_flask():
    """Run Flask in a separate thread"""
    host = CONFIG.get("server", {}).get("host", "0.0.0.0")
    http_port = CONFIG.get("server", {}).get("http_port", 5000)
    app.run(host=host, port=http_port, debug=False, use_reloader=False)

async def main() -> None:
    """
    Initialize and run both the WebSocket server and Flask app
    """
    chat_server = ChatServer()

    host = CONFIG.get("server", {}).get("host", "0.0.0.0")
    ws_port = CONFIG.get("server", {}).get("port", 8080)

    allowed_origins = [
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://geogpt.geokrs.no"
    ]
    logger.info(f"Allowed WebSocket origins: {allowed_origins}")

    async def process_request(path: str, request_headers: websockets.Headers) -> Optional[Tuple[int, websockets.Headers, bytes]]:
        actual_headers = None
        if hasattr(request_headers, 'get'):
            actual_headers = request_headers
        elif hasattr(request_headers, 'headers') and hasattr(request_headers.headers, 'get'):
            actual_headers = request_headers.headers
        else:
            logger.error(f"Could not extract headers from request_headers object of type: {type(request_headers)}")
            return (500, websockets.datastructures.Headers(), b"Internal Server Error\n")

        origin = actual_headers.get("Origin")
        if origin not in allowed_origins:
            logger.warning(f"Rejected WebSocket connection from invalid origin: {origin}")
            return (403, websockets.datastructures.Headers(), b"Forbidden\n") 

        if actual_headers.get("Access-Control-Request-Method"):
            response_headers_list = [
                ("Access-Control-Allow-Origin", origin),
                ("Access-Control-Allow-Methods", "GET, OPTIONS"),
                ("Access-Control-Allow-Headers", "content-type"), 
                ("Access-Control-Max-Age", "86400"),
                ("Access-Control-Allow-Credentials", "true"),
            ]
            logger.debug(f"Responding to OPTIONS request from {origin}")
            response_headers_obj = websockets.datastructures.Headers(response_headers_list)
            return (200, response_headers_obj, b"OK\n")

        logger.debug(f"Allowing GET request from allowed origin: {origin}")
        return None

    ws_server = await websockets.serve(
        chat_server.ws_handler,
        host,
        ws_port,
        compression=None,
        process_request=process_request
    )
    logger.info("WebSocket server running on ws://%s:%s", host, ws_port)

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, run_flask)

    await ws_server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())