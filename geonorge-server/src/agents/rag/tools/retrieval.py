"""
Retrieval tool for GeoNorge vector search.
"""
from langchain.tools import StructuredTool

def create_retrieval_tool(retriever):
    """Create a tool for retrieval operations using GeoNorgeVectorRetriever."""

    def retrieve_geo_information(query: str) -> str:
        """Search and retrieve geographical information from GeoNorge database."""
        import asyncio
        
        # Create a dedicated async function to run in the main thread
        async def _retrieve_data():
            try:
                # Use the retriever to get relevant documents
                documents, vdb_response = await retriever.get_relevant_documents(query)
                
                # Format the documents into a string for the LLM
                formatted_docs = "\n\n".join([doc.page_content for doc in documents])
                
                # Return the formatted documents and metadata
                return formatted_docs
            except Exception as e:
                print(f"ERROR in retrieve_geo_information: {e}")
                import traceback
                traceback.print_exc()
                return "Beklager, jeg kunne ikke hente informasjon. Det oppstod en feil i søket."
        
        # Create event loop and run until complete
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(_retrieve_data())
            return result
        except Exception as e:
            print(f"ERROR in retrieve_geo_information: {e}")
            return "Beklager, jeg kunne ikke hente informasjon fra databasen."
        finally:
            loop.close()
        
    return StructuredTool.from_function(
        func=retrieve_geo_information,
        name="retrieve_geo_information",
        description="Search and retrieve geographical information from GeoNorge database based on vector search."
    ) 