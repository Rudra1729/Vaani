# app.py
import os
import sys
import logging
import threading
import requests
import subprocess
import base64
import time

from pathlib import Path
from flask import (
    Flask, render_template_string, jsonify, request,
    abort, url_for, send_file
)
from flask_cors import CORS, cross_origin
from pdf_utils import cleanup_old_pdfs

import fitz  # PyMuPDF

from rag import reload_rag_model, get_contextual_definition, chat_with_doc
from Research_paper_function import generate_short_query
from Search_Papers_Arvix import search_arxiv_papers
from pdf_utils import ensure_pdf_loaded, current_pdf_path, model_loading, download_pdf

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
    return send_file(current_pdf_path, mimetype='application/pdf')

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
def pdf_viewer():
    pdf_url = url_for('serve_pdf')
    return render_template_string('''
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>PDF Analyzer & Chatbot</title>
  <style>
    body { margin: 0; font-family: 'Segoe UI', sans-serif; background: #f8f9fb; }
    .container {
      display: grid;
      grid-template-columns: 2fr 1.8fr;
      height: 100vh;
      overflow: hidden;
    }
    .pdf-viewer {
      position: relative;
      overflow-y: auto;
      background: #f0f0f0;
      padding: 10px 0 10px 30px;
    }
    .sidebar {
      display: flex;
      flex-direction: column;
      background: #fff;
      padding: 0 20px;
    }
    .tabs { display: flex; margin-top: 10px; }
    .tab-btn {
      flex: 1; padding: 10px; text-align: center; cursor: pointer;
      background: #e0e0e0; border: 1px solid #ccc; border-bottom: none;
    }
    .tab-btn.active { background: #fff; font-weight: bold; }
    .tab-content {
      flex: 1; border: 1px solid #ccc; border-top: none;
      padding: 15px; overflow-y: auto;
    }
    .chat-input { display: flex; margin-top: 10px; }
    .chat-input input {
      flex: 1; padding: 10px; border: 1px solid #ccc;
      border-radius: 6px 0 0 6px;
    }
    .chat-input button {
      padding: 10px 20px; border: none; background: #007bff;
      color: #fff; border-radius: 0 6px 6px 0; cursor: pointer;
    }
    .message { background: #e9ecef; border-radius: 8px;
      padding: 10px; margin-bottom: 10px;
    }
    .bot-message { background: #d0ebff; }
    /* PDF.js text-layer styles */
    .page { position: relative; margin-bottom: 24px; }
    .textLayer {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
    }
    .textLayer span {
      position: absolute; white-space: pre; transform-origin: 0 0;
      color: transparent; pointer-events: all; cursor: text;
    }
    canvas { display: block; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.min.js"></script>
</head>
<body>
  <div class="container">
    <div class="pdf-viewer" id="pdf-container"></div>
    <div class="sidebar">
      <div class="tabs">
        <div class="tab-btn active" onclick="switchTab('analysis')">Text Analysis</div>
        <div class="tab-btn" onclick="switchTab('chat')">Chatbot</div>
      </div>
      <div id="analysis" class="tab-content">
        <div id="results">Select text in the PDF to see analysis results</div>
      </div>
      <div id="chat" class="tab-content" style="display:none">
        <div id="chatHistory"></div>
        <div class="chat-input">
          <input id="chatInput" type="text" placeholder="Ask a question..."/>
          <button onclick="askBot()">Ask</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const pdfUrl = "{{ pdf_url }}";
    const container = document.getElementById('pdf-container');
    const resultsDiv = document.getElementById('results');
    let selectionDebounce = null;
    let lastSent = '';

    // Tab switching
    function switchTab(tab) {
      document.getElementById('analysis').style.display = tab==='analysis'?'block':'none';
      document.getElementById('chat').style.display     = tab==='chat'    ?'block':'none';
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelector('.tab-btn[onclick*="'+tab+'"]').classList.add('active');
    }

    // Send selection with debounce
    function sendSelection(sel) {
      if (!sel || sel === lastSent) return;
      lastSent = sel;
      fetch('/process-selection', {
        method: 'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text: sel })
      })
      .then(r=>r.json())
      .then(data => {
        resultsDiv.innerHTML = `
          <div class="message bot-message">
            <strong>Selected Text:</strong>
            <p style="font-style:italic;color:#555;">${sel}</p>
            <div style="margin-top:10px;">
              ${ data.analysis
                  .replace(/\*\*Operational Context\*\*/g,
                           '<h4 style="margin:10px 0;color:#007bff">Operational Context</h4>')
                  .replace(/\*\*Other Use-cases\*\*/g,
                           '<h4 style="margin:10px 0;color:#007bff">Other Use-cases</h4>')
              }
            </div>
          </div>`;
      });
    }

    // Debounced selectionchange
    document.addEventListener('selectionchange', () => {
      clearTimeout(selectionDebounce);
      selectionDebounce = setTimeout(() => {
        const sel = window.getSelection().toString().trim();
        sendSelection(sel);
      }, 300);
    });

    // Also on mouseup for immediate send
    document.addEventListener('mouseup', () => {
      clearTimeout(selectionDebounce);
      const sel = window.getSelection().toString().trim();
      sendSelection(sel);
    });

    // Chatbot ask
    function askBot() {
      const q = document.getElementById('chatInput').value.trim();
      if (!q) return;
      document.getElementById('chatHistory').innerHTML +=
        `<div class="message"><strong>You:</strong> ${q}</div>`;
      document.getElementById('chatInput').value = '';
      fetch('/ask',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({question:q})
      })
      .then(r=>r.json())
      .then(d=>{
        document.getElementById('chatHistory').innerHTML +=
          `<div class="message bot-message"><strong>Bot:</strong> ${d.answer}</div>`;
        const ch = document.getElementById('chatHistory');
        ch.scrollTop = ch.scrollHeight;
      });
    }

    // Render PDF.js pages + text layers
    pdfjsLib.getDocument(pdfUrl).promise.then(pdf => {
      for (let i = 1; i <= pdf.numPages; i++) {
        pdf.getPage(i).then(page => {
          const scale    = 1.5;
          const viewport = page.getViewport({scale});
          const pageDiv  = document.createElement('div');
          pageDiv.className = 'page';
          pageDiv.style.width  = viewport.width  + 'px';
          pageDiv.style.height = viewport.height + 'px';
          container.appendChild(pageDiv);

          const canvas = document.createElement('canvas');
          canvas.width  = viewport.width;
          canvas.height = viewport.height;
          pageDiv.appendChild(canvas);

          page.render({canvasContext:canvas.getContext('2d'),viewport})
            .promise.then(() => page.getTextContent())
            .then(textContent => {
              const textLayer = document.createElement('div');
              textLayer.className = 'textLayer';
              pageDiv.appendChild(textLayer);
              pdfjsLib.renderTextLayer({
                textContent, container: textLayer,
                viewport, textDivs: []
              });
            });
        });
      }
    }).catch(console.error);
  </script>
</body>
</html>
''', pdf_url=pdf_url)

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

# ─── Startup ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
      start_cleanup_thread()
      port = int(os.environ.get("PORT", 5001))
      app.run(host="0.0.0.0", port=port)
 