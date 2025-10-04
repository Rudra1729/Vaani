# pdf_utils.py
import os
import re
import logging
import threading
import requests
import shutil
import time
from uuid import uuid4

from rag import reload_rag_model   # wherever your reload logic lives

# global state
current_pdf_url = None
current_pdf_path = None
model_loading   = False

#CHANGED
def download_pdf(url: str, timeout: int = 15) -> str:
    # Create a unique, time-stamped folder per session/request
    timestamp = int(time.time())
    unique_id = str(uuid4())[:8]
    session_folder = os.path.join("pdfs", f"session_{timestamp}_{unique_id}")
    os.makedirs(session_folder, exist_ok=True)

    # Create a safe filename from the URL
    safe_name = re.sub(r'\W+', '_', url)[:50] + ".pdf"
    local_path = os.path.join(session_folder, safe_name)

    # Skip download if already exists (optional)
    if os.path.exists(local_path):
        return local_path

    # Download the PDF
    logging.info(f"📥 Downloading PDF from {url}")
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    with open(local_path, "wb") as f:
        f.write(resp.content)

    logging.info(f"✅ PDF saved at {local_path}")
    return local_path

def _download_and_reload(pdf_url: str):
    """Download the PDF and reload the RAG model in background."""
    global current_pdf_path, model_loading
    try:
        path = download_pdf(pdf_url)
        current_pdf_path = path
        reload_rag_model(path)
        logging.info("Background download & RAG reload complete")
    except Exception:
        logging.exception("Background download/reload failed")
    finally:
        model_loading = False

def ensure_pdf_loaded(pdf_url: str):
    """
    If this is a new PDF URL, kick off a background thread
    to download & reload the model, and immediately return.
    """
    global current_pdf_url, model_loading
    if pdf_url != current_pdf_url:
        current_pdf_url = pdf_url
        model_loading   = True
        thread = threading.Thread(
            target=_download_and_reload, args=(pdf_url,), daemon=True
        )
        thread.start()
        logging.info(f"Started background download & reload for {pdf_url}")

#ADDED
def cleanup_old_pdfs(base_dir="pdfs", max_age=600):
    now = time.time()
    if not os.path.exists(base_dir):
        return

    for folder in os.listdir(base_dir):
        folder_path = os.path.join(base_dir, folder)
        if os.path.isdir(folder_path):
            created_time = os.path.getctime(folder_path)
            if now - created_time > max_age:
                try:
                    shutil.rmtree(folder_path)
                    logging.info(f"🧹 Deleted old folder: {folder_path}")
                except Exception as e:
                    logging.warning(f"❌ Failed to delete {folder_path}: {e}")