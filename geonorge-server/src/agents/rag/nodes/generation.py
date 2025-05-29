"""
Final response generation node for the RAG workflow.
"""
from typing import Dict
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage, ToolMessage, AIMessage
from helpers.websocket import send_websocket_message, send_websocket_action
from ...utils.common import active_websockets
from ...utils.image_processor import insert_image_rag_response
from ..state import AgentState
import json

async def generate_final_response(state: AgentState) -> Dict:
    """
    Generate a final response based on the retrieved information.
    """
    from llm import LLMManager
    
    messages = state["messages"]
    websocket_id = state.get("websocket_id", "")
    original_query = state.get("original_query", "")
    
    print(f"DEBUG generate_final_response: Starting with websocket_id: {websocket_id}")
    print(f"DEBUG generate_final_response: Original query: {original_query}")
    
    # Determine if this is part of a merged workflow to suppress direct streaming
    in_merged_workflow = state.get("in_merged_workflow", False)
    print(f"DEBUG generate_final_response: in_merged_workflow={in_merged_workflow}")
    
    websocket = None
    
    # Get the websocket - first try directly from the active_websockets dictionary
    if websocket_id:
        print(f"DEBUG: Trying to get websocket with ID {websocket_id} from active_websockets")
        print(f"DEBUG: Active websockets: {list(active_websockets.keys())}")
        
        # Try to get the websocket from active_websockets
        websocket = active_websockets.get(websocket_id)
        
        if websocket:
            print(f"DEBUG: Successfully found websocket for ID {websocket_id}")
        else:
            print(f"DEBUG: No websocket found for ID {websocket_id} in active_websockets")
            print(f"DEBUG: Will continue without streaming capability")
    else:
        print(f"DEBUG: No websocket_id provided in state")
        print(f"DEBUG: State keys: {state.keys()}")
        
    # First try to get the metadata query from the tool message
    metadata_query = None
    query_for_response = None
    tool_message = None
    
    # Find the most recent tool message
    for msg in reversed(messages):
        if isinstance(msg, ToolMessage):
            tool_message = msg
            break
            
    if tool_message:
        # Try to get the query from additional_kwargs
        if hasattr(tool_message, 'additional_kwargs'):
            # Use the queries stored in the tool message's kwargs
            metadata_query = tool_message.additional_kwargs.get('metadata_query')
            if not metadata_query: # Fallback if 'metadata_query' wasn't explicitly set
                metadata_query = tool_message.additional_kwargs.get('original_query')
            query_for_response = tool_message.additional_kwargs.get('original_query')
            
            print(f"DEBUG generate_final_response: Found query from tool: {query_for_response}")
            print(f"DEBUG generate_final_response: Using metadata query: {metadata_query}")
            
    # If we still don't have a query, fall back to the most recent human message
    if not query_for_response:
        print("DEBUG generate_final_response: No query found, falling back to most recent human message")
        for msg in reversed(messages):
            if isinstance(msg, HumanMessage) and hasattr(msg, 'content'):
                # Use the content of the last human message
                query_for_response = msg.content
                print(f"DEBUG generate_final_response: Using fallback query: {query_for_response[:50]}...")
                break
                
    if not query_for_response:
        print("WARNING: Could not find any query to use")
        query_for_response = "Jeg trenger informasjon om geografiske data"
    
    # Get the retrieved information from the tool message
    retrieved_info = ""
    tool_type = "retrieve_geo_information"  # default type
    
    if tool_message and hasattr(tool_message, 'content'):
        retrieved_info = tool_message.content
        
        # Check which tool was used
        if hasattr(tool_message, 'name'):
            if tool_message.name == "search_dataset":
                tool_type = "search_dataset"
            else:
                tool_type = "retrieve_geo_information"
    
    # If we couldn't find tool message info, try a fallback approach
    if not retrieved_info:
        print("WARNING: No ToolMessage found, trying fallback retrieval")
        for msg in reversed(messages):
            if hasattr(msg, 'content') and isinstance(msg.content, str) and len(msg.content) > 100:
                # Longer content might be retrieved information
                retrieved_info = msg.content
                break
    
    print(f"DEBUG generate_final_response: Using query '{query_for_response}' with retrieved info of length {len(retrieved_info)}")
    
    # Create the appropriate RAG prompt based on which tool was used
    if tool_type == "search_dataset":
        # The search_dataset tool already formats the response, just summarize it
        prompt = PromptTemplate(
            template="""Du er en EKSPERT for geografiske datasett i Norge. 
            Brukeren søkte etter datasett, og her er søkeresultatene:
            
            {context}
            
            Bruk informasjonen fra søkeresultatene til å svare på spørsmålet og foreslå datasett til brukeren: {question}
            
            Inkluder tittel, kort beskrivelse og lenke til hvert datasett i svaret. 
            Du MÅ legge til formatering med bold (**) for titler.

            
            Svar:""",
            input_variables=["question", "context"],
        )
    else:
        # Standard RAG prompt for general geographical information
        prompt = PromptTemplate(
            template="""Du er en assistent som svarer på spørsmål om geografiske data i Norge.
            
            Bruk informasjonen fra den forhåndsinnhentede konteksten for å svare på spørsmålet.
            Hvis du ikke finner svaret i konteksten, si at du ikke har nok informasjon og foreslå alternative måter brukeren kan spørre.
            Hold svaret konsist og fokusert på norske geografiske data.
            Du MÅ legge til formatering med bold (**) for titler.

            IKKE legg til kartoperasjoner i svaret. Eksempel på ting som ikke skal være i svaret: "Jeg kan ikke utføre kartoperasjoner.". Fortell brukeren de kan legge til kartlag fra datasettet ved å trykke på "VIS" knappen på bildet. 
            
            Bruk informasjonen fra søkeresultatene til å svare på spørsmålet og foreslå datasett til brukeren: {question}
            
            Kontekst:
            {context}
            
            Svar:""",
            input_variables=["question", "context"],
        )
    
    # Create and run the generation chain
    llm_manager = LLMManager()
    llm = llm_manager.get_main_llm()
    chain = prompt | llm | StrOutputParser()

    # Send the response through websocket
    if websocket and not in_merged_workflow:
        print(f"DEBUG generate_final_response: Starting token-by-token streaming for standalone RAG.")
        # Send initial empty message to start streaming
        print(f"DEBUG: Sending initial chatStream message")
        await send_websocket_message("chatStream", {"payload": "", "isNewMessage": True}, websocket)
        
        # Stream response token by token
        response_chunks = []
        print(f"DEBUG: Starting to stream tokens")
        try:
            async for chunk in (prompt | llm).astream({"question": query_for_response, "context": retrieved_info}):
                if hasattr(chunk, 'content'):
                    response_chunks.append(chunk.content)
                    print(f"DEBUG: Streaming chunk: {chunk.content[:20]}...")
                    await send_websocket_message("chatStream", {"payload": chunk.content}, websocket)
            
            # Get full response from chunks
            response = "".join(response_chunks)
            print(f"DEBUG generate_final_response: Completed streaming for question: {query_for_response[:50]}...")
            
            # Send stream complete action
            print(f"DEBUG: Sending streamComplete action directly")
            await send_websocket_action("streamComplete", websocket)
            print(f"DEBUG: Sending formatMarkdown action directly")
            await send_websocket_action("formatMarkdown", websocket)
            
            # Now that the response is complete, try to insert image if we have metadata context
            metadata_context = state.get("metadata_context", [])
            print(f"DEBUG: Metadata context: {metadata_context}")
            if metadata_context:
                print(f"DEBUG: Found metadata context with {len(metadata_context)} items")
                try:
                    await insert_image_rag_response(response, metadata_context, websocket)
                    print("DEBUG: Successfully inserted image after response")
                except Exception as e:
                    print(f"ERROR: Failed to insert image: {e}")
                    import traceback
                    traceback.print_exc()
            else:
                print("DEBUG: No metadata context found for image insertion")
                # Try to get fresh metadata for this query as fallback
                try:
                    import asyncio
                    from helpers.vector_database import get_vdb_response
                    
                    # Use original query for metadata if we're responding to a search suggestion
                    query_for_metadata = metadata_query if metadata_query else query_for_response
                    
                    async def _get_metadata():
                        return await get_vdb_response(query_for_metadata)
                        
                    loop = asyncio.get_event_loop()
                    fallback_metadata = loop.run_until_complete(_get_metadata())
                    
                    if fallback_metadata:
                        print(f"DEBUG: Found fallback metadata with {len(fallback_metadata)} items")
                        await insert_image_rag_response(response, fallback_metadata, websocket)
                        print("DEBUG: Successfully inserted image using fallback metadata")
                except Exception as e:
                    print(f"ERROR: Failed to get or use fallback metadata: {e}")
            
            # state["response_streamed"] = True # RAG doesn't set this in its own state directly for supervisor
            print(f"DEBUG: RAG standalone response streamed and image handled (if any).")
            
        except Exception as e:
            print(f"ERROR in generate_final_response (streaming part): {e}")
            # Default to non-streamed generation on error during streaming
            response = await chain.ainvoke({"question": query_for_response, "context": retrieved_info})
    else:
        print(f"DEBUG generate_final_response: No websocket available to send response. Generating content.")
        # Generate response without streaming
        response = await chain.ainvoke({"question": query_for_response, "context": retrieved_info})
    
    return {
        "messages": [AIMessage(content=response)],
        "rewrite_attempts": state.get("rewrite_attempts", 0) # Pass through rewrite_attempts
        } 