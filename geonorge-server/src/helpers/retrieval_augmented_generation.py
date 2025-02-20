import os
from typing import List, Dict, Any, Optional, Annotated
from dataclasses import dataclass, field
from openai import AzureOpenAI
from config import CONFIG
from helpers.websocket import send_websocket_message
from helpers.download import dataset_has_download, get_download_url, get_standard_or_first_format
from helpers.fetch_valid_download_api_data import get_wms
from helpers.vector_database import get_vdb_response
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.prompts import ChatPromptTemplate
from langchain.schema import StrOutputParser
from langchain_core.documents import Document
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, END, StateGraph
from langchain_openai import AzureChatOpenAI, ChatOpenAI
from instructions.prompt_instructions import SYSTEM_PROMPT, QUERY_REWRITE_PROMPT

# Gemini LLM
llm = ChatOpenAI(
    model_name="gemini-2.0-flash",
    openai_api_key=CONFIG["api"]["gemini_api_key"],
    openai_api_base=CONFIG["api"]["gemini_base_endpoint"],
    streaming=True,
    temperature=0.3,
)
# Rewrite with Azure OpenAI
rewrite_llm = AzureChatOpenAI(
    api_key=CONFIG["api"]["azure_gpt_api_key"],
    api_version="2024-02-15-preview",
    azure_endpoint=CONFIG["api"]["azure_gpt_endpoint"],
    streaming=True,
    temperature=0.3,
)

class GeoNorgeVectorRetriever:
    async def _transform_query(self, query: str) -> str:
        """Transform the query to improve retrieval quality."""
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", QUERY_REWRITE_PROMPT),
            ("human", query)
        ])
        
        chain = prompt | rewrite_llm | StrOutputParser()
        transformed_query = await chain.ainvoke({"query": query})

        return transformed_query.strip()

    async def get_relevant_documents(self, query: str):
        transformed_query = await self._transform_query(query)
        print(f"Transformed Query: {transformed_query}")
        vdb_response = await get_vdb_response(transformed_query)
        
        documents = []
        for row in vdb_response:
            metadata = {
                "uuid": row[0],
                "title": row[1],
                "image": row[3] if len(row) > 3 else None,
                "metadatacreationdate": row[4] if len(row) > 4 else None  
            }
            url_formatted_title = row[1].replace(' ', '-')
            source_url = f"https://kartkatalog.geonorge.no/metadata/{url_formatted_title}/{row[0]}"
            
            content = f"Datasett: {row[1]}\n"
            if len(row) > 2 and row[2]:
                content += f"Beskrivelse: {row[2]}\n"
            if metadata["metadatacreationdate"]:
                try:
                    date_parts = metadata["metadatacreationdate"].split('-')
                    if len(date_parts) == 3:
                        norwegian_date = f"{date_parts[2]}.{date_parts[1]}.{date_parts[0]}"
                        content += f"Sist oppdatert: {norwegian_date}\n"
                except:
                    content += f"Sist oppdatert: {metadata['metadatacreationdate']}\n"
            content += f"Mer informasjon: {source_url}"
            
            documents.append(Document(
                page_content=content,
                metadata=metadata
            ))
        
        if not documents:
            documents.append(Document(
                page_content="Beklager, jeg fant ingen relevante datasett for dette spørsmålet i GeoNorge sin database.",
                metadata={"fallback": True}
            ))
            
        return documents, vdb_response

@dataclass
class ChatState:
    messages: List[Dict[str, str]] = field(default_factory=list)
    chat_history: str = ""
    context: str = ""
    metadata_context: List[Any] = field(default_factory=list)
    websocket_id: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "messages": self.messages,
            "chat_history": self.chat_history,
            "context": self.context,
            "metadata_context": self.metadata_context,
            "websocket_id": self.websocket_id
        }

