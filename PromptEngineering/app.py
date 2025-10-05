# app.py
import os
import sys
import logging
import threading
import requests
import subprocess
import base64
import time
import tempfile

from pathlib import Path
from flask import (
    Flask, render_template_string, jsonify, request,
    abort, url_for, send_file, Response
)
from flask_cors import CORS, cross_origin
from pdf_utils import cleanup_old_pdfs

import fitz  # PyMuPDF
from elevenlabs import ElevenLabs
import google.generativeai as genai

def extract_pdf_text(pdf_path):
    """Extract all text content from a PDF file"""
    try:
        doc = fitz.open(pdf_path)
        full_text = ""
        for page_num in range(doc.page_count):
            page = doc.load_page(page_num)
            page_text = page.get_text()
            full_text += page_text + "\n\n"
        doc.close()
        return full_text.strip()
    except Exception as e:
        logging.error(f"Failed to extract text from PDF: {e}")
        return ""

from rag import reload_rag_model, get_contextual_definition, chat_with_doc
from data_extraction import extract_sections
from Research_paper_function import generate_short_query
from Search_Papers_Arvix import search_arxiv_papers
from pdf_utils import ensure_pdf_loaded, current_pdf_path, model_loading, download_pdf
from API_KEY import ELEVENLABS_API_KEY
from werkzeug.utils import secure_filename

# ─── Flask Setup ───────────────────────────────────────────────────────────────
app = Flask(__name__)
# allow your React front-end on localhost:3000 (and any same‐origin calls)
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "*"]}},
     supports_credentials=True)
logging.basicConfig(level=logging.INFO)

def start_cleanup_thread(interval=30, max_age=60):
    def run_cleanup():
        while True:
            cleanup_old_pdfs(max_age=max_age)
            time.sleep(interval)

    thread = threading.Thread(target=run_cleanup, daemon=True)
    thread.start()

# ─── PDF + RAG Utility ─────────────────────────────────────────────────────────
def process_text(selection: str):
    return {"analysis": get_contextual_definition(selection)}

# ─── PDF / RAG Routes ──────────────────────────────────────────────────────────
@app.route('/pdf')
def serve_pdf():
    if model_loading or current_pdf_path is None:
        # client can retry after a bit
        return jsonify({"status": "loading"}), 202
    
    try:
        # Add proper headers for PDF serving
        response = send_file(current_pdf_path, mimetype='application/pdf')
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = 'inline; filename="research_paper.pdf"'
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
    except Exception as e:
        logging.error(f"Error serving PDF: {e}")
        return jsonify({"error": "Failed to serve PDF"}), 500

@app.route('/process-selection', methods=['POST'])
def handle_selection():
    data      = request.get_json(silent=True) or {}
    selection = data.get('text','').strip()
    if not selection:
        return jsonify(error="Empty selection"), 400
    try:
        return jsonify(process_text(selection))
    except Exception as e:
        return jsonify(error=str(e)), 500

@app.route('/ask', methods=['POST'])
def ask_question():
    data     = request.get_json(silent=True) or {}
    question = data.get('question','').strip()
    pdf_url  = data.get('pdfUrl', current_pdf_link).strip()

    if not question:
        return jsonify(error="Question cannot be empty"), 400

    try:
        answer = chat_with_doc(question)
        # Support both legacy string and new dict reply with page number
        if isinstance(answer, dict):
            return jsonify(answer=answer.get("text"), page=answer.get("page"), snippet=answer.get("snippet"), anchors=answer.get("anchors"))
        else:
            return jsonify(answer=answer, page=None)
    except Exception as e:
        return jsonify(error=str(e)), 500

@app.route('/update-pdf', methods=['POST','OPTIONS'])
def update_pdf():
    if request.method == 'OPTIONS':
        return '', 200

    data    = request.get_json(silent=True) or {}
    new_link= data.get('link','').strip()
    if not new_link:
        return jsonify(error="Missing 'link'"), 400

    # synchronously download + reload
    try:
        downloaded = download_pdf(new_link)
        abs_path   = os.path.abspath(downloaded)
        if not os.path.isfile(abs_path):
            return jsonify(error=f"PDF missing at {abs_path}"), 500

        global current_pdf_link, current_pdf_path
        current_pdf_link = new_link
        current_pdf_path = abs_path
        reload_rag_model(current_pdf_path)
        logging.info("✅ RAG model reloaded.")
        return jsonify(message="PDF & model updated"), 200

    except Exception as e:
        logging.exception("Error updating PDF")
        return jsonify(error=str(e)), 500

