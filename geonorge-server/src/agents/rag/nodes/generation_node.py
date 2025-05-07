import json
import asyncio
from typing import Dict

from langchain_core.prompts import PromptTemplate
from langchain_core.messages import AIMessage, BaseMessage # Added BaseMessage
from langchain_core.output_parsers import StrOutputParser
from llm import LLMManager
from helpers.websocket import send_websocket_message, send_websocket_action
from helpers.vector_database import get_vdb_response

from ...utils.common import active_websockets
from ...utils.image_processor import insert_image_rag_response
from ...utils.message_utils import standardize_message, standardize_state, get_last_message_by_role
from ..state import AgentState

async def generate_final_response_logic(state: AgentState) -> Dict:
    """
    Generate a final response based on the retrieved information.
    Fetches metadata for image insertion based on the query used in the tool call.
    """
    state_dict = standardize_state(state)
    messages = state_dict.get("messages", [])
    websocket_id = state_dict.get("websocket_id", "")
    
    print(f"DEBUG generate_final_response_logic: Starting with websocket_id: {websocket_id}")
    
    websocket = active_websockets.get(websocket_id) if websocket_id else None
    if websocket:
        print(f"DEBUG generate_final_response_logic: Found websocket for ID {websocket_id}")
    else:
        print(f"DEBUG generate_final_response_logic: No websocket found for ID {websocket_id}, continuing without streaming.")
             
    last_tool_message = None
    last_tool_message_index = -1
    tool_type = "retrieve_geo_information"
    query_for_response = None
    metadata_query = None
    retrieved_info = ""
    
    for i in range(len(messages) - 1, -1, -1):
        msg = standardize_message(messages[i])
        if msg["role"] == "tool":
            last_tool_message = msg
            last_tool_message_index = i
            retrieved_info = msg.get("content", "")
            tool_type = msg.get("name", "retrieve_geo_information") # Assumes name is passed in std_msg for tool
            break
    
    if not last_tool_message:
        print("WARNING generate_final_response_logic: No ToolMessage found. Cannot generate response.")
        for msg_item in messages: # Iterate over original messages list from state
            std_msg_item = standardize_message(msg_item)
            if std_msg_item.get("content", "") and len(std_msg_item["content"]) > 100:
                retrieved_info = std_msg_item["content"]
                print("WARNING generate_final_response_logic: Using fallback context from a non-ToolMessage.")
                break
        query_for_response = get_last_message_by_role(messages, "human") 
        metadata_query = query_for_response
        if not query_for_response:
            query_for_response = "Jeg trenger informasjon om geografiske data"
            metadata_query = query_for_response
    else:
        tool_call_id = last_tool_message.get("tool_call_id", "")
        if tool_call_id:
            for i in range(last_tool_message_index - 1, -1, -1):
                msg = standardize_message(messages[i])
                if msg["role"] == "assistant" and "additional_kwargs" in msg and "tool_calls" in msg["additional_kwargs"]:
                    tool_calls_in_ai = msg["additional_kwargs"]["tool_calls"]
                    for tc in tool_calls_in_ai:
                        current_tc_id = tc.get('id', "")
                        function_data = tc.get('function', {})
                        current_tc_args = function_data.get('arguments', "{}")
                        if current_tc_id == tool_call_id:
                            try:
                                args_dict = json.loads(current_tc_args) if isinstance(current_tc_args, str) else current_tc_args
                                metadata_query = args_dict.get('query') or args_dict.get('dataset_query')
                                query_for_response = metadata_query
                                if metadata_query:
                                    print(f"DEBUG generate_final_response_logic: Found query '{metadata_query[:50]}...' from AIMessage tool call {tool_call_id}")
                                    break
                            except Exception as e:
                                print(f"ERROR generate_final_response_logic: Could not parse args: {e}")
                    if metadata_query: 
                        break
        if not metadata_query:
            print("DEBUG generate_final_response_logic: Could not find query via tool_call_id, falling back to last HumanMessage")
            query_for_response = get_last_message_by_role(messages, "human")
            metadata_query = query_for_response
    
    if not query_for_response:
        query_for_response = "Jeg trenger informasjon om geografiske data"
    if not metadata_query:
        metadata_query = query_for_response
             
    print(f"DEBUG generate_final_response_logic: Using query_for_response '{query_for_response[:50]}...', metadata_query '{metadata_query[:50]}...', tool_type '{tool_type}', context length {len(retrieved_info)}")
    
    metadata_context_for_image = []
    try:
        print(f"DEBUG generate_final_response_logic: Fetching VDB response for metadata query: {metadata_query}")
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        async def _get_metadata(): 
            return await get_vdb_response(metadata_query)
        
        if loop.is_running():
            task = loop.create_task(_get_metadata())
            metadata_context_for_image = await task
        else:
            metadata_context_for_image = loop.run_until_complete(_get_metadata())
                 
        if metadata_context_for_image:
            print(f"DEBUG generate_final_response_logic: Successfully fetched {len(metadata_context_for_image)} metadata items.")
        else:
            print(f"DEBUG generate_final_response_logic: No metadata items found for query: {metadata_query}")
    except Exception as e:
        print(f"ERROR generate_final_response_logic: Failed to fetch metadata: {e}")
        import traceback
        traceback.print_exc()

    if tool_type == "search_dataset":
        prompt = PromptTemplate(
            template="""Du er en EKSPERT for geografiske datasett i Norge. 
            Brukeren søkte etter datasett, og her er søkeresultatene:
            
            {context}
            
            Bruk informasjonen fra søkeresultatene til å svare på spørsmålet og foreslå datasett til brukeren: {question}
            
            Inkluder tittel, kort beskrivelse og lenke til hvert datasett i svaret. 
            Du MÅ legge til formatering med bold (**) for titler.
            Ikke legg til kartoperasjoner i svaret.

            Svar:""",
            input_variables=["question", "context"],
        )
    else:
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
    
    llm_manager = LLMManager()
    llm = llm_manager.get_main_llm()
    chain = prompt | llm | StrOutputParser()

    final_response_content = ""
    
    is_mixed_workflow = state_dict.get("in_merged_workflow", False) # Get from state_dict

    if websocket:
        if not is_mixed_workflow:
            print(f"DEBUG generate_final_response_logic: Starting token-by-token streaming (standalone RAG)")
            await send_websocket_message("chatStream", {"payload": "", "isNewMessage": True}, websocket)
            response_chunks = []
            try:
                async for chunk in (prompt | llm).astream({"question": query_for_response, "context": retrieved_info}):
                    if hasattr(chunk, 'content'):
                        response_chunks.append(chunk.content)
                        await send_websocket_message("chatStream", {"payload": chunk.content}, websocket)
                final_response_content = "".join(response_chunks)
                print(f"DEBUG generate_final_response_logic: Completed streaming for question: {query_for_response[:50]}...")
                await send_websocket_action("streamComplete", websocket)
                await send_websocket_action("formatMarkdown", websocket)
                if metadata_context_for_image:
                    print(f"DEBUG: Found metadata context with {len(metadata_context_for_image)} items for standalone response")
                    try:
                        await insert_image_rag_response(final_response_content, metadata_context_for_image, websocket)
                        print("DEBUG: Successfully inserted image after standalone response")
                    except Exception as e:
                        print(f"ERROR: Failed to insert image: {e}")
                        import traceback
                        traceback.print_exc()
                else:
                    print("DEBUG: No metadata context found or fetched for image insertion in standalone response")
            except Exception as e:
                print(f"ERROR in generate_final_response_logic streaming: {e}")
                final_response_content = await chain.ainvoke({"question": query_for_response, "context": retrieved_info})
        else:
            print(f"DEBUG generate_final_response_logic: Suppressing chat response and image insertion in mixed workflow mode")
            final_response_content = await chain.ainvoke({"question": query_for_response, "context": retrieved_info})
    else:
        print(f"DEBUG generate_final_response_logic: No websocket available to send response")
        final_response_content = await chain.ainvoke({"question": query_for_response, "context": retrieved_info})
    
    final_ai_message = AIMessage(
        content=final_response_content,
        additional_kwargs={
            "metadata_context": metadata_context_for_image
        }
    )
    
    # Return only the new message and necessary pass-through state items for LangGraph to merge
    return {
        "messages": [final_ai_message], # This will be merged by add_messages
        "websocket_id": websocket_id,
        "in_merged_workflow": is_mixed_workflow 
    } 