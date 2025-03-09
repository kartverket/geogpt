# from typing import List, Dict, Any, Optional, Annotated, Tuple
# from config import CONFIG
# from helpers.websocket import send_websocket_message
# from helpers.download import dataset_has_download, get_download_url, get_standard_or_first_format
# from helpers.fetch_valid_download_api_data import get_wms
# from langchain.prompts import ChatPromptTemplate
# from langchain.schema import StrOutputParser
# from langchain_core.documents import Document
# from langgraph.checkpoint.memory import MemorySaver
# from langgraph.graph import START, END, StateGraph
# from llm import LLMManager
# from conversation import ConversationState
# from retrieval import GeoNorgeVectorRetriever

# # Initialize LLM manager
# llm_manager = LLMManager()

# # Get LLM instances for use throughout the code
# llm = llm_manager.get_main_llm()
# rewrite_llm = llm_manager.get_rewrite_llm()

# class EnhancedGeoNorgeRAGChain:
#     def __init__(self):
#         self.memory = MemorySaver()
#         self.retriever = GeoNorgeVectorRetriever()
#         self.chain = self._build_conversation_workflow()
#         self.sessions = {}
#         self.active_websockets = {}

#     async def _validate_query(self, state: Dict) -> Dict:
#         """Validate if the query is about geographic data."""
#         current_state = ConversationState(**state)
#         query = current_state.messages[-1]["content"]
        
#         transformed_query = await self.retriever._transform_query(query)
#         current_state.transformed_query = transformed_query
        
#         return current_state.to_dict()

#     async def _handle_invalid_query(self, state: Dict) -> Dict:
#         """Handle non-geographic queries."""
#         current_state = ConversationState(**state)
#         websocket = self.active_websockets.get(current_state.websocket_id)
        
#         response = "Beklager, jeg kan bare svare på spørsmål om geografiske data, kart og Geonorge tjenester. Kan du omformulere spørsmålet ditt til å handle om dette?"
#         await send_websocket_message("chatStream", {"payload": response, "isNewMessage": True}, websocket)
        
#         current_state.messages.append({"role": "assistant", "content": response})
#         current_state.chat_history = self._format_history(current_state.messages)
#         return current_state.to_dict()

#     async def _analyze_intent(self, state: Dict) -> Dict:
#         """Determine the user's intent from their message."""
#         current_state = ConversationState(**state)
#         last_message = current_state.messages[-1]["content"]

#         print("\n=== Intent Analysis ===")
#         print(f"User message: {last_message}")

#         prompt = ChatPromptTemplate.from_messages([
#             ("system", """Analyser brukerens melding og bestem intensjonen. Mulige intensjoner er:
#             - initial_search: Bruker søker etter nye datasett eller informasjon om et nytt tema/begrep/term
#             - refine_search: Bruker vil raffinere eller filtrere nåværende søkeresultater
#             - dataset_details: Bruker ønsker mer informasjon om spesifikke datasett som allerede er nevnt
#             - clarification: Bruker trenger avklaring om noe som ALLEREDE er diskutert i samtalen
#             - download_request: Bruker ønsker å laste ned et datasett som allerede er nevnt
#             - comparison: Bruker vil sammenligne datasett som allerede er nevnt
#             - end_conversation: Bruker ønsker å avslutte samtalen

#             VIKTIG:
#             - Hvis brukeren spør om mer informasjon, flere detaljer, eller bruker fraser som "fortell mer om dem" eller "kan du fortelle mer om datasettene" uten å spesifisere hvilke datasett, klassifiser dette som dataset_details
#             - Generelle oppfølgingsspørsmål som "fortell mer", "gi mer detaljer", "hva med X" skal anses som dataset_details når det er åpenbart at brukeren refererer til datasett som nylig ble nevnt
#             - Bruk konteksten fra tidligere samtaler for å bestemme om brukeren refererer til tidligere nevnte datasett selv om de ikke nevner dem spesifikt
#             - Hvis brukeren spør om betydningen av en term eller begrep (f.eks. "Hva er X?"), er dette en initial_search
#             - Hvis brukeren spør om noe som IKKE har blitt nevnt tidligere, er dette en initial_search
#             - Hvis brukeren spør om mer informasjon om noe som ALLEREDE er diskutert i samtalen, er det en clarification
#             - Hvis spørsmålet handler om nye data eller temaer som IKKE er nevnt før, er det en initial_search
#             - Clarification skal KUN brukes når brukeren spør om noe som allerede er diskutert i samtalen

#             Tidligere samtale:
#             {chat_history}
#             """),
#             ("human", "{message}")
#         ])

#         chain = prompt | llm | StrOutputParser()
#         intent = await chain.ainvoke({
#             "message": last_message,
#             "chat_history": current_state.chat_history
#         })
#         current_state.current_intent = intent.strip()
        
