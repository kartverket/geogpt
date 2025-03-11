"""
Intent analysis node for the RAG workflow.
"""
from typing import Dict
from ..models import ConversationState
from langchain.prompts import ChatPromptTemplate
from langchain.schema import StrOutputParser
from llm import LLMManager
import json


# Initialize LLM manager
llm_manager = LLMManager()
llm = llm_manager.get_main_llm()


async def analyze_intent(state: Dict) -> Dict:
    """
    Determine the user's intent from their message.
    
    This node classifies the user's query into one of several intent categories:
    - initial_search: User is searching for new datasets or information
    - refine_search: User wants to refine current search results
    - dataset_details: User wants more information about specific datasets
    - clarification: User needs clarification about something already discussed
    - download_request: User wants to download a previously mentioned dataset
    - comparison: User wants to compare previously mentioned datasets
    - end_conversation: User wants to end the conversation
    
    Args:
        state: Current conversation state
        
    Returns:
        Updated conversation state with the determined intent
    """
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
    
    try:
        intent_data = json.loads(intent)
        if isinstance(intent_data, dict) and "intent" in intent_data:
            current_state.current_intent = intent_data["intent"].strip()
        else:
            current_state.current_intent = list(intent_data.values())[0].strip() if isinstance(intent_data, dict) else intent_data.strip()
    except (json.JSONDecodeError, AttributeError):
        current_state.current_intent = intent.strip()
    
    print(f"Determined intent: {current_state.current_intent}")
    print("=====================\n")
    
    return current_state.to_dict() 