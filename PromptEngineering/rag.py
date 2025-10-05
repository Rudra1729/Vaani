# RAG model implementation
import logging
import google.generativeai as genai
from chromadb import Documents, EmbeddingFunction, Embeddings
from google.api_core import retry
import chromadb
from data_extraction import extract_sections
from API_KEY import API_KEY
import os
import pdfplumber
import re

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
    def __call__(self, input: Documents) -> Embeddings:
        # Chroma calls this with a list of strings; return a list of vectors
        items = input if isinstance(input, list) else [input]
        embeddings: Embeddings = []
        for text in items:
            try:
                resp = genai.embed_content(
                    model="models/text-embedding-004",
                    content=text,
                    # task_type can be omitted; the model infers it sufficiently well
                    request_options={"retry": retry.Retry(predicate=retry.if_transient_error)},
                )
                embeddings.append(resp["embedding"])
            except Exception:
                logging.exception("Embedding failed; using zero vector fallback")
                embeddings.append([0.0] * 768)
        return embeddings


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

    # Ingest per page, then chunk to improve recall; keep page metadata
    docs = []
    metadatas = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for idx, page in enumerate(pdf.pages, start=1):
                # Layout-aware extraction tends to preserve columns/ordering better
                text = page.extract_text(x_tolerance=2, y_tolerance=2) or ""
                text = text.strip()
                if not text:
                    continue
                # chunk the page text (approx by characters)
                chunk_size = 900
                overlap = 150
                start = 0
                chunk_idx = 0
                while start < len(text):
                    end = min(len(text), start + chunk_size)
                    chunk = text[start:end]
                    # avoid tiny trailing chunks
                    if len(chunk.strip()) < 40 and end != len(text):
                        start = end - overlap
                        if start < 0:
                            start = 0
                        continue
                    docs.append(chunk)
                    metadatas.append({
                        "page": idx,
                        "source": os.path.basename(pdf_path),
                        "chunk": chunk_idx
                    })
                    chunk_idx += 1
                    if end == len(text):
                        break
                    start = end - overlap
    except Exception as e:
        logging.exception("Failed to extract pages for RAG: %s", e)
        docs = []
        metadatas = []

    if not docs:
        # Fallback to previous section extraction when pages empty
        topic_text_dict = extract_sections(pdf_path)
        docs = create_documents_from_dict(topic_text_dict)
        metadatas = [{"page": None, "source": os.path.basename(pdf_path)} for _ in docs]

    db.add(documents=docs, metadatas=metadatas, ids=[str(i) for i in range(len(docs))])
    logging.info(f"✅ RAG model reset from '{pdf_path}', {len(docs)} page-chunks loaded.")


def _tokenize(text: str) -> list:
    if not text:
        return []
    return re.findall(r"[a-zA-Z0-9]+", text.lower())


def _lexical_overlap_score(query_tokens: list, doc_text: str) -> float:
    if not query_tokens or not doc_text:
        return 0.0
    doc_tokens = set(_tokenize(doc_text))
    if not doc_tokens:
        return 0.0
    overlap = sum(1 for t in set(query_tokens) if t in doc_tokens)
    return overlap / max(1, len(set(query_tokens)))


def chat_with_doc(user_question):
    # Clean the input
    query = user_question.strip()

    # Query ChromaDB for relevant context
    query_tokens = _tokenize(query)
    results = db.query(query_texts=[query], n_results=12)
    if not results.get("documents") or not results["documents"][0]:
        return {"text": "Sorry, I couldn’t find that in the document.", "page": None}
    passages = results["documents"][0]
    metadatas = results.get("metadatas", [[{}]])[0]
    distances = results.get("distances", [[None]])[0]

    ranked = []
    for idx, p in enumerate(passages):
        dist = distances[idx]
        # Convert distance to similarity if available; else assume neutral
        vec_sim = 0.0
        if dist is not None:
            try:
                vec_sim = 1.0 / (1.0 + float(dist))
            except Exception:
                vec_sim = 0.0
        lex = _lexical_overlap_score(query_tokens, p)
        combined = 0.65 * vec_sim + 0.35 * lex
        ranked.append((combined, idx, p))

    ranked.sort(reverse=True, key=lambda x: x[0])
    # Top chunk determines primary page for scrolling
    best_idx = ranked[0][1]
    top_page = metadatas[best_idx].get("page") if metadatas and isinstance(metadatas[best_idx], dict) else None
    best_chunk = passages[best_idx] if 0 <= best_idx < len(passages) else ""

    # Build compact context from top 4 chunks
    top_ctx = []
    for _, i, p in ranked[:4]:
        m = metadatas[i] if i < len(metadatas) else {}
        top_ctx.append((m.get("page"), p))
    try:
        page_meta = results.get("metadatas", [[{}]])[0][0].get("page")
    except Exception:
        page_meta = None

    # Build compact context with citations
    joined_context = "\n\n".join(
        [f"[Page {pg}] {p}" for pg, p in top_ctx]
    )

    prompt = f"""
You are a helpful assistant answering ONLY from the provided context.

Style:
- Clear, human, single paragraph, 2–4 sentences, ≤80 words.
- Start with the direct answer. No markdown.

Context:
{joined_context}

Question: {query}

Answer:
"""



    model = genai.GenerativeModel("gemini-2.5-flash-lite")
    response = model.generate_content(prompt)
    # Provide a snippet and n-gram anchors from the best chunk to enable precise client-side location
    snippet = (best_chunk or "").strip()
    if len(snippet) > 220:
        snippet = snippet[:220]
    # Simple anchor trigrams (ignore short tokens)
    toks = [t for t in _tokenize(best_chunk) if len(t) >= 3]
    anchors = []
    for i in range(len(toks) - 2):
        tri = " ".join([toks[i], toks[i+1], toks[i+2]])
        if tri not in anchors:
            anchors.append(tri)
        if len(anchors) >= 6:
            break
    return {"text": response.text, "page": top_page, "snippet": snippet, "anchors": anchors}