#         print(f"Determined intent: {current_state.current_intent}")
#         print("=====================\n")
        
#         return current_state.to_dict()

#     async def _perform_search(self, state: Dict) -> Dict:
#         """Perform vector search for initial or refined search."""
#         current_state = ConversationState(**state)
#         documents, vdb_response = await self.retriever.get_relevant_documents(
#             current_state.messages[-1]["content"]
#         )
        
#         # Debug print to see raw VDB response
#         print(f"Raw VDB response for query: {current_state.messages[-1]['content']}")
        
#         # Print dataset titles in a more readable format
#         if vdb_response:
#             print("\nDataset Titles:")
#             for idx, row in enumerate(vdb_response):
#                 print(f"{idx+1}. UUID: {row[0]}, Title: {row[1]}")
#         else:
#             print("No datasets found")
#         print("=====================\n")
        
#         current_state.context = "\n\n".join(doc.page_content for doc in documents)
#         current_state.metadata_context = vdb_response
        
#         # Only populate last_datasets if we have actual results
#         if vdb_response:
#             current_state.last_datasets = [
#                 {"uuid": row[0], "title": row[1]} for row in vdb_response
#             ]
            
#             # Initialize a context section specifically for multiple datasets listing
#             dataset_names = [row[1] for row in vdb_response]
#             datasets_list = "\n".join([f"- {name}" for name in dataset_names])
            
#             # Add a clear section to the context that lists all found datasets
#             datasets_section = f"""
#             Relevante datasett funnet for denne forespørselen:
#             {datasets_list}
            
#             Vennligst referer til disse datasettene ved navn i svaret ditt.
#             """
            
#             # Append this section to the context
#             current_state.context = current_state.context + "\n\n" + datasets_section
#             print(f"Added datasets section to context: {datasets_section}")
#         else:
#             # Clear last_datasets if no results to avoid suggesting irrelevant datasets
#             current_state.last_datasets = []
            
#         return current_state.to_dict()

#     async def _grade_documents(self, state: Dict) -> Dict:
#         """Grade the relevance of retrieved documents using an LLM."""
#         current_state = ConversationState(**state)
#         user_query = current_state.messages[-1]["content"]
        
#         print("\n=== LLM DOCUMENT GRADING PROCESS ===")
#         print(f"Original user query: {user_query}")
        
#         # Skip grading if there are no documents or if an invalid query was detected
#         if not current_state.metadata_context or (
#             len(current_state.metadata_context) == 1 and 
#             isinstance(current_state.metadata_context[0], Document) and
#             current_state.metadata_context[0].metadata.get("invalid_query", False)
#         ):
#             print("No documents to grade or invalid query detected")
#             return current_state.to_dict()
        
#         graded_metadata = []
#         print(f"Number of documents to grade: {len(current_state.metadata_context)}")
        
#         # Create a batch relevance evaluation prompt
#         documents_to_evaluate = []
#         for i, row in enumerate(current_state.metadata_context):
#             title = row[1]
#             description = row[2] if len(row) > 2 and row[2] else ""
#             documents_to_evaluate.append({
#                 "id": i,
#                 "title": title,
#                 "description": description,
#                 "row": row
#             })
        
#         # Create dataset evaluation data
#         datasets_text = ""
#         for doc in documents_to_evaluate:
#             datasets_text += f"\nID: {doc['id']}\nTittel: {doc['title']}\nBeskrivelse: {doc['description']}\n"
            
#         prompt = ChatPromptTemplate.from_template(f"""
#         Du er en AI-assistent som hjelper til med å vurdere relevans av datasett basert på brukerens spørsmål.
        
#         Brukerens spørsmål: {{query}}
        
#         Nedenfor er en liste med datasett. Vurder hvert datasett og angi om det er relevant for brukerens spørsmål.
#         For hvert datasett, gi en score fra 0-100 hvor 100 er høyest relevans.
#         Datasett med 'dam', 'dammer', eller lignende vannrelaterte begreper bør få høy score når brukeren spør om dam-relatert informasjon.
        
#         Returner resultatet i JSON-format
        
#         Bruk 'true' (ikke 'True') og 'false' (ikke 'False') for boolske verdier i JSON.
        
#         Datasett å vurdere:
#         {datasets_text}
#         """)
        
#         try:
#             print("Calling LLM for document relevance evaluation...")
#             # Use the query parameter which matches the template above
#             evaluation_result = await (prompt | llm | StrOutputParser()).ainvoke({
#                 "query": user_query
#             })
#             print(f"LLM evaluation result:\n{evaluation_result}")
            
