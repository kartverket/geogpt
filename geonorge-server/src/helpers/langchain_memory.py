import uuid
from typing import List, Dict, Any
from openai import AzureOpenAI
from config import CONFIG
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, MessagesState, StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

# Initialize Azure OpenAI client
client = AzureOpenAI(
    api_key=CONFIG["api"]["azure_gpt_api_key"],
    api_version="2024-02-15-preview",
    azure_endpoint=CONFIG["api"]["azure_gpt_endpoint"]
)

class State(MessagesState):
    summary: str = ""

class EnhancedConversationMemory:
    def __init__(self, max_token_limit: int = 1000):
        self.memory = MemorySaver()
        self.workflow = self._build_workflow()
        self.thread_id = str(uuid.uuid4())
        self.max_token_limit = max_token_limit
        
    def _build_workflow(self):
        workflow = StateGraph(State)
        workflow.add_node("conversation", self._process_messages)
        workflow.add_node("summarize_conversation", self._summarize_conversation)
        
        workflow.set_entry_point("conversation")
        workflow.add_conditional_edges(
            "conversation",
            self._should_continue,
        )
        workflow.add_edge("summarize_conversation", END)
        
        return workflow.compile(checkpointer=self.memory)
    
    def _should_continue(self, state: State) -> str:
        messages = state["messages"]
        if len(messages) > 6:  # Summarize after 3 exchanges (6 messages)
            return "summarize_conversation"
        return END
    
    def _process_messages(self, state: State):
        messages = state["messages"]
        summary = state.get("summary", "")
        
        if summary:
            system_message = SystemMessage(content=f"Previous conversation summary: {summary}")
            messages = [system_message] + messages
            
        return {"messages": messages}
    
    async def _summarize_conversation(self, state: State):
        summary = state.get("summary", "")
        messages = state["messages"]
        
        if summary:
            summary_prompt = (
                f"This is summary of the conversation to date: {summary}\n\n"
                "Extend the summary by taking into account the new messages above:"
            )
        else:
            summary_prompt = "Create a summary of the conversation above:"
            
        # Create a system message for summarization
        system_message = SystemMessage(content="You are a helpful assistant. Please summarize the conversation concisely.")
        summary_message = HumanMessage(content=summary_prompt)
        
        # Get summary from Azure OpenAI
        response = await self._get_summary_from_azure(messages + [system_message, summary_message])
        
        # Keep only the last 2 exchanges (4 messages)
        keep_messages = messages[-4:] if len(messages) > 4 else messages
        
        return {
            "summary": response,
            "messages": keep_messages
        }
    
    async def _get_summary_from_azure(self, messages):
        # Convert messages to OpenAI format
        openai_messages = [
            {"role": "system" if msg.type == "system" else "user" if msg.type == "human" else "assistant",
             "content": msg.content}
            for msg in messages
        ]
        
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=openai_messages,
            temperature=0.7,
            max_tokens=300
        )
        
        return response.choices[0].message.content
    
    def get_context_string(self) -> str:
        """Get formatted conversation history as a string"""
        state = self.memory.get(self.thread_id)
        if not state:
            return ""
        
        summary = state.get("summary", "")
        messages = state.get("messages", [])[-4:]  # Get last 2 exchanges
        
        conversation_pairs = []
        for i in range(0, len(messages), 2):
            if i + 1 < len(messages):
                q = messages[i].content
                a = messages[i + 1].content[:200]  # Truncate long responses
                conversation_pairs.append(f"Spørsmål: {q}\nSvar: {a}")
        
        memory_context = "\n\nTidligere samtalehistorikk:\n"
        if summary:
            memory_context += f"Sammendrag: {summary}\n\n"
        memory_context += "\n\n".join(conversation_pairs)
        memory_context += (
            "\n\nVIKTIG: Dette er et oppfølgingsspørsmål. Prioriter informasjon fra den tidligere samtalen "
            "før du introduserer nye datasett. Hvis spørsmålet er relatert til tidligere nevnte datasett, fokuser på disse først.\n\n"
        )
        return memory_context
    
    async def add_message(self, message: str, is_human: bool = True):
        """Add a new message to the conversation history"""
        message_obj = HumanMessage(content=message) if is_human else AIMessage(content=message)
        config = {"configurable": {"thread_id": self.thread_id}}
        
        current_state = self.memory.get(self.thread_id)
        messages = current_state["messages"] if current_state and "messages" in current_state else []
        messages.append(message_obj)
        
        async for output in self.workflow.astream({"messages": messages}, config, stream_mode="values"):
            if "summary" in output:
                print(f"Generated summary: {output['summary']}")