from langchain.tools import StructuredTool
import asyncio
# Assuming GeoNorgeVectorRetriever is importable if strong type hinting is desired for 'retriever'
# For example: from ...retrieval import GeoNorgeVectorRetriever

def create_geonorge_retrieval_tool(retriever) -> StructuredTool:
    """Create a tool for retrieval operations using GeoNorgeVectorRetriever."""

    def retrieve_geo_information(query: str) -> str:
        """Search and retrieve geographical information from GeoNorge database."""
        
        async def _retrieve_data():
            try:
                # Only retrieve documents, no metadata context handling here
                documents, _ = await retriever.get_relevant_documents(query) # Use passed retriever
                formatted_docs = "\n\n".join([doc.page_content for doc in documents])
                return formatted_docs
            except Exception as e:
                print(f"ERROR in retrieve_geo_information: {e}")
                import traceback
                traceback.print_exc()
                return "Beklager, jeg kunne ikke hente informasjon. Det oppstod en feil i søket."
        
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