#             # Parse the JSON response
#             import json
#             import re
#             try:
#                 # Try to extract JSON if it's wrapped in text or code blocks
#                 json_match = re.search(r'```json\s*([\s\S]*?)\s*```', evaluation_result, re.DOTALL)
#                 if json_match:
#                     json_str = json_match.group(1)
#                     print(f"Extracted JSON string: {json_str}")
#                     result_json = json.loads(json_str)
#                 else:
#                     # If not in code blocks, try to parse the raw response
#                     result_json = json.loads(evaluation_result)
                
#                 # Handle different JSON structures that might be returned
#                 evaluations = []
#                 if isinstance(result_json, list):
#                     # The response is already a list of evaluations
#                     evaluations = result_json
#                 elif isinstance(result_json, dict):
#                     # The response is a dictionary with an evaluations field
#                     evaluations = result_json.get("evaluations", [])
                
#                 # Process evaluations and keep relevant documents
#                 for eval_item in evaluations:
#                     # Support both "id" and "dataset_id" fields
#                     doc_id = eval_item.get("id") if eval_item.get("id") is not None else eval_item.get("dataset_id")
                    
#                     # Handle boolean value that might be a string or directly in relevance field
#                     # Also handle Norwegian field names (relevant)
#                     is_relevant_val = eval_item.get("is_relevant", 
#                                       eval_item.get("relevance", 
#                                       eval_item.get("relevant", False)))
#                     if isinstance(is_relevant_val, str):
#                         is_relevant = is_relevant_val.lower() == "true"
#                     else:
#                         is_relevant = bool(is_relevant_val)
                    
#                     # Support both English and Norwegian field names for scores
#                     relevance_score = eval_item.get("relevance_score", 
#                                       eval_item.get("score", 
#                                       eval_item.get("relevans", 0)))
                    
#                     # Support both English and Norwegian field names for explanations
#                     explanation = eval_item.get("explanation", 
#                                   eval_item.get("reason", 
#                                   eval_item.get("begrunnelse", "")))
                    
#                     if doc_id is not None and doc_id < len(documents_to_evaluate):
#                         doc = documents_to_evaluate[doc_id]
#                         print(f"\nDocument {doc_id}: {doc['title']}")
#                         print(f"Is relevant: {is_relevant}")
#                         print(f"Relevance score: {relevance_score}")
#                         print(f"Explanation: {explanation}")
                        
#                         # Keep documents with relevance score >= 50 or that are marked as relevant
#                         if is_relevant or relevance_score >= 50:
#                             graded_metadata.append(doc["row"])
#                             print(f"KEEPING document: {doc['title']}")
#                         else:
#                             print(f"FILTERING OUT document: {doc['title']}")
                
#             except json.JSONDecodeError as e:
#                 print(f"Error parsing LLM response as JSON: {e}")
#                 # Fall back to keeping all documents
#                 print("Falling back to keeping all documents")
#                 graded_metadata = [doc["row"] for doc in documents_to_evaluate]
        
#         except Exception as e:
#             print(f"Error during LLM grading: {e}")
#             # Fall back to keeping all documents
#             print("Falling back to keeping all documents due to error")
#             graded_metadata = [doc["row"] for doc in documents_to_evaluate]
        
#         # If we filtered out all documents, select the highest scoring ones
#         if not graded_metadata and current_state.metadata_context:
#             try:
#                 # Try to pick the highest scoring documents based on the LLM evaluation
#                 if 'result_json' in locals() and isinstance(result_json, list):
#                     # Sort documents by score in descending order
#                     sorted_docs = sorted(result_json, key=lambda x: x.get('Score', 0), reverse=True)
                    
#                     # Keep documents with score >= 70, or at least the top 5
#                     high_scoring_docs = [
#                         documents_to_evaluate[doc.get('ID', 0)]['row'] 
#                         for doc in sorted_docs 
#                         if doc.get('Score', 0) >= 70 and doc.get('Relevans', False)
#                     ]
                    
#                     if high_scoring_docs:
#                         print(f"Keeping {len(high_scoring_docs)} high-scoring documents (score >= 70)")
#                         graded_metadata = high_scoring_docs
#                     else:
#                         # If no documents with score >= 70, take top 5 or fewer
#                         top_count = min(5, len(sorted_docs))
#                         print(f"No documents with score >= 70, keeping top {top_count} by score")
#                         graded_metadata = [
#                             documents_to_evaluate[doc.get('ID', 0)]['row'] 
#                             for doc in sorted_docs[:top_count] 
#                             if doc.get('Relevans', False)
#                         ]
#                 else:
#                     # If we can't get the scores, fallback to top 3 from vector search
#                     top_count = min(3, len(current_state.metadata_context))
#                     print(f"Couldn't get scores, keeping top {top_count} documents from vector search")
#                     graded_metadata = current_state.metadata_context[:top_count]
#             except Exception as e:
#                 print(f"Error selecting high-scoring documents: {e}")
#                 # Fall back to top 3 from vector search if anything goes wrong
#                 top_count = min(3, len(current_state.metadata_context))
#                 print(f"Falling back to keeping top {top_count} documents from vector search")
#                 graded_metadata = current_state.metadata_context[:top_count]
        
