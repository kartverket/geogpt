import logging
from typing import Dict, Optional
import tiktoken
from datetime import datetime, date
import json
import os
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TokenTracker:
    def __init__(self, log_dir: str = "logs"):
        """Initialize TokenTracker with configurable log directory
        
        Args:
            log_dir: Directory to store token usage logs (default: "logs")
        """
        # Ensure absolute path
        self.log_dir = os.path.abspath(log_dir)
        self.log_file = os.path.join(self.log_dir, "token_usage.log")
        self.daily_usage: Dict[str, Dict[str, int]] = {}
        
        # Initialize tokenizers
        try:
            # Use encoding_for_model to get the correct encoding for text-embedding-3-large
            self.embedding_encoder = tiktoken.encoding_for_model("text-embedding-3-large")
            logger.info("Successfully initialized text-embedding-3-large tokenizer")
        except Exception as e:
            # Fallback to cl100k_base which is the correct base encoding for text-embedding-3-large
            logger.warning(f"Could not load model-specific tokenizer: {str(e)}. Falling back to cl100k_base")
            self.embedding_encoder = tiktoken.get_encoding("cl100k_base")
        
        # Ensure log directory exists
        os.makedirs(self.log_dir, exist_ok=True)
        
        # Initialize logging
        self._setup_file_logging()
        self.load_daily_usage()
        logger.info(f"TokenTracker initialized. Logging to {self.log_file}")
    
    def _setup_file_logging(self):
        """Setup file handler for logging"""
        # Create a file handler
        file_handler = logging.FileHandler(os.path.join(self.log_dir, "token_tracker.log"))
        file_handler.setLevel(logging.INFO)
        
        # Create a formatter
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        file_handler.setFormatter(formatter)
        
        # Add the handler to the logger
        logger.addHandler(file_handler)
        
    def load_daily_usage(self):
        """Load existing daily usage from log file if it exists"""
        if os.path.exists(self.log_file):
            try:
                with open(self.log_file, 'r') as f:
                    self.daily_usage = json.load(f)
                logger.info(f"Loaded existing token usage data from {self.log_file}")
            except json.JSONDecodeError:
                logger.warning(f"Could not load token usage file {self.log_file}. Starting fresh.")
                self.daily_usage = {}
        else:
            logger.info(f"No existing token usage file found at {self.log_file}. Starting fresh.")
            self.daily_usage = {}

    def save_daily_usage(self):
        """Save daily usage to log file"""
        try:
            with open(self.log_file, 'w') as f:
                json.dump(self.daily_usage, f, indent=2)
            logger.debug(f"Token usage data saved to {self.log_file}")
        except Exception as e:
            logger.error(f"Error saving token usage data: {str(e)}")

    def _get_today_key(self) -> str:
        """Get today's date as string key"""
        return date.today().isoformat()

    def _ensure_today_exists(self):
        """Ensure today's entry exists in daily usage"""
        today = self._get_today_key()
        if today not in self.daily_usage:
            self.daily_usage[today] = {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
                "embedding_tokens": 0,
                "requests": {
                    "llm_calls": 0,
                    "embedding_calls": 0
                }
            }

    def log_llm_tokens(self, prompt_tokens: int, completion_tokens: int, model: str = "unknown"):
        """Log tokens used in an LLM call
        
        Args:
            prompt_tokens: Number of tokens in the prompt
            completion_tokens: Number of tokens in the completion
            model: Name of the model used (default: "unknown")
        """
        self._ensure_today_exists()
        today = self._get_today_key()
        
        self.daily_usage[today]["prompt_tokens"] += prompt_tokens
        self.daily_usage[today]["completion_tokens"] += completion_tokens
        self.daily_usage[today]["total_tokens"] += (prompt_tokens + completion_tokens)
        self.daily_usage[today]["requests"]["llm_calls"] += 1
        
        logger.info(
            f"LLM Token usage - Model: {model}, "
            f"Prompt: {prompt_tokens}, "
            f"Completion: {completion_tokens}, "
            f"Total: {prompt_tokens + completion_tokens}"
        )
        self.save_daily_usage()

    def log_embedding_tokens(self, text: str, model: str = "unknown"):
        """Log tokens used in an embedding call
        
        Args:
            text: Text being embedded
            model: Name of the model used (default: "unknown")
        """
        # Use the correct tokenizer for text-embedding-3-large (cl100k_base)
        token_count = len(self.embedding_encoder.encode(text))
        
        self._ensure_today_exists()
        today = self._get_today_key()
        self.daily_usage[today]["embedding_tokens"] += token_count
        self.daily_usage[today]["requests"]["embedding_calls"] += 1
        
        logger.info(f"Embedding Token usage - Model: {model}, Tokens: {token_count}")
        self.save_daily_usage()

    def get_daily_usage(self, day: Optional[str] = None) -> Dict[str, int]:
        """Get token usage for a specific day or today"""
        if day is None:
            day = self._get_today_key()
        return self.daily_usage.get(day, {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "embedding_tokens": 0,
            "requests": {
                "llm_calls": 0,
                "embedding_calls": 0
            }
        })

    def get_total_usage(self) -> Dict[str, int]:
        """Get total token usage across all days"""
        total = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "embedding_tokens": 0,
            "requests": {
                "llm_calls": 0,
                "embedding_calls": 0
            }
        }
        
        for day_usage in self.daily_usage.values():
            for key in ["prompt_tokens", "completion_tokens", "total_tokens", "embedding_tokens"]:
                total[key] += day_usage.get(key, 0)
            for req_type in ["llm_calls", "embedding_calls"]:
                total["requests"][req_type] += day_usage.get("requests", {}).get(req_type, 0)
        
        return total

# Create a global instance with logs in the server directory
token_tracker = TokenTracker(log_dir=os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")) 