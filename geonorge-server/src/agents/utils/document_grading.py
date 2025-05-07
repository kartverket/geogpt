"""
Document relevance grading utilities for the RAG system.
"""
import json
import re
from typing import List, Dict, Any, Optional, Tuple
from langchain.schema import StrOutputParser
from langchain.prompts import ChatPromptTemplate


async def prepare_documents_for_evaluation(metadata_context: List) -> Tuple[List[Dict], str]:
    """
    Prepare documents for LLM evaluation.
    
    Args:
        metadata_context: List of raw metadata rows
        
    Returns:
        Tuple of (evaluation objects, formatted text for LLM)
    """
    documents_to_evaluate = []
    datasets_text = ""
    
    for i, row in enumerate(metadata_context):
        title = row[1]
        description = row[2] if len(row) > 2 and row[2] else ""
        
        # Create evaluation object
        documents_to_evaluate.append({
            "id": i,
            "title": title,
            "description": description,
            "row": row
        })
        
        # Add to text for LLM evaluation
        datasets_text += f"\nID: {i}\nTittel: {title}\nBeskrivelse: {description}\n"
    
    return documents_to_evaluate, datasets_text


def create_evaluation_prompt(datasets_text: str) -> ChatPromptTemplate:
    """
    Create the evaluation prompt for the LLM.
    
    Args:
        datasets_text: Formatted text representation of datasets
        
    Returns:
        ChatPromptTemplate configured for relevance evaluation
    """
    return ChatPromptTemplate.from_template(f"""
    Du er en AI-assistent som hjelper til med å vurdere relevans av datasett basert på brukerens spørsmål.
    
    Brukerens spørsmål: {{query}}
    
    Nedenfor er en liste med datasett. Vurder hvert datasett og angi om det er relevant for brukerens spørsmål.
    For hvert datasett, gi en score fra 0-100 hvor 100 er høyest relevans.
    Datasett med 'dam', 'dammer', eller lignende vannrelaterte begreper bør få høy score når brukeren spør om dam-relatert informasjon.
    
    Returner resultatet i JSON-format
    
    Bruk 'true' (ikke 'True') og 'false' (ikke 'False') for boolske verdier i JSON.
    
    Datasett å vurdere:
    {datasets_text}
    """)