@app.route('/')
def index():
    # Redirect to React frontend
    return jsonify({
        "message": "ResearchAI Backend API",
        "status": "running",
        "pdf_loaded": current_pdf_path is not None,
        "pdf_path": current_pdf_path,
        "frontend": "Please use the React frontend at http://localhost:3000",
        "endpoints": {
            "search": "/search",
            "pdf": "/pdf", 
            "process-selection": "/process-selection",
            "ask": "/ask",
            "mindmap": "/mindmap",
            "update-pdf": "/update-pdf",
            "log-click": "/log-click",
            "transcribe": "/transcribe",
            "tts": "/tts"
        }
    })

@app.route('/health')
def health_check():
    return jsonify({
        "status": "healthy",
        "pdf_loaded": current_pdf_path is not None,
        "model_loading": model_loading,
        "pdf_path": current_pdf_path
    })

# ─── Mind Map Generation Route ────────────────────────────────────────────────
@app.route('/mindmap', methods=['POST'])
@cross_origin()
def generate_mindmap():
    try:
        data = request.get_json(silent=True) or {}
        scope = (data.get('scope') or 'selection').strip().lower()

        def build_prompt_from_text(prefix_text: str) -> str:
            return (
                "You are a research analyst. Perform the following two tasks:\n\n"
                "First, write a concise, one-sentence summary of the text below.\n\n"
                "Then, using only the information from your summary, create a simple mind map. The mind map should be in Markdown format with nested bullet points.\n\n"
                "Text:\n"
                f"{prefix_text}\n\n"
                "Output format:\n"
                "Summary: <one sentence>\n\n"
                "Mind Map:\n"
                "- <Root>\n"
                "  - <Key Point>\n"
                "    - <Sub Point>\n"
            )

        def parse_summary_and_md(output_text: str):
            try:
                import re
                # Capture after 'Summary:' until 'Mind Map:'
                summary_match = re.search(r"Summary\s*:\s*(.+?)(?:\n\s*\n|\n\s*Mind Map:|$)", output_text, re.DOTALL | re.IGNORECASE)
                mindmap_match = re.search(r"Mind Map\s*:\s*(.+)$", output_text, re.DOTALL | re.IGNORECASE)
                summary_val = (summary_match.group(1).strip() if summary_match else output_text.strip().split('\n', 1)[0].strip())
                mindmap_val = (mindmap_match.group(1).strip() if mindmap_match else "")
                # Fallback: if mindmap is empty, produce a minimal markdown from the summary
                if not mindmap_val:
                    root = summary_val.split('.')[0].strip()
                    if not root:
                        root = "Summary"
                    mindmap_val = f"- {root}\n  - Key Points\n    - (derived from summary)"
                return summary_val, mindmap_val
            except Exception:
                return output_text.strip(), f"- {output_text.strip()}"

        def parse_mindmap_to_graph(md_text: str, summary_text: str = ""):
            try:
                nodes = []
                links = []
                stack = []  # list of tuples (depth, node_id)
                seen = {}
                for raw in (md_text or '').splitlines():
                    if not raw.strip():
                        continue
                    stripped = raw.lstrip('\t ')
                    if not (stripped.startswith('-') or stripped.startswith('*')):
                        continue
                    indent = len(raw) - len(raw.lstrip(' '))
                    # assume 2-space indentation per level, be tolerant
                    depth = max(0, indent // 2)
                    label = stripped[1:].strip()
                    if not label:
                        continue
                    count = seen.get(label, 0)
                    seen[label] = count + 1
                    node_id = label if count == 0 else f"{label} ({count+1})"
                    nodes.append({"id": node_id, "group": depth, "label": label})
                    while stack and stack[-1][0] >= depth:
                        stack.pop()
                    if stack:
                        links.append({"source": stack[-1][1], "target": node_id, "value": 1})
                    stack.append((depth, node_id))
                # Fallback: if graph is too sparse, synthesize a minimal one from summary
                if not nodes:
                    root = (summary_text.split(".")[0] or "Paper").strip() or "Paper"
                    child = "Summary"
                    nodes = [
                        {"id": root, "group": 0, "label": root},
                        {"id": child, "group": 1, "label": (summary_text[:80] + ("…" if len(summary_text) > 80 else "")) or child},
                    ]
                    links = [{"source": root, "target": child, "value": 1}]
                elif not links and len(nodes) > 1:
                    # connect first as root to others
                    root_id = nodes[0]["id"]
                    links = [{"source": root_id, "target": n["id"], "value": 1} for n in nodes[1:]]
                return {"nodes": nodes, "links": links}
            except Exception:
                root = (summary_text.split(".")[0] or "Paper").strip() or "Paper"
                return {"nodes": [{"id": root, "group": 0, "label": root}], "links": []}

        model = genai.GenerativeModel("gemini-2.5-flash-lite")

        if scope == 'document':
            if current_pdf_path is None:
                return jsonify(error="No PDF loaded"), 400
            try:
                full_text = extract_pdf_text(current_pdf_path)
                if not full_text or len(full_text.strip()) < 50:
                    return jsonify(error="Unable to extract sufficient text from PDF"), 500
            except Exception as e:
                logging.exception("PDF text extraction failed: %s", e)
                return jsonify(error="Failed to extract text from PDF"), 500

            prompt = build_prompt_from_text(full_text[:6000])
            resp = model.generate_content(prompt)
            output_text = (resp.text or '').strip()
            summary, mindmap_md = parse_summary_and_md(output_text)
            graph = parse_mindmap_to_graph(mindmap_md, summary)
            return jsonify(summary=summary, mindmap_md=mindmap_md, graph=graph)

        # selection flow
        text = (data.get('text') or '').strip()
        if not text:
            return jsonify(error="Missing 'text'"), 400

        prompt = build_prompt_from_text(text[:4000])
        resp = model.generate_content(prompt)
        output_text = (resp.text or '').strip()
        summary, mindmap_md = parse_summary_and_md(output_text)
        graph = parse_mindmap_to_graph(mindmap_md, summary)
        return jsonify(summary=summary, mindmap_md=mindmap_md, graph=graph)
    except Exception as e:
        logging.exception("/mindmap failed")
        return jsonify(error=str(e)), 500

# ─── ArXiv Search / Log-Cick Routes ────────────────────────────────────────────
@app.route("/search", methods=["POST"])
@cross_origin()
def search_arxiv():
    data       = request.get_json(silent=True) or {}
    searchTerm = data.get('searchTerm','').strip()
    if not searchTerm:
        return jsonify(error="Missing searchTerm"), 400

    # 1) shorten prompt, 2) run arxiv query
    short_q = generate_short_query(searchTerm)
    results = search_arxiv_papers(short_q)
    return jsonify(results=results, user_prompt=searchTerm)

@app.route("/log-click", methods=["POST"])
@cross_origin()
def log_click():
    data = request.get_json(silent=True) or {}
    url  = data.get('url','').strip()
    title= data.get('title','').strip()
    if url:
        global search_link
        search_link = url
        logging.info("User clicked on: %s - %s", title, url)
        return jsonify(message="Click logged"), 200
    return jsonify(error="Missing url/title"), 400

@app.route("/transcribe", methods=["POST"])
@cross_origin()
def transcribe_audio():
    try:
        # Check if audio file is present
        if 'audio' not in request.files:
            return jsonify(error="No audio file provided"), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify(error="No audio file selected"), 400

        # Optional language parameter (e.g., 'en', 'hi')
        language = (request.form.get('language') or request.args.get('language') or 'en').strip()
        if not language:
            language = 'en'
        
        # Determine safe filename and extension (accept common audio types)
        safe_name = secure_filename(audio_file.filename or 'audio')
        _, ext = os.path.splitext(safe_name)
        # Default to .wav if extension missing or suspiciously long
        if not ext or len(ext) > 5:
            ext = '.wav'

        # Save audio file temporarily with preserved/derived extension
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            audio_file.save(temp_file.name)
            temp_audio_path = temp_file.name
        
        try:
            # Initialize ElevenLabs client
            client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
            
            # Transcribe audio using ElevenLabs Speech-to-Text API
            with open(temp_audio_path, 'rb') as audio_data:
                # For Hindi, prefer multilingual model if supported
                stt_model = "scribe_v1"
                transcription = client.speech_to_text.convert(
                    model_id=stt_model,
                    file=audio_data,
                    language_code=language,
                    diarize=False,
                    timestamps_granularity="word"
                )
            
            # Extract text from transcription
            transcribed_text = transcription.text if hasattr(transcription, 'text') else str(transcription)
            
            # Clean up the transcribed text
            if transcribed_text:
                transcribed_text = transcribed_text.strip()
            
            logging.info(f"Transcription successful: '{transcribed_text}'")
            
            # Check if transcription is empty or too short
            if not transcribed_text or len(transcribed_text) < 2:
                return jsonify({
                    "error": "No clear speech detected. Please try speaking more clearly.",
                    "text": "",
                    "language": getattr(transcription, 'language_code', 'en'),
                    "confidence": getattr(transcription, 'language_probability', 0.0)
                }), 200
            
            return jsonify({
                "text": transcribed_text,
                "language": getattr(transcription, 'language_code', language or 'en'),
                "confidence": getattr(transcription, 'language_probability', 1.0)
            }), 200
            
        except Exception as e:
            logging.error(f"ElevenLabs API error: {e}")
            return jsonify(error=f"Transcription failed: {str(e)}"), 500
            
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_audio_path)
            except:
                pass
                
    except Exception as e:
        logging.error(f"Transcription endpoint error: {e}")
        return jsonify(error=f"Server error: {str(e)}"), 500


