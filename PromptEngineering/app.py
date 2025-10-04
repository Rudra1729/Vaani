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
    abort, url_for, send_file
)
from flask_cors import CORS, cross_origin
from pdf_utils import cleanup_old_pdfs

import fitz  # PyMuPDF
from elevenlabs import ElevenLabs

from rag import reload_rag_model, get_contextual_definition, chat_with_doc
from Research_paper_function import generate_short_query
from Search_Papers_Arvix import search_arxiv_papers
from pdf_utils import ensure_pdf_loaded, current_pdf_path, model_loading, download_pdf
from API_KEY import ELEVENLABS_API_KEY

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
        return jsonify(answer=answer)
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
            "update-pdf": "/update-pdf",
            "log-click": "/log-click",
            "transcribe": "/transcribe"
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
        
        # Save audio file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            audio_file.save(temp_file.name)
            temp_audio_path = temp_file.name
        
        try:
            # Initialize ElevenLabs client
            client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
            
            # Transcribe audio using ElevenLabs Speech-to-Text API
            with open(temp_audio_path, 'rb') as audio_data:
                transcription = client.speech_to_text.convert(
                    model_id="scribe_v1",
                    file=audio_data,
                    language_code="en",
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
                "language": getattr(transcription, 'language_code', 'en'),
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

# ─── Startup ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
      start_cleanup_thread()
      port = int(os.environ.get("PORT", 5001))
      app.run(host="0.0.0.0", port=port)
 