#         print(f"\nAfter grading, kept {len(graded_metadata)} out of {len(current_state.metadata_context)} documents")
#         print("Kept documents:")
#         for idx, row in enumerate(graded_metadata):
#             print(f"{idx+1}. {row[1]}")
#         print("=== END LLM DOCUMENT GRADING ===\n")
        
#         # Update the state with graded documents
#         current_state.metadata_context = graded_metadata
        
#         # Re-generate the context with only the graded documents
#         if graded_metadata:
#             # Rebuild context from graded metadata
#             context_parts = []
#             for row in graded_metadata:
#                 title = row[1]
#                 description = row[2] if len(row) > 2 and row[2] else ""
#                 context_parts.append(f"{title} - {description}")
            
#             current_state.context = "\n\n".join(context_parts)
            
#             # Update last_datasets
#             current_state.last_datasets = [
#                 {"uuid": row[0], "title": row[1]} for row in graded_metadata
#             ]
#         else:
#             current_state.context = "Beklager, jeg fant ingen relevante datasett for dette spørsmålet i Geonorge sin database."
#             current_state.last_datasets = []
            
#         return current_state.to_dict()

#     async def _get_dataset_info(self, state: Dict) -> Dict:
#         """Get detailed information about specific datasets."""
#         current_state = ConversationState(**state)
        
#         # Debug: Print the last_datasets contents
#         print(f"DEBUG - last_datasets: {current_state.last_datasets}")
        
#         # Convert metadata_context to a more usable format
#         field_names = ['uuid', 'title', 'abstract', 'image', 'metadatacreationdate', 'distance']
#         metadata_dict = [dict(zip(field_names, row)) for row in current_state.metadata_context]
        
#         # Debug: Print metadata dictionary
#         print(f"DEBUG - metadata_dict sample (first 2 items): {metadata_dict[:2] if len(metadata_dict) >= 2 else metadata_dict}")
        
#         # If last_datasets is empty but we have a user message that might contain a dataset name
#         if not current_state.last_datasets and current_state.messages and "content" in current_state.messages[-1]:
#             user_message = current_state.messages[-1]["content"].lower()
#             print(f"DEBUG - Attempting to find dataset directly from user message: {user_message}")
            
#             try:
#                 # Direct search using the vector database
#                 from helpers.vector_database import get_vdb_response
                
#                 # Get the direct dataset matches from the vector database
#                 vdb_response = await get_vdb_response(user_message)
#                 print(f"DEBUG - Direct search vdb_response count: {len(vdb_response) if vdb_response else 0}")
                
#                 if vdb_response and len(vdb_response) > 0:
#                     # Process all found datasets instead of just the first one
#                     all_detailed_info = []
                    
#                     for result in vdb_response:
#                         # Create a detailed_info dict from each result
#                         detailed_info = {
#                             "uuid": result[0],
#                             "title": result[1],
#                             "abstract": result[2] if len(result) > 2 else "",
#                             "image": result[3] if len(result) > 3 else None,
#                             "metadatacreationdate": result[4] if len(result) > 4 else None
#                         }
                        
#                         print(f"DEBUG - Found dataset: {detailed_info['title']}")
                        
#                         # Add source URL
#                         url_formatted_title = detailed_info["title"].replace(' ', '-')
#                         source_url = f"https://kartkatalog.geonorge.no/metadata/{url_formatted_title}/{detailed_info['uuid']}"
#                         print(f"DEBUG - Direct search generated source_url: {source_url}")
                        
#                         detailed_info["source_url"] = source_url
#                         detailed_info["mer_informasjon"] = f"Mer informasjon: {source_url}"
                        
#                         all_detailed_info.append(detailed_info)
                    
#                     # Also update metadata_context for future use
#                     current_state.metadata_context = vdb_response
#                     metadata_dict = [dict(zip(field_names, row)) for row in vdb_response]
                    
#                     # Update last_datasets to include all found datasets
#                     current_state.last_datasets = [
#                         {"uuid": info["uuid"], "title": info["title"]} 
#                         for info in all_detailed_info
#                     ]
                    
#                     # Update the follow_up_context with all found datasets
#                     if len(all_detailed_info) == 1:
#                         current_state.follow_up_context = all_detailed_info[0]
#                     else:
#                         current_state.follow_up_context = {
#                             "datasets": all_detailed_info,
#                             "multiple_datasets": True,
#                             "count": len(all_detailed_info)
#                         }
#             except Exception as e:
#                 print(f"DEBUG - Error during direct dataset search: {str(e)}")
        