def _translate_text(text: str, target_lang: str) -> str:
    try:
        tgt = (target_lang or '').strip().lower()
        if not text:
            return ''
        # Simple translate prompt; model already configured in rag.py import
        prompt = f"""
You are a translator. Translate the following text into {tgt}.
Preserve meaning and tone. Output only the translated text with no notes.

Text:
{text}
"""
        model = genai.GenerativeModel("gemini-2.5-flash-lite")
        resp = model.generate_content(prompt)
        return (resp.text or '').strip()
    except Exception:
        logging.exception("Translation failed")
        return text


@app.route('/ask-hindi', methods=['POST'])
def ask_hindi():
    data = request.get_json(silent=True) or {}
    question_hi = (data.get('question_hi') or '').strip()
    if not question_hi:
        return jsonify(error="Question cannot be empty"), 400
    try:
        # hi -> en
        question_en = _translate_text(question_hi, 'en')
        ans = chat_with_doc(question_en)
        if isinstance(ans, dict):
            answer_en = ans.get('text') or ''
            page = ans.get('page')
            snippet = ans.get('snippet')
            anchors = ans.get('anchors')
        else:
            answer_en = str(ans)
            page = None
            snippet = None
            anchors = None
        # en -> hi
        answer_hi = _translate_text(answer_en, 'hi')
        return jsonify(
            answer_hi=answer_hi,
            answer_en=answer_en,
            page=page,
            snippet=snippet,
            anchors=anchors
        )
    except Exception as e:
        logging.exception("/ask-hindi failed")
        return jsonify(error=str(e)), 500

