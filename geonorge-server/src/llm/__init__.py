"""
LLM module for managing language model instances and related functionality.
"""

from .llmManager import LLMManager
from langsmith import traceable
import contextlib
import os

# Initialize LLM manager singleton
llm_manager = LLMManager()

# Export functions to get LLM instances
get_main_llm = llm_manager.get_main_llm
get_rewrite_llm = llm_manager.get_rewrite_llm

# Helper for LangSmith tracing
@contextlib.contextmanager
def langsmith_tracing(name, tags=None, metadata=None):
    """
    Context manager for LangSmith tracing.
    
    Example usage:
    ```
    with langsmith_tracing("my_function", tags=["important", "feature"]):
        # Your code here
        result = llm("Do something")
    ```
    
    Args:
        name: The name for this trace
        tags: Optional list of tags
        metadata: Optional dict of metadata
    """
    if os.environ.get("LANGSMITH_TRACING", "false").lower() == "true":
        from langchain.callbacks.tracers import LangChainTracer
        from langchain.callbacks.manager import CallbackManager
        
        tracer = LangChainTracer(
            project_name=os.environ.get("LANGSMITH_PROJECT", "default"),
        )
        
        if tags:
            tracer.tags = tags
        
        if metadata:
            tracer.metadata = metadata
        
        with CallbackManager.configure(
            handlers=[tracer],
            inherit=True
        ) as callback_manager:
            try:
                yield callback_manager
            finally:
                pass
    else:
        yield None

__all__ = ["LLMManager", "llm_manager", "get_main_llm", "get_rewrite_llm", "langsmith_tracing"] 