#         # Process for when last_datasets has entries and the dataset name is mentioned in the message
#         if not current_state.follow_up_context and current_state.messages and "content" in current_state.messages[-1]:
#             for dataset in current_state.last_datasets:
#                 print(f"DEBUG - Checking dataset: {dataset['title']}")
#                 if dataset["title"].lower() in current_state.messages[-1]["content"].lower():
#                     print(f"DEBUG - Found matching dataset in message: {dataset['title']}")
#                     # Find the full metadata for this dataset
#                     detailed_info = next(
#                         (item for item in metadata_dict if item["uuid"] == dataset["uuid"]), 
#                         {}
#                     )
                    
#                     print(f"DEBUG - detailed_info found: {detailed_info}")
                    
#                     # Add source URL to follow_up_context
#                     if detailed_info and "uuid" in detailed_info:
#                         url_formatted_title = detailed_info.get("title", "").replace(' ', '-')
#                         print(f"DEBUG - url_formatted_title: {url_formatted_title}")
#                         print(f"DEBUG - uuid: {detailed_info['uuid']}")
                        
#                         source_url = f"https://kartkatalog.geonorge.no/metadata/{url_formatted_title}/{detailed_info['uuid']}"
#                         print(f"DEBUG - generated source_url: {source_url}")
                        
#                         detailed_info["source_url"] = source_url
#                         detailed_info["mer_informasjon"] = f"Mer informasjon: {source_url}"
                    
#                     current_state.follow_up_context = detailed_info
#                     break
        
#         # Fallback case: When there are items in last_datasets and metadata_context but no explicit mention in message
#         # or if we still haven't set follow_up_context
#         if not current_state.follow_up_context and current_state.last_datasets and metadata_dict:
#             print(f"DEBUG - Using fallback case for datasets without explicit mention")
#             print(f"DEBUG - Processing all {len(current_state.last_datasets)} datasets")
            
#             all_datasets_info = []
            
#             # Process all datasets in last_datasets
#             for dataset in current_state.last_datasets:
#                 print(f"DEBUG - Processing dataset: {dataset['title']}")
                
#                 # Find the full metadata for this dataset
#                 detailed_info = next(
#                     (item for item in metadata_dict if item["uuid"] == dataset["uuid"]), 
#                     {}
#                 )
                
#                 print(f"DEBUG - detailed_info found from fallback: {detailed_info}")
                
#                 # Add source URL to detailed_info
#                 if detailed_info and "uuid" in detailed_info:
#                     url_formatted_title = detailed_info.get("title", "").replace(' ', '-')
#                     print(f"DEBUG - url_formatted_title: {url_formatted_title}")
#                     print(f"DEBUG - uuid: {detailed_info['uuid']}")
                    
#                     source_url = f"https://kartkatalog.geonorge.no/metadata/{url_formatted_title}/{detailed_info['uuid']}"
#                     print(f"DEBUG - generated source_url from fallback: {source_url}")
                    
#                     detailed_info["source_url"] = source_url
#                     detailed_info["mer_informasjon"] = f"Mer informasjon: {source_url}"
                    
#                     all_datasets_info.append(detailed_info)
            
#             # If we found any datasets with complete info, use them
#             if all_datasets_info:
#                 # Store all dataset information in follow_up_context
#                 # If there's only one dataset, store it directly (for backward compatibility)
#                 if len(all_datasets_info) == 1:
#                     current_state.follow_up_context = all_datasets_info[0]
#                 else:
#                     # Store multiple datasets as a list
#                     current_state.follow_up_context = {
#                         "datasets": all_datasets_info,
#                         "multiple_datasets": True,
#                         "count": len(all_datasets_info)
#                     }
        
#         # Debug: Print final follow_up_context
#         print(f"DEBUG - final follow_up_context: {current_state.follow_up_context}")
                
#         return current_state.to_dict()

#     async def _generate_response(self, state: Dict) -> Dict:
#         """Generate contextual responses based on intent and state."""
#         current_state = ConversationState(**state)
#         websocket = self.active_websockets.get(current_state.websocket_id)

#         # Define response templates first for all cases
#         response_templates = {
#             "initial_search": """
#             System: Du er en hjelpsom assistent som hjelper brukere å finne geodata og datasett i Geonorge. 
#             Du kan også svare på spørsmål om GeoGPT og systemrelaterte spørsmål.
            
