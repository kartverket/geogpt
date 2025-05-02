from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

@dataclass
class ConversationState:
    """
    Manages the state of a conversation session including messages, context, and metadata.
    Used throughout the RAG pipeline to maintain conversation context.
    """
    messages: List[Dict[str, str]] = field(default_factory=list)
    chat_history: str = ""
    context: str = ""
    metadata_context: List[Any] = field(default_factory=list)
    websocket_id: Optional[str] = None
    current_intent: str = "initial"
    last_datasets: List[Dict] = field(default_factory=list)
    follow_up_context: Dict = field(default_factory=dict)
    transformed_query: str = ""

    def to_dict(self) -> Dict:
        """
        Converts the conversation state to a dictionary representation
        """
        return {
            "messages": self.messages,
            "chat_history": self.chat_history,
            "context": self.context,
            "metadata_context": self.metadata_context,
            "websocket_id": self.websocket_id,
            "current_intent": self.current_intent,
            "last_datasets": self.last_datasets,
            "follow_up_context": self.follow_up_context,
            "transformed_query": self.transformed_query
        } 