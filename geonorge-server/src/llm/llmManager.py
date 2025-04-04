from langchain_openai import ChatOpenAI, AzureChatOpenAI
from config import CONFIG

from typing import Any, Dict, Optional
from langchain.callbacks.base import BaseCallbackHandler
import tiktoken
import logging
from langsmith import Client
from langsmith.wrappers import wrap_openai
import os

# Configure logging
logger = logging.getLogger(__name__)

# Initialize LangSmith client
langsmith_tracing = os.environ.get("LANGSMITH_TRACING", "false").lower() == "true"
if langsmith_tracing:
    try:
        # Create a LangSmith client
        langsmith_client = Client()
        logger.info("LangSmith tracing enabled")
    except Exception as e:
        logger.error(f"Error initializing LangSmith: {str(e)}")
        langsmith_tracing = False
else:
    logger.info("LangSmith tracing disabled")

class LLMManager:
    """
    Manager class for handling different LLM instances.
    Uses a singleton pattern to ensure only one instance of each LLM type exists.
    """
    _instance = None
    _llm = None
    _rewrite_llm = None
    
    MODEL_NAME = "gemini-2.0-flash"

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LLMManager, cls).__new__(cls)
        return cls._instance

    def get_main_llm(self) -> ChatOpenAI:
        """
        Returns the main LLM instance with streaming enabled
        """
        if self._llm is None:
            self._llm = ChatOpenAI(
                model_name=self.MODEL_NAME,
                openai_api_key=CONFIG["api"]["gemini_api_key"],
                openai_api_base=CONFIG["api"]["gemini_base_endpoint"],
                streaming=True,
                temperature=0.3,
                tags=["main_llm", "streaming"],
            )
        return self._llm

    def get_rewrite_llm(self) -> ChatOpenAI:
        """
        Returns the rewrite LLM instance with streaming disabled and zero temperature
        """
        if self._rewrite_llm is None:
            self._rewrite_llm = ChatOpenAI(
                model_name=self.MODEL_NAME,
                openai_api_key=CONFIG["api"]["gemini_api_key"],
                openai_api_base=CONFIG["api"]["gemini_base_endpoint"],
                streaming=False,
                temperature=0,
                tags=["rewrite_llm", "non_streaming"],
            )
        return self._rewrite_llm 