#             For datasettrelaterte spørsmål:
#             - Bruk konteksten til å foreslå relevante datasett
#             - Nevn ALLTID alle datasettene som eksplisitt er listet under 'Relevante datasett funnet for denne forespørselen'
#             - For hvert datasett i listen, inkluder navnet med **datasettets navn** format
#             - VIKTIG: Ikke utelat noen av de spesifikt listede datasettene, spesielt de som er oppført som 'Kulturminner' og andre direkte relevante datasett
#             - Ikke foreslå generiske datasett som ikke finnes i konteksten
#             - Hvis du ikke finner relevante datasett, ikke forsøk å foreslå fiktive datasett
            
#             For GeoGPT-relaterte spørsmål:
#             - Svar direkte og informativt om GeoGPT og systemets funksjonalitet
#             - Forklar hvordan GeoGPT kan hjelpe med å finne og forstå geografiske data
#             - Beskriv tilgjengelige funksjoner og hvordan de kan brukes
            
#             VIKTIG: 
#             - Hvis konteksten inneholder en liste med 'Relevante datasett funnet for denne forespørselen', 
#               FREMHEV ALLE disse datasettene med **navn** format i svaret ditt.
#             - Du SKAL ALLTID svare på norsk, aldri på andre språk som bulgarsk eller engelsk.
#             - Still ETT eller TO korte, konverserende oppfølgingsspørsmål som hjelper brukeren videre
            
#             IKKE bruk punktlister for oppfølgingsspørsmål. Hold oppfølgingsdelen kort, konverserende, og integrert i svaret.
#             Oppfølgingsspørsmålene skal være relevante for datasettene du nettopp har foreslått.
#             """,
#             "dataset_details": """
#             System: Du er en hjelpsom assistent som hjelper brukere å finne geodata og datasett i Geonorge.
            
#             Når du beskriver et datasett:
#             1. Hold deg til informasjonen i konteksten, spesielt til den originale beskrivelsen/abstractet.
#             2. Presenter informasjonen i en naturlig, sammenhengende tekstform. 
#             3. Unngå lange lister med punkter og kategorier.
#             4. Inkluder kun de viktigste detaljene som finnes i konteksten.
#             5. ALLTID inkluder URL-en til kilden ("Mer informasjon: URL") på slutten av svaret.
            
#             Fremhev datasettets navn med ** for å vise bilde og nedlastingslenker.
            
#             Formatet bør være:
#             - En innledning som forklarer hva datasettet er (basert på originalbeskrivelsen)
#             - Et par oppfølgende avsnitt med relevant tilleggsinformasjon (hvis tilgjengelig)
#             - Informasjon om når datasettet var sist oppdatert
#             - Informasjon om kildene til datasettet
#             - Avslutt ALLTID med "Mer informasjon: [URL-en fra konteksten]"
            
#             VIKTIG: Informasjon om kilden og URL-en til "Mer informasjon" må ALLTID inkluderes i svaret ditt.
#             Dette gir brukeren mulighet til å finne ytterligere detaljer om datasettet.
            
#             Hold det enkelt, konkret og basert på konteksten.
#             """,
#             "clarification": """
#             System: Du er en hjelpsom assistent som hjelper brukere å forstå geografiske data og termer.
            
#             Når du forklarer et datasett eller en term:
#             - Bruk enkelt, naturlig språk i sammenhengende tekst
#             - Unngå å bruke punktlister der det ikke er nødvendig
#             - Hold forklaringen kort og konsis
#             - Gi konkrete eksempler når det er relevant
#             - Bruk informasjonen fra konteksten som basis for forklaringen
            
#             Målet er å gi brukeren en klar forståelse uten unødvendig teknisk språk eller lange oppramsinger.
#             Fremhev datasettets navn med ** hvis relevant.
#             """,
#             "download_request": """
#             System: Du er en hjelpsom assistent som hjelper brukere å laste ned datasett fra Geonorge.
            
#             Når du forklarer nedlastingsinformasjon:
#             - Presenter informasjonen i naturlig, sammenhengende tekst
#             - Beskriv tilgjengelige formater og eventuelle begrensninger i enkle setninger
#             - Unngå unødvendige punktlister 
#             - Bruk konteksten for å gi nøyaktig informasjon om nedlasting
            
#             Fremhev datasettets navn med ** for å vise nedlastingslenker.
#             Gi instruksjoner på en klar og konsis måte.
#             """,
#             "comparison": """
#             System: Du er en hjelpsom assistent som hjelper brukere å sammenligne datasett fra Geonorge.
            
#             Når du sammenligner datasett:
#             - Beskriv likheter og forskjeller i naturlig, sammenhengende tekst
#             - Fokuser på de viktigste aspektene som er relevante for brukeren
#             - Bruk enkle og forståelige setninger
#             - Strukturer sammenligningen logisk, men unngå omfattende punktlister
            
