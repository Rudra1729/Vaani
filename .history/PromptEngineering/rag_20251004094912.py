# RAG model implementation
import logging
import google.generativeai as genai
from chromadb import Documents, EmbeddingFunction, Embeddings
from google.api_core import retry
import chromadb
from data_extraction import extract_sections
from API_KEY import API_KEY
import os

logging.basicConfig(level=logging.INFO)
genai.configure(api_key=API_KEY)

chroma_client = chromadb.Client()
db = None

def create_documents_from_dict(topic_text_dict):
    documents = []
    
    for topic, text in topic_text_dict.items():
        # Combine the topic with its content in a single document string
        document = f"{topic}\n{text}"
        documents.append(document)
    
    return documents

class GeminiEmbeddingFunction(EmbeddingFunction):
    # Specify whether to generate embeddings for documents, or queries
    document_mode = True

    def __call__(self, input: Documents) -> Embeddings:
        if self.document_mode:
            embedding_task = "retrieval_document"
        else:
            embedding_task = "retrieval_query"

        retry_policy = {"retry": retry.Retry(predicate=retry.if_transient_error)}

        response = genai.embed_content(
            model="models/text-embedding-004",
            content=input,
            task_type=embedding_task,
            request_options=retry_policy,
        )
        return response["embedding"]


def get_contextual_definition(highlighted_text):
    search_term = highlighted_text.strip()
    print(f"🔍 Looking up: '{search_term}'")

    results = db.query(query_texts=[search_term], n_results=1)

    if not results["documents"] or not results["documents"][0]:
        print("⚠️ No relevant passage found. Returning fallback.")
        return f"❌ No relevant passage found for '{search_term}'. Please try a more specific phrase."

    [[passage]] = results["documents"]

    print(f"📚 Found passage: {passage[:200]}...")
    
    # Create explanation prompt
#     prompt = f"""Explain the specific meaning and context of the term '{search_term}' 
# based EXCLUSIVELY on this technical document passage and give a properly structured answer with proper line spacing and framework. Include:

# 1. Operational context

# 2. Other Use cases

# Give me the answer in a paragraph with two headings 'Operational Context' and 'Other Use-cases'. Each paragraph should not exceed 50 words.

# Passage: {passage.replace('\n', ' ')}
# """

    prompt = f"""
You must return valid Markdown only.

Use section headers on their own lines, then the body on the following lines. 
Required sections in this order:
1. Operational Context
2. Other Use-cases

Do not place any prose on the same line as a header. 
Explain the specific meaning and context of the term '{search_term}' 
based EXCLUSIVELY on this technical document passage. 
Give a properly structured answer with clear line spacing and consistent formatting.

Formatting Rules:
- Each section must start with its label in bold (for example, **Operational Context**).
- Each section must contain a single paragraph of no more than 50 words.
- Do not use hashtags (#), bullet points, or code blocks.
- Keep all text in standard Markdown without special characters.

Passage: {passage.replace('\n', ' ')}
"""


    
    # Generate and return answer
    model = genai.GenerativeModel("gemini-2.5-flash-lite")
    response = model.generate_content(prompt)
    s = f"\nContextual meaning of '{search_term}':"
    return(s + response.text)

# Run the interactive lookup
'''
for highlighted_text in clipboard_highight_monitor():
    print(get_contextual_definition(highlighted_text))
'''

def reload_rag_model(pdf_path: str = None) -> None:
    """
    Build or rebuild the Chroma collection from scratch.
    """
    global db
    try:
        chroma_client.delete_collection("googlecardb")
        logging.info("Deleted existing collection.")
    except:
        logging.info("No existing collection to delete; continuing.")

    db = chroma_client.get_or_create_collection(
        name="googlecardb",
        embedding_function=GeminiEmbeddingFunction()
    )

    # Extract text sections & ingest
    topic_text_dict = extract_sections(pdf_path)
    docs = create_documents_from_dict(topic_text_dict)
    db.add(documents=docs, ids=[str(i) for i in range(len(docs))])
    logging.info(f"✅ RAG model reset from '{pdf_path}', {len(docs)} docs loaded.")


def chat_with_doc(user_question):
    # Clean the input
    query = user_question.strip()

    # Query ChromaDB for relevant context
    results = db.query(query_texts=[query], n_results=1)
    [[passage]] = results["documents"]

    # Chat-style prompt
    prompt = f"""
You are a helpful, friendly, and knowledgeable assistant that answers questions based only on the provided technical document.

Guidelines:
- Write in clear, natural, and conversational English — confident but not overly formal.
- Never use Markdown symbols such as **, *, _, `, or #.
- Always write technical names or terms like ToMoBrush in plain text (no bolding or special formatting).
- Stay factually accurate and grounded strictly in the passage. Do not add external information.
- Keep explanations concise but insightful — aim for clarity and completeness over brevity.
- When relevant, include short context or reasoning to make the explanation more understandable.

Here is the passage: {passage.replace('\n', ' ')}

Question: {query}

Answer:
"""



    model = genai.GenerativeModel("gemini-2.5-flash-lite")
    response = model.generate_content(prompt)
    return response.text
