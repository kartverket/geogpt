from langchain.tools import StructuredTool
# If helpers.vector_database is not directly on PYTHONPATH, this import might need adjustment.
# For example, if src is the root for python modules: from src.helpers.vector_database import get_vdb_response
# Or relative: from ....helpers.vector_database import get_vdb_response (adjust dots as needed)
from helpers.vector_database import get_vdb_response 
import asyncio

def create_geonorge_dataset_info_tool() -> StructuredTool:
    """Create a tool for vector-based dataset search."""
    
    def search_dataset(dataset_query: str) -> str:
        """Find dataset information using vector search. Returns formatted string."""
        
        async def _search_data():
            try:
                vdb_response = await get_vdb_response(dataset_query)
                
                if not vdb_response:
                    return "Ingen datasett funnet som matcher søket ditt."
                
                formatted_response = "Her er datasettene som matcher søket ditt:\\n\\n"
                for idx, row in enumerate(vdb_response, 1):
                    uuid = row[0]
                    title = row[1]
                    abstract = row[2] if len(row) > 2 and row[2] else "Ingen beskrivelse tilgjengelig"
                    url_formatted_title = title.replace(' ', '-')
                    source_url = f"https://kartkatalog.geonorge.no/metadata/{url_formatted_title}/{uuid}"
                    formatted_response += f"{idx}. **{title}**\\n"
                    formatted_response += f"Beskrivelse: {abstract}\\n"
                    formatted_response += f"Mer informasjon: {source_url}\\n\\n"
                
                return formatted_response
                
            except Exception as e:
                print(f"ERROR in search_dataset: {e}")
                import traceback
                traceback.print_exc()
                return "Beklager, jeg kunne ikke søke etter datasett. Det oppstod en feil i søket."

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(_search_data())
            return result
        except Exception as e:
            print(f"ERROR in search_dataset: {e}")
            return "Beklager, jeg kunne ikke søke etter datasett."
        finally:
            loop.close()
            
    return StructuredTool.from_function(
        func=search_dataset,
        name="search_dataset",
        description="Search for datasets using vector search based on a query about the dataset content. Returns a formatted string."
    ) 