from typing import List, Dict, Any, Optional, Annotated, Tuple
from dataclasses import dataclass, field
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

# Initialize LLMs
llm = ChatOpenAI(
    model_name="gemini-2.0-flash",
    openai_api_key=CONFIG["api"]["gemini_api_key"],
    openai_api_base=CONFIG["api"]["gemini_base_endpoint"],
    streaming=True,
    temperature=0.3,
)

rewrite_llm = AzureChatOpenAI(
    api_key=CONFIG["api"]["azure_gpt_api_key"],
    api_version="2024-02-15-preview",
    azure_endpoint=CONFIG["api"]["azure_gpt_endpoint"],
    streaming=True,
    temperature=0.3,
)

@dataclass
class ConversationState:
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

class GeoNorgeVectorRetriever:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )

    async def _transform_query(self, query: str) -> str:
        """Transform the query to improve retrieval quality."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", QUERY_REWRITE_PROMPT),
            ("human", query)
        ])
        
        chain = prompt | rewrite_llm | StrOutputParser()
        transformed_query = await chain.ainvoke({"query": query})
        return transformed_query.strip()

    async def get_relevant_documents(self, query: str) -> Tuple[List[Document], Any]:
        """Retrieve relevant documents based on the query."""
        transformed_query = await self._transform_query(query)
        print(f"Transformed Query: {transformed_query}")
        
        if transformed_query.strip() == "INVALID_QUERY":
            return [Document(
                page_content="Beklager, jeg kan bare svare på spørsmål om geografiske data, kart og Geonorges tjenester. Kan du omformulere spørsmålet ditt til å handle om dette?",
                metadata={"invalid_query": True}
            )], []
            
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
                page_content="Beklager, jeg fant ingen relevante datasett for dette spørsmålet i GeoNorge sin database. For å hjelpe deg finne passende datasett, trenger jeg mer spesifikk informasjon. Vennligst spesifiser detaljer som geografisk område, tidsperiode, eller mer spesifikke datatyper du er interessert i.",
                metadata={"fallback": True, "no_results": True}
            ))
            
        return documents, vdb_response

class EnhancedGeoNorgeRAGChain:
    def __init__(self):
        self.memory = MemorySaver()
        self.retriever = GeoNorgeVectorRetriever()
        self.chain = self._build_conversation_workflow()
        self.sessions = {}
        self.active_websockets = {}

    async def _validate_query(self, state: Dict) -> Dict:
        """Validate if the query is about geographic data."""
        current_state = ConversationState(**state)
        query = current_state.messages[-1]["content"]
        
        transformed_query = await self.retriever._transform_query(query)
        current_state.transformed_query = transformed_query
        
        return current_state.to_dict()

    async def _handle_invalid_query(self, state: Dict) -> Dict:
        """Handle non-geographic queries."""
        current_state = ConversationState(**state)
        websocket = self.active_websockets.get(current_state.websocket_id)
        
        response = "Beklager, jeg kan bare svare på spørsmål om geografiske data, kart og GeoNorge tjenester. Kan du omformulere spørsmålet ditt til å handle om dette?"
        await send_websocket_message("chatStream", {"payload": response, "isNewMessage": True}, websocket)
        
        current_state.messages.append({"role": "assistant", "content": response})
        current_state.chat_history = self._format_history(current_state.messages)
        return current_state.to_dict()

    async def _analyze_intent(self, state: Dict) -> Dict:
        """Determine the user's intent from their message."""
        current_state = ConversationState(**state)
        last_message = current_state.messages[-1]["content"]

        print("\n=== Intent Analysis ===")
        print(f"User message: {last_message}")

        prompt = ChatPromptTemplate.from_messages([
            ("system", """Analyser brukerens melding og bestem intensjonen. Mulige intensjoner er:
            - initial_search: Bruker søker etter nye datasett eller informasjon om et nytt tema/begrep/term
            - refine_search: Bruker vil raffinere eller filtrere nåværende søkeresultater
            - dataset_details: Bruker ønsker mer informasjon om spesifikke datasett som allerede er nevnt
            - clarification: Bruker trenger avklaring om noe som ALLEREDE er diskutert i samtalen
            - download_request: Bruker ønsker å laste ned et datasett som allerede er nevnt
            - comparison: Bruker vil sammenligne datasett som allerede er nevnt
            - end_conversation: Bruker ønsker å avslutte samtalen

            VIKTIG:
            - Hvis brukeren spør om mer informasjon, flere detaljer, eller bruker fraser som "fortell mer om dem" eller "kan du fortelle mer om datasettene" uten å spesifisere hvilke datasett, klassifiser dette som dataset_details
            - Generelle oppfølgingsspørsmål som "fortell mer", "gi mer detaljer", "hva med X" skal anses som dataset_details når det er åpenbart at brukeren refererer til datasett som nylig ble nevnt
            - Bruk konteksten fra tidligere samtaler for å bestemme om brukeren refererer til tidligere nevnte datasett selv om de ikke nevner dem spesifikt
            - Hvis brukeren spør om betydningen av en term eller begrep (f.eks. "Hva er X?"), er dette en initial_search
            - Hvis brukeren spør om noe som IKKE har blitt nevnt tidligere, er dette en initial_search
            - Hvis brukeren spør om mer informasjon om noe som ALLEREDE er diskutert i samtalen, er det en clarification
            - Hvis spørsmålet handler om nye data eller temaer som IKKE er nevnt før, er det en initial_search
            - Clarification skal KUN brukes når brukeren spør om noe som allerede er diskutert i samtalen

            Tidligere samtale:
            {chat_history}
            """),
            ("human", "{message}")
        ])

        chain = prompt | llm | StrOutputParser()
        intent = await chain.ainvoke({
            "message": last_message,
            "chat_history": current_state.chat_history
        })
        current_state.current_intent = intent.strip()
        
        print(f"Determined intent: {current_state.current_intent}")
        print("=====================\n")
        
        return current_state.to_dict()

    async def _perform_search(self, state: Dict) -> Dict:
        """Perform vector search for initial or refined search."""
        current_state = ConversationState(**state)
        documents, vdb_response = await self.retriever.get_relevant_documents(
            current_state.messages[-1]["content"]
        )
        current_state.context = "\n\n".join(doc.page_content for doc in documents)
        current_state.metadata_context = vdb_response
        
        # Only populate last_datasets if we have actual results
        if vdb_response:
            current_state.last_datasets = [
                {"uuid": row[0], "title": row[1]} for row in vdb_response
            ]
        else:
            # Clear last_datasets if no results to avoid suggesting irrelevant datasets
            current_state.last_datasets = []
            
        return current_state.to_dict()

    async def _get_dataset_info(self, state: Dict) -> Dict:
        """Get detailed information about specific datasets."""
        current_state = ConversationState(**state)
        
        # Convert metadata_context to a more usable format
        field_names = ['uuid', 'title', 'abstract', 'image', 'metadatacreationdate', 'distance']
        metadata_dict = [dict(zip(field_names, row)) for row in current_state.metadata_context]
        
        # Find matching dataset from our metadata context
        for dataset in current_state.last_datasets:
            if dataset["title"].lower() in current_state.messages[-1]["content"].lower():
                # Find the full metadata for this dataset
                detailed_info = next(
                    (item for item in metadata_dict if item["uuid"] == dataset["uuid"]), 
                    {}
                )
                
                # Add source URL to follow_up_context
                if detailed_info and "uuid" in detailed_info:
                    url_formatted_title = detailed_info.get("title", "").replace(' ', '-')
                    source_url = f"https://kartkatalog.geonorge.no/metadata/{url_formatted_title}/{detailed_info['uuid']}"
                    detailed_info["source_url"] = source_url
                    detailed_info["mer_informasjon"] = f"Mer informasjon: {source_url}"
                
                current_state.follow_up_context = detailed_info
                break
                
        return current_state.to_dict()

    async def _generate_response(self, state: Dict) -> Dict:
        """Generate contextual responses based on intent and state."""
        current_state = ConversationState(**state)
        websocket = self.active_websockets.get(current_state.websocket_id)

        # Check if we're dealing with a no results case
        no_results = False
        if current_state.context and "jeg fant ingen relevante datasett" in current_state.context:
            no_results = True
            response_template = """
            System: Du er en hjelpsom assistent som hjelper brukere å finne geodata og datasett i Geonorge.
            Brukeren har stilt et spørsmål, men det ble ikke funnet noen relevante datasett i databasen.
            IKKE foreslå spesifikke datasett når ingen ble funnet i søket.
            I stedet, forklar høflig at du ikke fant noen eksakte treff, og be om mer spesifikk informasjon.
            
            VIKTIG: Still et kort, konverserende oppfølgingsspørsmål som hjelper brukeren å spesifisere søket sitt.
            For eksempel: "Kan du spesifisere hvilket geografisk område du er interessert i?" eller "Hvilket formål skal dataene brukes til?"
            Unngå å bruke punktlister med spørsmål. Hold oppfølgingsspørsmålet kort og konverserende.
            """
        else:
            response_templates = {
                "initial_search": """
                System: Du er en hjelpsom assistent som hjelper brukere å finne geodata og datasett i Geonorge. 
                Bruk konteksten til å foreslå MAKS 5 relevante datasett.
                Fremhev datasettenes navn med ** for å trigge bildevisning.
                VIKTIG: Ikke foreslå generiske datasett som ikke finnes i konteksten.
                Hvis du ikke finner relevante datasett i konteksten, ikke forsøk å foreslå fiktive datasett.
                I stedet, informer brukeren om at du ikke fant noe som matcher direkte, og be om mer spesifikk informasjon.
                
                VIKTIG: Hvis spørsmålet er vagt eller generelt:
                1. List opp relevante datasett du har funnet (maks 5)
                2. Still ETT eller TO korte, konverserende oppfølgingsspørsmål som hjelper brukeren å spesifisere søket sitt videre.
                   For eksempel: "Kan du spesifisere hvilket geografisk område du er interessert i?" eller "Hvilken type naturområder er du mest interessert i?"
                
                IKKE bruk punktlister for oppfølgingsspørsmål. Hold oppfølgingsdelen kort, konverserende, og integrert i svaret.
                Oppfølgingsspørsmålene skal være relevante for datasettene du nettopp har foreslått.
                """,
                "dataset_details": """
                System: Du er en hjelpsom assistent som hjelper brukere å finne geodata og datasett i Geonorge.
                
                Når du beskriver et datasett:
                1. Hold deg til informasjonen i konteksten, spesielt til den originale beskrivelsen/abstractet.
                2. Presenter informasjonen i en naturlig, sammenhengende tekstform. 
                3. Unngå lange lister med punkter og kategorier.
                4. Inkluder kun de viktigste detaljene som finnes i konteksten.
                5. ALLTID inkluder URL-en til kilden ("Mer informasjon: URL") på slutten av svaret.
                
                Fremhev datasettets navn med ** for å vise bilde og nedlastingslenker.
                
                Formatet bør være:
                - En innledning som forklarer hva datasettet er (basert på originalbeskrivelsen)
                - Et par oppfølgende avsnitt med relevant tilleggsinformasjon (hvis tilgjengelig)
                - Informasjon om når datasettet var sist oppdatert
                - Informasjon om kildene til datasettet
                - Avslutt ALLTID med "Mer informasjon: [URL-en fra konteksten]"
                
                VIKTIG: Informasjon om kilden og URL-en til "Mer informasjon" må ALLTID inkluderes i svaret ditt.
                Dette gir brukeren mulighet til å finne ytterligere detaljer om datasettet.
                
                Hold det enkelt, konkret og basert på konteksten.
                """,
                "clarification": """
                System: Du er en hjelpsom assistent som hjelper brukere å forstå geografiske data og termer.
                
                Når du forklarer et datasett eller en term:
                - Bruk enkelt, naturlig språk i sammenhengende tekst
                - Unngå å bruke punktlister der det ikke er nødvendig
                - Hold forklaringen kort og konsis
                - Gi konkrete eksempler når det er relevant
                - Bruk informasjonen fra konteksten som basis for forklaringen
                
                Målet er å gi brukeren en klar forståelse uten unødvendig teknisk språk eller lange oppramsinger.
                Fremhev datasettets navn med ** hvis relevant.
                """,
                "download_request": """
                System: Du er en hjelpsom assistent som hjelper brukere å laste ned datasett fra Geonorge.
                
                Når du forklarer nedlastingsinformasjon:
                - Presenter informasjonen i naturlig, sammenhengende tekst
                - Beskriv tilgjengelige formater og eventuelle begrensninger i enkle setninger
                - Unngå unødvendige punktlister 
                - Bruk konteksten for å gi nøyaktig informasjon om nedlasting
                
                Fremhev datasettets navn med ** for å vise nedlastingslenker.
                Gi instruksjoner på en klar og konsis måte.
                """,
                "comparison": """
                System: Du er en hjelpsom assistent som hjelper brukere å sammenligne datasett fra Geonorge.
                
                Når du sammenligner datasett:
                - Beskriv likheter og forskjeller i naturlig, sammenhengende tekst
                - Fokuser på de viktigste aspektene som er relevante for brukeren
                - Bruk enkle og forståelige setninger
                - Strukturer sammenligningen logisk, men unngå omfattende punktlister
                
                Bruk ** rundt datasettnavnene for å vise bilder.
                Hold sammenligningen konsis og informativ.
                """
            }

        prompt = ChatPromptTemplate.from_messages([
            ("system", response_template if no_results else response_templates.get(current_state.current_intent, response_templates["initial_search"])),
            ("user", """Spørsmål: {input}                   

            Tidligere samtale:
            {chat_history}

            Kontekst:
            {context}

            Oppfølgingskontekst:
            {follow_up_context}
            """)
        ])

        response_chunks = []
        await send_websocket_message("chatStream", {"payload": "", "isNewMessage": True}, websocket)

        async for chunk in (prompt | llm).astream({
            "input": current_state.messages[-1]["content"],
            "chat_history": current_state.chat_history,
            "context": current_state.context,
            "follow_up_context": str(current_state.follow_up_context)
        }):
            if hasattr(chunk, 'content'):
                response_chunks.append(chunk.content)
                await send_websocket_message("chatStream", {"payload": chunk.content}, websocket)

        full_response = "".join(response_chunks)
        current_state.messages.append({"role": "assistant", "content": full_response})
        current_state.chat_history = self._format_history(current_state.messages)

        return current_state.to_dict()

    def _should_route_to_invalid(self, state: Dict) -> str:
        """Determine if query is invalid and should be routed to invalid handler."""
        return "handle_invalid" if state.get("transformed_query", "").strip() == "INVALID_QUERY" else "analyze_intent"

    def _route_by_intent(self, state: Dict) -> str:
        """Route to appropriate node based on intent."""
        intent = state.get("current_intent", "")
        if intent in ["initial_search", "refine_search"]:
            return "perform_search"
        elif intent == "dataset_details":
            return "get_dataset_info"
        return "generate_response"

    def _build_conversation_workflow(self):
        """Build the enhanced conversation workflow with conditional routing."""
        workflow = StateGraph(Annotated[Dict, "ConversationState"])

        # Add nodes
        workflow.add_node("validate_query", self._validate_query)
        workflow.add_node("handle_invalid", self._handle_invalid_query)
        workflow.add_node("analyze_intent", self._analyze_intent)
        workflow.add_node("perform_search", self._perform_search)
        workflow.add_node("get_dataset_info", self._get_dataset_info)
        workflow.add_node("generate_response", self._generate_response)

        # Define the flow with conditional edges
        workflow.add_edge(START, "validate_query")
        
        # Route based on query validity
        workflow.add_conditional_edges(
            "validate_query",
            self._should_route_to_invalid,
            {
                "handle_invalid": "handle_invalid",
                "analyze_intent": "analyze_intent"
            }
        )

        # Route from invalid handler to end
        workflow.add_edge("handle_invalid", END)

        # Route based on intent
        workflow.add_conditional_edges(
            "analyze_intent",
            self._route_by_intent,
            {
                "perform_search": "perform_search",
                "get_dataset_info": "get_dataset_info",
                "generate_response": "generate_response"
            }
        )

        # Connect all processing nodes to response generation
        workflow.add_edge("perform_search", "generate_response")
        workflow.add_edge("get_dataset_info", "generate_response")
        workflow.add_edge("generate_response", END)

        return workflow.compile(checkpointer=self.memory)

    def _format_history(self, messages: list) -> str:
        return "\n".join(f'{m["role"]}: {m["content"]}' for m in messages)

    async def chat(self, query: str, session_id: str, websocket) -> str:
        """Enhanced chat method with improved conversation management."""
        websocket_id = str(id(websocket))
        self.active_websockets[websocket_id] = websocket
        
        try:
            if session_id not in self.sessions:
                current_state = ConversationState(websocket_id=websocket_id)
            else:
                state_dict = self.sessions[session_id]
                state_dict['websocket_id'] = websocket_id
                current_state = ConversationState(**state_dict)
            
            current_state.messages.append({"role": "human", "content": query})
            current_state.chat_history = self._format_history(current_state.messages)
            
            config = {"configurable": {"thread_id": session_id}}
            final_state = await self.chain.ainvoke(current_state.to_dict(), config=config)
            
            self.sessions[session_id] = final_state
            
            if final_state.get('messages'):
                last_message = final_state['messages'][-1]['content']
                await insert_image_rag_response(
                    last_message,
                    final_state.get('metadata_context', []),
                    websocket
                )
                return last_message
            
            return "Ingen respons generert."
            
        finally:
            self.active_websockets.pop(websocket_id, None)


async def check_image_signal(gpt_response, metadata_context_list):
    """Check for image signals in the response and prepare image data."""
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
    """Insert image data into the RAG response."""
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

# Initialize the enhanced RAG chain
enhanced_rag_chain = EnhancedGeoNorgeRAGChain()

async def get_rag_response(
    user_question: str,
    datasets_with_status: Optional[List[Dict[str, Any]]] = None,
    vdb_response: Optional[Any] = None,
    websocket: Optional[Any] = None
) -> str:
    """Main entry point for the enhanced RAG chatbot."""
    session_id = str(id(websocket))
    return await enhanced_rag_chain.chat(user_question, session_id, websocket)

async def get_rag_context(vdb_response):
    """Get enhanced context from vector database response."""
    # This function can be implemented if you need specific context processing
    return None, None