class GeoNorgeRAGChain:
    def __init__(self):
        self.memory = MemorySaver()
        self.retriever = GeoNorgeVectorRetriever()
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )
        self.chain = self._build_chain()
        self.sessions = {}
        self.active_websockets = {}

    def _build_chain(self):
        async def retriever(state: Dict) -> Dict:
            """Node that retrieves relevant context."""
            current_state = ChatState(**state)
            messages = current_state.messages
            last_message = messages[-1]["content"] if messages else ""
            
            documents, vdb_response = await self.retriever.get_relevant_documents(last_message)
            
            current_state.context = "\n\n".join(doc.page_content for doc in documents)
            current_state.metadata_context = vdb_response
            
            return current_state.to_dict()

        async def generate_response(state: Dict) -> Dict:
            """Node that generates the response using the LLM."""
            current_state = ChatState(**state)
            
            websocket = self.active_websockets.get(current_state.websocket_id)
            if not websocket:
                raise ValueError(f"No active websocket found for ID: {current_state.websocket_id}")

            prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("user", """Bruker spørsmål: {input}

Tidligere samtale:
{chat_history}

Tilgjengelig kontekst:
{context}""")
])
            
            messages = current_state.messages
            last_message = messages[-1]["content"] if messages else ""
            
            chain = prompt | llm
            response_chunks = []
            
            await send_websocket_message("chatStream", {"payload": "", "isNewMessage": True}, websocket)
            
            async for chunk in chain.astream({
                "input": last_message,
                "chat_history": current_state.chat_history,
                "context": current_state.context
            }):
                if hasattr(chunk, 'content'):
                    response_chunks.append(chunk.content)
                    await send_websocket_message("chatStream", {"payload": chunk.content}, websocket)
            
            full_response = "".join(response_chunks)
            messages.append({"role": "assistant", "content": full_response})
            
            current_state.messages = messages
            current_state.chat_history = self._format_history(messages)
            
            return current_state.to_dict()

        workflow = StateGraph(Annotated[Dict, "ChatState"])
        workflow.add_node("retriever", retriever)
        workflow.add_node("generate_response", generate_response)
        workflow.add_edge(START, "retriever")
        workflow.add_edge("retriever", "generate_response")
        workflow.add_edge("generate_response", END)
        
        return workflow.compile(checkpointer=self.memory)

    async def chat(self, query: str, session_id: str, websocket) -> str:
        """Main method to handle chat interactions."""
        websocket_id = str(id(websocket))
        self.active_websockets[websocket_id] = websocket
        
        try:
            # Initialize or get existing session state
            if session_id not in self.sessions:
                current_state = ChatState(websocket_id=websocket_id)
            else:
                state_dict = self.sessions[session_id]
                state_dict['websocket_id'] = websocket_id
                current_state = ChatState(**state_dict)
            
            # Add new message
            current_state.messages.append({"role": "human", "content": query})
            current_state.chat_history = self._format_history(current_state.messages)
            
            # Run chain
            config = {"configurable": {"thread_id": session_id}}
            final_state = await self.chain.ainvoke(current_state.to_dict(), config=config)
            
            # Store updated state
            self.sessions[session_id] = final_state
            
            if final_state.get('messages'):
                last_message = final_state['messages'][-1]['content']
                await insert_image_rag_response(
                    last_message,
                    final_state.get('metadata_context', []),
                    websocket
                )
                return last_message
            
            return "No response generated."
            
        finally:
            self.active_websockets.pop(websocket_id, None)

    def _format_history(self, messages: list) -> str:
        return "\n".join(f'{m["role"]}: {m["content"]}' for m in messages)

async def check_image_signal(gpt_response, metadata_context_list):
    import re
    field_names = ['uuid', 'title', 'abstract', 'image', 'distance']
    dict_response = [dict(zip(field_names, row)) for row in metadata_context_list]
    for row in dict_response:
        row['wmsUrl'] = await get_wms(row['uuid'])
    bold_titles = re.findall(r'\*\*(.*?)\*\*', gpt_response)
    if not bold_titles:
        return False
    for obj in dict_response:
        title = obj.get("title", "").lower()
        for bold_text in bold_titles:
            bold_lower = bold_text.lower().replace(" ", "")
            title_lower = title.replace(" ", "")
            print(f"Comparing with bold text: {bold_text}")
            print(f"Normalized comparison: '{title_lower}' vs '{bold_lower}'")
            if bold_lower in title_lower:
                if obj.get("uuid") and obj.get("image"):
                    image_field = obj["image"]
                    image_urls = [s.strip() for s in image_field.split(",") if s.strip()]
                    if not image_urls:
                        continue
                    dataset_image_url = image_urls[-1]
                    dataset_uuid = obj["uuid"]
                    download_url = None
                    try:
                        if await dataset_has_download(dataset_uuid):
                            standard_format = await get_standard_or_first_format(dataset_uuid)
                            if standard_format:
                                download_url = await get_download_url(dataset_uuid, standard_format)
                    except Exception as e:
                        print(f"Failed to get download URL: {e}")
                    return {
                        "uuid": dataset_uuid,
                        "datasetImageUrl": dataset_image_url,
                        "downloadUrl": download_url,
                        "wmsUrl": obj.get("wmsUrl", None)
                    }
    return False

async def insert_image_rag_response(full_response, vdb_response, websocket):
    dataset_info = await check_image_signal(full_response, vdb_response)
    if dataset_info:
        await send_websocket_message(
            "insertImage",
            {
                "datasetUuid": dataset_info["uuid"],
                "datasetImageUrl": dataset_info["datasetImageUrl"],
                "datasetDownloadUrl": dataset_info["downloadUrl"],
                "wmsUrl": dataset_info["wmsUrl"]
            },
            websocket
        )

rag_chain = GeoNorgeRAGChain()

async def get_rag_response(
    user_question: str,
    datasets_with_status: Optional[List[Dict[str, Any]]] = None,
    vdb_response: Optional[Any] = None,
    websocket: Optional[Any] = None
) -> str:
    session_id = str(id(websocket))
    return await rag_chain.chat(user_question, session_id, websocket)

async def get_rag_context(vdb_response):
    return None, None