def extract_json_from_text(text: str) -> Dict:
    """
    Extract JSON from text that might contain markdown or other formatting.
    
    Args:
        text: Raw text response from LLM
        
    Returns:
        Parsed JSON or empty dict on failure
    """
    try:
        # Try to extract JSON if it's wrapped in text or code blocks
        json_match = re.search(r'```json\s*([\s\S]*?)\s*```', text, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
            return json.loads(json_str)
        
        # If not in code blocks, try to parse the raw response
        return json.loads(text)
    except (json.JSONDecodeError, AttributeError):
        print(f"Error extracting JSON from text: {text[:100]}...")
        return {}


def process_evaluation_results(result_json: Dict) -> List[Dict]:
    """
    Process the evaluation results from various possible JSON structures.
    
    Args:
        result_json: Parsed JSON from LLM
        
    Returns:
        List of evaluation objects
    """
    if not result_json:
        return []
        
    # Handle different JSON structures that might be returned
    evaluations = []
    if isinstance(result_json, list):
        # The response is already a list of evaluations
        evaluations = result_json
    elif isinstance(result_json, dict):
        # The response is a dictionary with an evaluations field
        evaluations = result_json.get("evaluations", [])
    
    return evaluations


def get_relevance_info(eval_item: Dict) -> Tuple[Optional[int], bool, int, str]:
    """
    Extract relevance information from an evaluation item.
    
    Args:
        eval_item: Dictionary containing evaluation results
        
    Returns:
        Tuple of (document_id, is_relevant, relevance_score, explanation)
    """
    # Support both "id" and "dataset_id" fields
    doc_id = eval_item.get("id") if eval_item.get("id") is not None else eval_item.get("dataset_id")
    
    # Handle boolean value that might be a string or directly in relevance field
    # Also handle Norwegian field names (relevant)
    is_relevant_val = eval_item.get("is_relevant", 
                    eval_item.get("relevance", 
                    eval_item.get("relevant", False)))
    
    if isinstance(is_relevant_val, str):
        is_relevant = is_relevant_val.lower() == "true"
    else:
        is_relevant = bool(is_relevant_val)
    
    # Support both English and Norwegian field names for scores
    relevance_score = eval_item.get("relevance_score", 
                    eval_item.get("score", 
                    eval_item.get("relevans", 0)))
    
    # Support both English and Norwegian field names for explanations
    explanation = eval_item.get("explanation", 
                eval_item.get("reason", 
                eval_item.get("begrunnelse", "")))
    
    return doc_id, is_relevant, relevance_score, explanation


async def evaluate_document_relevance(
    metadata_context: List, 
    user_query: str, 
    llm: Any, 
    relevance_threshold: int = 50
) -> List:
    """
    Evaluate document relevance using LLM.
    
    Args:
        metadata_context: List of raw metadata rows
        user_query: User's original query
        llm: LLM instance to use for evaluation
        relevance_threshold: Score threshold for keeping documents (0-100)
        
    Returns:
        List of relevant documents (filtered metadata rows)
    """
    print("\n=== LLM DOCUMENT GRADING PROCESS ===")
    print(f"Original user query: {user_query}")
    
    # Skip grading if there are no documents
    if not metadata_context:
        print("No documents to grade")
        return []
    
    # Prepare documents for evaluation
    documents_to_evaluate, datasets_text = await prepare_documents_for_evaluation(metadata_context)
    print(f"Number of documents to grade: {len(documents_to_evaluate)}")
    
    # Create evaluation prompt
    prompt = create_evaluation_prompt(datasets_text)
    
    try:
        # Call LLM for document relevance evaluation
        print("Calling LLM for document relevance evaluation...")
        evaluation_result = await (prompt | llm | StrOutputParser()).ainvoke({"query": user_query})
        print(f"LLM evaluation result:\n{evaluation_result}")
        
        # Parse the LLM response
        result_json = extract_json_from_text(evaluation_result)
        evaluations = process_evaluation_results(result_json)
        
        # Filter documents based on evaluations
        graded_metadata = []
        for eval_item in evaluations:
            doc_id, is_relevant, relevance_score, explanation = get_relevance_info(eval_item)
            
            if doc_id is not None and doc_id < len(documents_to_evaluate):
                doc = documents_to_evaluate[doc_id]
                print(f"\nDocument {doc_id}: {doc['title']}")
                print(f"Is relevant: {is_relevant}")
                print(f"Relevance score: {relevance_score}")
                print(f"Explanation: {explanation}")
                
                # Keep documents with relevance score >= threshold or that are marked as relevant
                if is_relevant or relevance_score >= relevance_threshold:
                    graded_metadata.append(doc["row"])
                    print(f"KEEPING document: {doc['title']}")
                else:
                    print(f"FILTERING OUT document: {doc['title']}")
        
        # Fallback if we filtered everything out
        if not graded_metadata:
            print("All documents were filtered out, using fallback selection")
            graded_metadata = select_fallback_documents(result_json, documents_to_evaluate, metadata_context)
    
    except Exception as e:
        print(f"Error during LLM grading: {str(e)}")
        # Fall back to keeping all documents
        print("Falling back to keeping all documents due to error")
        graded_metadata = [doc["row"] for doc in documents_to_evaluate]
    
    print(f"\nAfter grading, kept {len(graded_metadata)} out of {len(metadata_context)} documents")
    print("Kept documents:")
    for idx, row in enumerate(graded_metadata):
        print(f"{idx+1}. {row[1]}")
    print("=== END LLM DOCUMENT GRADING ===\n")
    
    return graded_metadata


def select_fallback_documents(result_json: Any, documents_to_evaluate: List[Dict], metadata_context: List) -> List:
    """
    Select fallback documents when all documents are filtered out.
    
    Args:
        result_json: Parsed evaluation results
        documents_to_evaluate: List of document evaluation objects
        metadata_context: Original metadata context
        
    Returns:
        List of selected documents
    """
    try:
        # Try to pick the highest scoring documents based on the LLM evaluation
        if result_json and isinstance(result_json, list):
            # Sort documents by score in descending order
            sorted_docs = sorted(result_json, key=lambda x: x.get('Score', 0), reverse=True)
            
            # Keep documents with score >= 70, or at least the top 5
            high_scoring_docs = [
                documents_to_evaluate[doc.get('ID', 0)]['row'] 
                for doc in sorted_docs 
                if doc.get('Score', 0) >= 70 and doc.get('Relevans', False)
            ]
            
            if high_scoring_docs:
                print(f"Keeping {len(high_scoring_docs)} high-scoring documents (score >= 70)")
                return high_scoring_docs
            else:
                # If no documents with score >= 70, take top 5 or fewer
                top_count = min(5, len(sorted_docs))
                print(f"No documents with score >= 70, keeping top {top_count} by score")
                return [
                    documents_to_evaluate[doc.get('ID', 0)]['row'] 
                    for doc in sorted_docs[:top_count] 
                    if doc.get('Relevans', False)
                ]
        else:
            # If we can't get the scores, fallback to top 3 from vector search
            top_count = min(3, len(metadata_context))
            print(f"Couldn't get scores, keeping top {top_count} documents from vector search")
            return metadata_context[:top_count]
    except Exception as e:
        print(f"Error selecting high-scoring documents: {e}")
        # Fall back to top 3 from vector search if anything goes wrong
        top_count = min(3, len(metadata_context))
        print(f"Falling back to keeping top {top_count} documents from vector search")
        return metadata_context[:top_count] 