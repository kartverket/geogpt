from langchain_openai import ChatOpenAI
from config import CONFIG

class LLMManager:
    """
    Manager class for handling different LLM instances.
    Uses a singleton pattern to ensure only one instance of each LLM type exists.
    """
    _instance = None
    _llm = None
    _rewrite_llm = None

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
                model_name="gemini-2.0-flash",
                openai_api_key=CONFIG["api"]["gemini_api_key"],
                openai_api_base=CONFIG["api"]["gemini_base_endpoint"],
                streaming=True,
                temperature=0.3,
            )
        return self._llm

    def get_rewrite_llm(self) -> ChatOpenAI:
        """
        Returns the rewrite LLM instance with streaming disabled and zero temperature
        """
        if self._rewrite_llm is None:
            self._rewrite_llm = ChatOpenAI(
                model_name="gemini-2.0-flash",
                openai_api_key=CONFIG["api"]["gemini_api_key"],
                openai_api_base=CONFIG["api"]["gemini_base_endpoint"],
                streaming=False,
                temperature=0,
            )
        return self._rewrite_llm 