@app.route("/tts", methods=["POST", "GET"])
@cross_origin()
def synthesize_tts():
    try:
        if request.method == 'GET':
            text = (request.args.get('text') or '').strip()
            voice_id = (request.args.get('voice_id') or
                        os.environ.get("ELEVENLABS_VOICE_ID") or
                        "21m00Tcm4TlvDq8ikWAM")
            model_id = (request.args.get('model_id') or 'eleven_multilingual_v2')
        else:
            data = request.get_json(silent=True) or {}
            text = (data.get('text') or '').strip()
            voice_id = (data.get('voice_id') or
                        os.environ.get("ELEVENLABS_VOICE_ID") or
                        "21m00Tcm4TlvDq8ikWAM")  # Default: Rachel
            model_id = (data.get('model_id') or 'eleven_multilingual_v2')

        if not text:
            return jsonify(error="Missing 'text'"), 400

        client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

        try:
            audio_stream = client.text_to_speech.convert(
                voice_id=voice_id,
                model_id=model_id,
                text=text,
                # lower bitrate for faster start/playback
                output_format="mp3_22050_32",
            )

            def generate():
                for chunk in audio_stream:
                    yield chunk

            headers = {
                "Cache-Control": "no-store",
                "X-Voice-Id": voice_id,
            }
            return Response(generate(), mimetype="audio/mpeg", headers=headers)

        except Exception as e:
            logging.error(f"ElevenLabs TTS error: {e}")
            return jsonify(error=f"TTS failed: {str(e)}"), 500

    except Exception as e:
        logging.error(f"TTS endpoint error: {e}")
        return jsonify(error=f"Server error: {str(e)}"), 500

# ─── Startup ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
      start_cleanup_thread()
      port = int(os.environ.get("PORT", 5001))
      app.run(host="0.0.0.0", port=port)
 