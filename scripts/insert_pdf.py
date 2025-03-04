import os
import uuid
from datetime import datetime
import PyPDF2
import psycopg2
import aiohttp
import asyncio
from config import DB_CONFIG, CONFIG
from langchain.text_splitter import RecursiveCharacterTextSplitter

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_semantic_chunks(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> list:
    """Split text into semantic chunks using RecursiveCharacterTextSplitter."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    return text_splitter.split_text(text)

async def get_embedding(text):
    """Get embedding from Azure OpenAI API."""
    headers = {
        'Content-Type': 'application/json',
        'api-key': CONFIG["api"]["azure_embedding_api_key"]
    }
    
    data = {
        'input': text,
        'model': 'text-embedding-3-large'
    }
    
    base_url = CONFIG["api"]["azure_embeddings_endpoint"]
    deployment_name = "text-embedding-3-large"
    api_version = "2024-02-15-preview"
    
    endpoint = f"{base_url}/openai/deployments/{deployment_name}/embeddings?api-version={api_version}"
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            endpoint,
            headers=headers,
            json=data
        ) as response:
            if response.status == 200:
                result = await response.json()
                return result['data'][0]['embedding']
            else:
                error_data = await response.text()
                print(f"Full endpoint URL: {endpoint}")
                print(f"Response status: {response.status}")
                raise Exception(f'Azure OpenAI API error: {error_data}')

def extract_text_from_pdf(pdf_path):
    """Extract text content from PDF file."""
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        text = ''
        for page in reader.pages:
            text += page.extract_text() + '\n'
    return text.strip()

def get_pdf_metadata(pdf_path):
    """Extract basic metadata from PDF file."""
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        info = reader.metadata
        creation_date = info.get('/CreationDate', '')
        if creation_date and creation_date.startswith('D:'):
            creation_date = creation_date[2:14]
            try:
                creation_date = datetime.strptime(creation_date, '%Y%m%d%H%M').strftime('%Y-%m-%d')
            except ValueError:
                creation_date = datetime.now().strftime('%Y-%m-%d')
        else:
            creation_date = datetime.now().strftime('%Y-%m-%d')
        
        return {
            'title': info.get('/Title', os.path.basename(pdf_path)),
            'creation_date': creation_date,
            'author': info.get('/Author', '')
        }

async def insert_pdf_chunk_to_db(cur, chunk_text: str, base_data: dict, chunk_index: int):
    """Insert a single chunk of PDF text into the database."""
    # Create chunk-specific data
    data = base_data.copy()
    data['uuid'] = str(uuid.uuid4())  # Each chunk gets a unique UUID
    data['abstract'] = chunk_text
    data['title'] = f"{base_data['title']} (Del {chunk_index + 1})" if chunk_index > 0 else base_data['title']
    
    # Get embeddings for this chunk
    title_vector = await get_embedding(data['title'])
    combined_text = f"{data['title']} {chunk_text}"
    combined_text_vector = await get_embedding(combined_text)
    
    # Insert into database
    insert_query = """
    INSERT INTO text_embedding_3_large 
    (schema, uuid, hierarchylevel, title, datasetcreationdate, abstract, 
     keyword, metadatacreationdate, title_vector, combined_text_vector)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    
    try:
        cur.execute(insert_query, (
            data['schema'], data['uuid'], data['hierarchylevel'],
            data['title'], data['datasetcreationdate'], data['abstract'],
            data['keyword'], data['metadatacreationdate'], title_vector,
            combined_text_vector
        ))
        print(f"Successfully inserted chunk {chunk_index + 1} for: {base_data['title']}")
        return True
    except Exception as e:
        print(f"Error inserting chunk {chunk_index + 1} for {base_data['title']}: {e}")
        return False

async def insert_pdf_to_db(pdf_path):
    """Process PDF and insert into database with semantic chunking."""
    # Extract text and metadata
    text_content = extract_text_from_pdf(pdf_path)
    metadata = get_pdf_metadata(pdf_path)
    
    # Get semantic chunks
    chunks = get_semantic_chunks(text_content)
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    try:
        # Prepare base data
        base_data = {
            'schema': 'pdf',
            'hierarchylevel': 'document',
            'title': metadata['title'],
            'datasetcreationdate': metadata['creation_date'],
            'keyword': metadata['author'],
            'metadatacreationdate': datetime.now().strftime('%Y-%m-%d'),
        }
        
        # Insert each chunk
        success_count = 0
        for i, chunk in enumerate(chunks):
            if await insert_pdf_chunk_to_db(cur, chunk, base_data, i):
                success_count += 1
                conn.commit()  # Commit after each successful chunk
        
        print(f"\nProcessing complete for {metadata['title']}:")
        print(f"Total chunks: {len(chunks)}")
        print(f"Successfully inserted chunks: {success_count}")
        print(f"Failed chunks: {len(chunks) - success_count}")
        
    except Exception as e:
        print(f"Error processing PDF: {e}")
    finally:
        cur.close()
        conn.close()

async def main():
    """Main function to process PDFs in a directory."""
    pdf_dir = input("Enter the directory path containing PDFs (relative to project root): ")
    
    # Convert to absolute path using project root
    abs_pdf_dir = os.path.join(PROJECT_ROOT, pdf_dir)
    
    if not os.path.exists(abs_pdf_dir):
        print(f"Directory does not exist: {abs_pdf_dir}")
        print(f"Project root is: {PROJECT_ROOT}")
        print("Available directories in project root:")
        for item in os.listdir(PROJECT_ROOT):
            if os.path.isdir(os.path.join(PROJECT_ROOT, item)):
                print(f"- {item}/")
        return
    
    for filename in os.listdir(abs_pdf_dir):
        if filename.lower().endswith('.pdf'):
            pdf_path = os.path.join(abs_pdf_dir, filename)
            print(f"\nProcessing {filename}...")
            await insert_pdf_to_db(pdf_path)

if __name__ == "__main__":
    asyncio.run(main()) 