#             Bruk ** rundt datasettnavnene for å vise bilder.
#             Hold sammenligningen konsis og informativ.
#             """
#         }

#         # Check if we're dealing with a no results case
#         no_results = False
#         if current_state.context and "jeg fant ingen relevante datasett" in current_state.context:
#             no_results = True
#             response_template = """
#             System: Du er en hjelpsom assistent som hjelper brukere å finne geodata og datasett i Geonorge.
#             Brukeren har stilt et spørsmål, men det ble ikke funnet noen relevante datasett i databasen.
#             IKKE foreslå spesifikke datasett når ingen ble funnet i søket.
#             I stedet, forklar høflig at du ikke fant noen eksakte treff, og be om mer spesifikk informasjon.
            
#             VIKTIG: 
#             - Still et kort, konverserende oppfølgingsspørsmål som hjelper brukeren å spesifisere søket sitt.
#             - For eksempel: "Kan du spesifisere hvilket geografisk område du er interessert i?" eller "Hvilket formål skal dataene brukes til?"
#             - Unngå å bruke punktlister med spørsmål. Hold oppfølgingsspørsmålet kort og konverserende.
#             - Du SKAL ALLTID svare på norsk, aldri på andre språk som bulgarsk eller engelsk.
#             """

#         # Add language check to all templates
#         for key in response_templates:
#             if "Du SKAL ALLTID svare på norsk" not in response_templates[key]:
#                 response_templates[key] += "\n\nVIKTIG: Du SKAL ALLTID svare på norsk, aldri på andre språk som bulgarsk eller engelsk."

#         prompt = ChatPromptTemplate.from_messages([
#             ("system", response_template if no_results else response_templates.get(current_state.current_intent, response_templates["initial_search"])),
#             ("user", """Spørsmål: {input}                   

#             Tidligere samtale:
#             {chat_history}

#             Kontekst:
#             {context}

#             Oppfølgingskontekst:
#             {follow_up_context}
#             """)
#         ])

#         response_chunks = []
#         await send_websocket_message("chatStream", {"payload": "", "isNewMessage": True}, websocket)

#         async for chunk in (prompt | llm).astream({
#             "input": current_state.messages[-1]["content"],
#             "chat_history": current_state.chat_history,
#             "context": current_state.context,
#             "follow_up_context": str(current_state.follow_up_context)
#         }):
#             if hasattr(chunk, 'content'):
#                 response_chunks.append(chunk.content)
#                 await send_websocket_message("chatStream", {"payload": chunk.content}, websocket)

#         full_response = "".join(response_chunks)
#         current_state.messages.append({"role": "assistant", "content": full_response})
#         current_state.chat_history = self._format_history(current_state.messages)

#         return current_state.to_dict()

#     def _should_route_to_invalid(self, state: Dict) -> str:
#         """Determine if query is invalid and should be routed to invalid handler."""
#         return "handle_invalid" if state.get("transformed_query", "").strip() == "INVALID_QUERY" else "analyze_intent"

#     def _route_by_intent(self, state: Dict) -> str:
#         """Route to appropriate node based on intent."""
#         intent = state.get("current_intent", "")
#         if intent in ["initial_search", "refine_search"]:
#             return "perform_search"
#         elif intent == "dataset_details":
#             return "get_dataset_info"
#         return "generate_response"

#     def _build_conversation_workflow(self):
#         """Build the enhanced conversation workflow with conditional routing."""
#         workflow = StateGraph(Annotated[Dict, "ConversationState"])

#         # Add nodes
#         workflow.add_node("validate_query", self._validate_query)
#         workflow.add_node("handle_invalid", self._handle_invalid_query)
#         workflow.add_node("analyze_intent", self._analyze_intent)
#         workflow.add_node("perform_search", self._perform_search)
#         workflow.add_node("grade_documents", self._grade_documents)
#         workflow.add_node("get_dataset_info", self._get_dataset_info)
#         workflow.add_node("generate_response", self._generate_response)

#         # Define the flow with conditional edges
#         workflow.add_edge(START, "validate_query")
        
#         # Route based on query validity
#         workflow.add_conditional_edges(
#             "validate_query",
#             self._should_route_to_invalid,
#             {
#                 "handle_invalid": "handle_invalid",
#                 "analyze_intent": "analyze_intent"
#             }
#         )

#         # Route from invalid handler to end
#         workflow.add_edge("handle_invalid", END)

#         # Route based on intent
#         workflow.add_conditional_edges(
#             "analyze_intent",
#             self._route_by_intent,
#             {
#                 "perform_search": "perform_search",
#                 "get_dataset_info": "get_dataset_info",
#                 "generate_response": "generate_response"
#             }
#         )

#         # Connect search to document grading
#         workflow.add_edge("perform_search", "grade_documents")
        
