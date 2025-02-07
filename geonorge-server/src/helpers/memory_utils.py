import asyncio
from langchain.chat_models import AzureChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from config import CONFIG

async def summarize_conversation(memory: list) -> str:
    """
    Summarizes the conversation history to keep only the essential points.
    Expects memory to be a list of LangChain message objects.
    """
    if not memory:
        return ""

    conversation_text = ""
    # Iterate over each message object and use the .content attribute.
    for msg in memory:
        role = getattr(msg, "role", "Unknown")
        content = getattr(msg, "content", "")
        conversation_text += f"{role.capitalize()}: {content}\n"

    prompt = (
        "Oppsummer den følgende samtalen på norsk med fokus på de viktigste punktene "
        "og kontekst for videre spørsmål:\n\n"
        f"{conversation_text}\n\nOppsummering:"
    )

    summarizer_llm = AzureChatOpenAI(
        openai_api_base=CONFIG["api"]["azure_gpt_endpoint"],
        openai_api_key=CONFIG["api"]["azure_gpt_api_key"],
        openai_api_version="2024-02-15-preview",
        deployment_name="gpt-4o-mini",  # Use your Azure deployment name
        streaming=False,
        verbose=False,
    )

    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content="Vennligst oppsummer samtalen.")
    ]
    
    summary_response = await summarizer_llm.apredict_messages(messages)
    return summary_response.content.strip()

async def build_memory_context(memory: list) -> str:
    """
    Build a memory context string from conversation history.
    If the conversation is long, summarise it; otherwise, use the full Q/A pairs.
    Expects memory to be a list of LangChain message objects.
    """
    if not memory:
        return ""
    
    # If there are more than 6 messages (i.e. 3 Q/A pairs), summarise.
    if len(memory) > 6:
        summary = await summarize_conversation(memory)
        memory_context = (
            "Tidligere samtalehistorikk (oppsummering):\n"
            f"{summary}\n\n"
            "VIKTIG: Dette er et oppfølgingsspørsmål. Prioriter informasjon fra den tidligere samtalen "
            "før du introduserer nye datasett. Hvis spørsmålet er relatert til tidligere nevnte datasett, fokuser på disse først.\n\n"
        )
    else:
        conversation_pairs = []
        # Assume messages are stored as alternating Human (question) and System (answer) messages.
        for i in range(0, len(memory), 2):
            if i + 1 < len(memory):
                q = memory[i].content
                a = memory[i + 1].content
                conversation_pairs.append(f"Spørsmål: {q}\nSvar: {a}")
        memory_context = (
            "Tidligere samtalehistorikk:\n" +
            "\n\n".join(conversation_pairs) +
            "\n\nVIKTIG: Dette er et oppfølgingsspørsmål. Prioriter informasjon fra den tidligere samtalen "
            "før du introduserer nye datasett. Hvis spørsmålet er relatert til tidligere nevnte datasett, fokuser på disse først.\n\n"
        )
    return memory_context