from typing import List, Dict, Any
from langchain.memory import ConversationBufferMemory as LangChainMemory
from langchain.schema import HumanMessage, AIMessage
from openai import AzureOpenAI
from config import CONFIG

# Initialize Azure OpenAI client
client = AzureOpenAI(
    api_key=CONFIG["api"]["azure_gpt_api_key"],
    api_version="2024-02-15-preview",
    azure_endpoint=CONFIG["api"]["azure_gpt_endpoint"]
)

class EnhancedConversationMemory:
    def __init__(self, max_token_limit: int = 2000):
        self.memory = LangChainMemory(
            memory_key="chat_history",
            return_messages=True,
            max_token_limit=max_token_limit
        )
        
    def add_message(self, role: str, content: str) -> None:
        """Add a message to the conversation history"""
        if role == "user":
            self.memory.chat_memory.add_message(HumanMessage(content=content))
        elif role == "assistant":
            self.memory.chat_memory.add_message(AIMessage(content=content))
            
    def get_memory_messages(self) -> List[Dict[str, Any]]:
        """Get all messages in the conversation history"""
        messages = []
        for message in self.memory.chat_memory.messages:
            messages.append({
                "role": "user" if isinstance(message, HumanMessage) else "assistant",
                "content": message.content
            })
        return messages
    
    def get_context_string(self) -> str:
        """Get formatted conversation history as a string"""
        if not self.memory.chat_memory.messages:
            return ""
            
        conversation_pairs = []
        messages = self.memory.chat_memory.messages
        
        for i in range(0, len(messages), 2):
            if i + 1 < len(messages):
                q = messages[i].content
                a = messages[i + 1].content
                conversation_pairs.append(f"Spørsmål: {q}\nSvar: {a}")
                
        memory_context = "\n\nTidligere samtalehistorikk:\n" + "\n\n".join(conversation_pairs)
        memory_context += (
            "\n\nVIKTIG: Dette er et oppfølgingsspørsmål. Prioriter informasjon fra den tidligere samtalen "
            "før du introduserer nye datasett. Hvis spørsmålet er relatert til tidligere nevnte datasett, fokuser på disse først.\n\n"
        )
        return memory_context