#         # Connect graded documents to response generation
#         workflow.add_edge("grade_documents", "generate_response")
        
#         workflow.add_edge("get_dataset_info", "generate_response")
#         workflow.add_edge("generate_response", END)

#         return workflow.compile(checkpointer=self.memory)

#     def _format_history(self, messages: list) -> str:
#         return "\n".join(f'{m["role"]}: {m["content"]}' for m in messages)

#     async def chat(self, query: str, session_id: str, websocket) -> str:
#         """Enhanced chat method with improved conversation management."""
#         websocket_id = str(id(websocket))
#         self.active_websockets[websocket_id] = websocket
        
#         try:
#             if session_id not in self.sessions:
#                 current_state = ConversationState(websocket_id=websocket_id)
#             else:
#                 state_dict = self.sessions[session_id]
#                 state_dict['websocket_id'] = websocket_id
#                 current_state = ConversationState(**state_dict)
            
#             current_state.messages.append({"role": "human", "content": query})
#             current_state.chat_history = self._format_history(current_state.messages)
            
#             config = {"configurable": {"thread_id": session_id}}
#             final_state = await self.chain.ainvoke(current_state.to_dict(), config=config)
            
#             self.sessions[session_id] = final_state
            
#             if final_state.get('messages'):
#                 last_message = final_state['messages'][-1]['content']
#                 await insert_image_rag_response(
#                     last_message,
#                     final_state.get('metadata_context', []),
#                     websocket
#                 )
#                 return last_message
            
#             return "Ingen respons generert."
            
#         finally:
#             self.active_websockets.pop(websocket_id, None)


# async def check_image_signal(gpt_response, metadata_context_list):
#     """Check for image signals in the response and prepare image data."""
#     import re
#     field_names = ['uuid', 'title', 'abstract', 'image', 'distance']
#     dict_response = [dict(zip(field_names, row)) for row in metadata_context_list]
    
#     for row in dict_response:
#         row['wmsUrl'] = await get_wms(row['uuid'])
    
#     bold_titles = re.findall(r'\*\*(.*?)\*\*', gpt_response)
#     if not bold_titles:
#         return False
        
#     for obj in dict_response:
#         title = obj.get("title", "").lower()
#         for bold_text in bold_titles:
#             bold_lower = bold_text.lower().replace(" ", "")
#             title_lower = title.replace(" ", "")
#             print(f"Comparing with bold text: {bold_text}")
#             print(f"Normalized comparison: '{title_lower}' vs '{bold_lower}'")
#             if bold_lower in title_lower:
#                 if obj.get("uuid") and obj.get("image"):
#                     image_field = obj["image"]
#                     image_urls = [s.strip() for s in image_field.split(",") if s.strip()]
#                     if not image_urls:
#                         continue
#                     dataset_image_url = image_urls[-1]
#                     dataset_uuid = obj["uuid"]
#                     download_url = None
#                     try:
#                         if await dataset_has_download(dataset_uuid):
#                             standard_format = await get_standard_or_first_format(dataset_uuid)
#                             if standard_format:
#                                 download_url = await get_download_url(dataset_uuid, standard_format)
#                     except Exception as e:
#                         print(f"Failed to get download URL: {e}")
#                     return {
#                         "uuid": dataset_uuid,
#                         "datasetImageUrl": dataset_image_url,
#                         "downloadUrl": download_url,
#                         "wmsUrl": obj.get("wmsUrl", None)
#                     }
#                     return False

# async def insert_image_rag_response(full_response, vdb_response, websocket):
#     """Insert image data into the RAG response."""
#     dataset_info = await check_image_signal(full_response, vdb_response)
#     if dataset_info:
#         await send_websocket_message(
#             "insertImage",
#             {
#                 "datasetUuid": dataset_info["uuid"],
#                 "datasetImageUrl": dataset_info["datasetImageUrl"],
#                 "datasetDownloadUrl": dataset_info["downloadUrl"],
#                 "wmsUrl": dataset_info["wmsUrl"]
#             },
#             websocket
#         )

# # Initialize the enhanced RAG chain
# enhanced_rag_chain = EnhancedGeoNorgeRAGChain()

# async def get_rag_response(
#     user_question: str,
#     datasets_with_status: Optional[List[Dict[str, Any]]] = None,
#     vdb_response: Optional[Any] = None,
#     websocket: Optional[Any] = None
# ) -> str:
#     """Main entry point for the enhanced RAG chatbot."""
#     session_id = str(id(websocket))
#     return await enhanced_rag_chain.chat(user_question, session_id, websocket)

# async def get_rag_context(vdb_response):
#     """Get enhanced context from vector database response."""
#     # This function can be implemented if you need specific context processing
#     return None, None