import os
from typing import List, Dict, Any
from dataclasses import dataclass, field, asdict

from typing import Optional, Any

import asyncio
from typing import Optional, Any, Dict
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

# Initialize Azure OpenAI client
# llm = AzureChatOpenAI(
#     openai_api_version="2024-02-15-preview",
#     azure_deployment="gpt-4o-mini",
#     azure_endpoint=CONFIG["api"]["azure_gpt_endpoint"],
#     openai_api_key=CONFIG["api"]["azure_gpt_api_key"],
#     temperature=0.3,
#     streaming=True  
# )
# Initialize Gemini client with OpenAI compatibility
llm = ChatOpenAI(
    model_name="gemini-1.5-flash",
    openai_api_key=CONFIG["api"]["gemini_api_key"],
    openai_api_base=CONFIG["api"]["gemini_base_endpoint"],
    streaming=True,
    temperature=0.3,
)

SYSTEM_PROMPT = """Du er GeoGPT, en spesialisert assistent for GeoNorge. Du kan kun svare på spørsmål relatert til:

GeoNorge sine datatjenester og datasett
Kartdata og geografisk informasjon i Norge
Tekniske spørsmål om GeoNorge sine tjenester
Norske standarder for geografisk informasjon
Retningslinjer for svar:
Bruk konteksten
Hvis du refererer til et spesifikt datasett, må du alltid starte svaret med datasettets tittel i bold (f.eks. FKB-Tiltak).
Inkluder alltid relevante kilder fra konteksten i en liste på slutten av svaret med Kilder: [Tittel på kilde](URL til kilde).

Prioriter alltid å referere til relevante datasett fra konteksten hvis de finnes.
Du kan også svare på generelle spørsmål om GIS, Geomatikk og geografiske data.
Avstå fra å svare på spørsmål som ikke er relatert til Geonorge, geografiske datasett eller GIS. Hvis du får slike spørsmål, forklar høflig at du kun kan svare på spørsmål relatert til GeoNorge og geografisk informasjon i Norge.

Bruk tidligere samtalehistorikk og kontekst til å gi presise og relevante svar."""

class GeoNorgeVectorRetriever:
    async def get_relevant_documents(self, query: str):
        vdb_response = await get_vdb_response(query)
        documents = []
        for row in vdb_response:
            metadata = {
                "uuid": row[0],
                "title": row[1],
                "image": row[3] if len(row) > 3 else None
            }
            url_formatted_title = row[1].replace(' ', '-')
            source_url = f"https://kartkatalog.geonorge.no/metadata/{url_formatted_title}/{row[0]}"
            
            content = f"Datasett: {row[1]}\n"
            if len(row) > 2 and row[2]:
                content += f"Beskrivelse: {row[2]}\n"
            content += f"Mer informasjon: {source_url}"
            
            documents.append(Document(
                page_content=content,
                metadata=metadata
            ))
        
        # If no documents were found, add a fallback document
        if not documents:
            documents.append(Document(
                page_content="Beklager, jeg fant ingen relevante datasett for dette spørsmålet i GeoNorge sin database.",
                metadata={"fallback": True}
            ))
            
        return documents, vdb_response

@dataclass
class SerializableState:
    messages: list = None
    chat_history: str = ""
    context: str = ""
    metadata_context: list = None
    websocket_id: str = None
    
    def __post_init__(self):
        if self.messages is None:
            self.messages = []
        if self.metadata_context is None:
            self.metadata_context = []

    def to_dict(self) -> Dict:
        return asdict(self)

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
            current_state = SerializableState(**state)
            messages = current_state.messages
            last_message = messages[-1]["content"] if messages else ""
            
            documents, vdb_response = await self.retriever.get_relevant_documents(last_message)
            
            # Update state while maintaining websocket_id
            current_state.context = "\n\n".join(doc.page_content for doc in documents)
            current_state.metadata_context = vdb_response
            
            return current_state.to_dict()

        async def generate_response(state: Dict) -> Dict:
            """Node that generates the response using the LLM."""
            current_state = SerializableState(**state)
            
            websocket = self.active_websockets.get(current_state.websocket_id)
            if not websocket:
                raise ValueError(f"No active websocket found for ID: {current_state.websocket_id}")

            prompt = ChatPromptTemplate.from_messages([
                ("human", f"""Instructions for this conversation:
            {SYSTEM_PROMPT}
            
            User Question: {{input}}
            
            Previous Conversation:
            {{chat_history}}
            
            Available Context:
            {{context}}""")
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
            
            # Update state
            current_state.messages = messages
            current_state.chat_history = self._format_history(messages)
            
            return current_state.to_dict()

        workflow = StateGraph(Dict)
        workflow.add_node("retriever", retriever)
        workflow.add_node("generate_response", generate_response)
        workflow.add_edge(START, "retriever")
        workflow.add_edge("retriever", "generate_response")
        workflow.add_edge("generate_response", END)
        
        return workflow.compile(checkpointer=self.memory)

    async def chat(self, query: str, session_id: str, websocket) -> str:
        # Store websocket in active connections
        websocket_id = str(id(websocket))
        self.active_websockets[websocket_id] = websocket
        
        try:
            # Initialize or get existing session state
            if session_id not in self.sessions:
                current_state = SerializableState(websocket_id=websocket_id)
            else:
                current_state = SerializableState(**self.sessions[session_id])
                current_state.websocket_id = websocket_id
            
            # Add new message
            current_state.messages.append({"role": "human", "content": query})
            current_state.chat_history = self._format_history(current_state.messages)
            
            # Run chain with dictionary state
            config = {"configurable": {"thread_id": session_id}}
            final_state = await self.chain.ainvoke(current_state.to_dict(), config=config)
            
            # Convert final state back to SerializableState and store
            final_serializable_state = SerializableState(**final_state)
            self.sessions[session_id] = final_serializable_state.to_dict()
            
            if final_serializable_state.messages:
                last_message = final_serializable_state.messages[-1]["content"]
                await insert_image_rag_response(
                    last_message,
                    final_serializable_state.metadata_context,
                    websocket
                )
                return last_message
            
            return "No response generated."
            
        finally:
            # Clean up websocket reference
            self.active_websockets.pop(websocket_id, None)

    def _format_history(self, messages: list) -> str:
        return "\n".join(f'{m["role"]}: {m["content"]}' for m in messages)

    # Remove or comment out the _stream_response method as it's no longer needed
    async def _stream_response(self, response: str, websocket):
        await send_websocket_message("chatStream", {"payload": "", "isNewMessage": True}, websocket)
        for chunk in response.split():
            await send_websocket_message("chatStream", {"payload": chunk + " "}, websocket)

# Image handling functions remain the same
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

# Initialize the chain
rag_chain = GeoNorgeRAGChain()

async def get_rag_response(user_question, memory, rag_context, websocket):
    session_id = str(id(websocket))
    return await rag_chain.chat(user_question, session_id, websocket)

async def get_rag_context(vdb_response):
    return None, None