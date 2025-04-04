"""
Provides the vector retrieval capabilities for the GeoNorge RAG system.
"""
from typing import List, Dict, Tuple, Optional, Any
import re
import json

from langchain_core.documents import Document
from langchain.prompts import ChatPromptTemplate
from langchain.schema import StrOutputParser
from langchain.text_splitter import RecursiveCharacterTextSplitter

from helpers.vector_database import get_vdb_response
from .rewrite_instructions import QUERY_REWRITE_PROMPT
from llm import LLMManager

llm_manager = LLMManager()
rewrite_llm = llm_manager.get_rewrite_llm()

class GeoNorgeVectorRetriever:
    """
    A specialized retriever for GeoNorge geographic data that transforms queries
    and retrieves relevant documents from the vector database.
    """
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )

    async def _transform_query(self, query: str) -> str:
        """Transform the user query to get better search results."""
        print(f"\nOriginal query: {query}")
        
        # Safeguard against non-string inputs
        if not isinstance(query, str):
            print(f"WARNING: Non-string query received: {type(query)}")
            # Try to extract text if it's a dict or list
            if isinstance(query, dict) and "content" in query and isinstance(query["content"], str):
                query = query["content"]
            elif isinstance(query, list) and len(query) > 0:
                # If it's a list, try to get the first string item or convert to string
                for item in query:
                    if isinstance(item, str):
                        query = item
                        break
                else:
                    # If no string found, convert the whole thing to string
                    query = str(query)
            else:
                # Last resort: convert to string
                query = str(query)
                # If it looks like a JSON representation, use a fallback
                if query.startswith('[') or query.startswith('{'):
                    query = "Jeg trenger informasjon om geografiske data"
            
            print(f"Sanitized query: {query}")
        
        rewrite_llm = LLMManager().get_main_llm()
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", QUERY_REWRITE_PROMPT),
            ("human", query)
        ])
        
        chain = prompt | rewrite_llm | StrOutputParser()
        transformed_query = await chain.ainvoke({"query": query})
        
        print(f"Transformed query: {transformed_query.strip()}")
        print("---------------------")
        
        return transformed_query.strip()
    
    def _create_source_url(self, title: str, uuid: str) -> str:
        """Create a properly formatted source URL for a dataset."""
        url_formatted_title = title.replace(' ', '-')
        return f"https://kartkatalog.geonorge.no/metadata/{url_formatted_title}/{uuid}"
    
    def _format_date(self, date_str: Optional[str]) -> Optional[str]:
        """Format a date string from ISO format to Norwegian format."""
        if not date_str:
            return None
            
        try:
            date_parts = date_str.split('-')
            if len(date_parts) == 3:
                return f"{date_parts[2]}.{date_parts[1]}.{date_parts[0]}"
            return date_str
        except:
            return date_str
    
    def _extract_metadata(self, row: List) -> Dict:
        """Extract metadata from a database row."""
        return {
            "uuid": row[0],
            "title": row[1],
            "image": row[3] if len(row) > 3 else None,
            "metadatacreationdate": row[4] if len(row) > 4 else None
        }
    
    def _create_document_content(self, title: str, description: Optional[str], 
                               date_str: Optional[str], source_url: str) -> str:
        """Create formatted document content."""
        content = f"Datasett: {title}\n"
        
        if description:
            content += f"Beskrivelse: {description}\n"
            
        if date_str:
            formatted_date = self._format_date(date_str)
            if formatted_date:
                content += f"Sist oppdatert: {formatted_date}\n"
                
        content += f"Mer informasjon: {source_url}"
        return content
    
    def _create_document(self, title: str, description: Optional[str], 
                        metadata: Dict, source_url: str) -> Document:
        """Create a Document instance with the given information."""
        content = self._create_document_content(
            title, 
            description, 
            metadata.get("metadatacreationdate"), 
            source_url
        )
        
        return Document(
            page_content=content,
            metadata=metadata
        )

    async def get_relevant_documents(self, query: str) -> Tuple[List[Document], Any]:
        """Retrieve relevant documents from the Postgres pgvector database."""
        try:
            # # Transform the query to improve retrieval quality
            # transformed_query = await self._transform_query(query)
            
            # print(f"Original query: {query}")
            # print(f"Transformed query: {transformed_query}")
            # print("---------------------")
            
            # Query the vector database
            vdb_response = await get_vdb_response(query)
            print(f"Vector DB returned {len(vdb_response)} results")
            
            # Add debugging for vdb_response structure
            if vdb_response and len(vdb_response) > 0:
                print(f"DEBUG: Sample VDB response entry structure:")
                sample_entry = vdb_response[0]
                print(f"DEBUG: Entry type: {type(sample_entry)}, length: {len(sample_entry)}")
                print(f"DEBUG: Entry fields: {sample_entry}")
                # Check if image field exists and what it contains
                if len(sample_entry) > 3:
                    print(f"DEBUG: Image field (index 3): {sample_entry[3]}")
            
            
            # Create Document objects from the results
            documents = []
            
            # Group by title to collate multiple chunks from the same document
            title_groups = self._group_documents_by_title(vdb_response)
            
            for title, chunks in title_groups.items():
                # Process each document group
                for row, _ in chunks:
                    metadata = self._extract_metadata(row)
                    source_url = self._create_source_url(row[1], row[0])
                    description = row[2] if len(row) > 2 and row[2] else None
                    
                    documents.append(self._create_document(
                        row[1], description, metadata, source_url
                    ))
            
            if not documents:
                documents.append(Document(
                    page_content="Beklager, jeg fant ingen relevante datasett for dette spørsmålet i Geonorge sin database. For å hjelpe deg finne passende datasett, trenger jeg mer spesifikk informasjon. Vennligst spesifiser detaljer som geografisk område, tidsperiode, eller mer spesifikke datatyper du er interessert i.",
                    metadata={"fallback": True, "no_results": True}
                ))
            
            return documents, vdb_response
            
        except Exception as e:
            print(f"ERROR in vector retrieval: {e}")
            import traceback
            traceback.print_exc()
            # Return empty results
            return [], []
        
    def _group_documents_by_title(self, vdb_response: List) -> Dict:
        """Group documents by their base title, handling chunked documents."""
        document_groups = {}
        for row in vdb_response:
            title = row[1]
            # Check if this is a chunked document (contains "Del X" in the title)
            base_title = title
            chunk_indicator = None
            if " (Del " in title:
                base_title = title.split(" (Del ")[0]
                chunk_indicator = title.split(" (Del ")[1].rstrip(")")
            
            # Create or append to document group
            if base_title not in document_groups:
                document_groups[base_title] = []
            document_groups[base_title].append((row, chunk_indicator))
        
        return document_groups
        
    def _combine_abstracts(self, chunks: List[Tuple]) -> str:
        """Combine abstracts from multiple chunks into a single text."""
        combined_abstract = ""
        for row, _ in chunks:
            if len(row) > 2 and row[2]:
                if combined_abstract:
                    combined_abstract += " "
                combined_abstract += row[2]
        return combined_abstract 