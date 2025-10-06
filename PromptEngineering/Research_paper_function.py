"""This file contains the code for generating a short query for schematic using prompt engineering.
Function: generate_short_query(long_prompt_string)--> returns shortened prompt.
"""

import google.generativeai as genai
from dotenv import load_dotenv
import os
from API_KEY import API_KEY

# Load environment variables
load_dotenv()

# Configure the API key
genai.configure(api_key=API_KEY)

model = genai.GenerativeModel(
    'gemini-2.5-flash-lite',
    generation_config=genai.GenerationConfig(
        temperature=0.7,
        top_p=1,
        max_output_tokens=100,
    ))

def generate_short_query(long_prompt):
    """Shorten a prompt for arXiv, robust to bad inputs like "[object Object]".

    Rules:
    - Never return empty; default to "research papers".
    - If already short (≤10 words), return sanitized input (≤80 chars).
    - Otherwise, deterministically compress to ≤8 words and ≤80 chars.
    """

    import json, re

    def normalize(s: str) -> str:
        return " ".join((s or "").strip().split())

    # 1) Coerce non-string inputs
    raw_in = long_prompt
    if isinstance(raw_in, dict):
        # try common fields
        for k in ("query", "text", "prompt", "q"):
            if isinstance(raw_in.get(k), str) and raw_in.get(k).strip():
                raw_in = raw_in.get(k)
                break
        else:
            # last resort stable JSON string
            raw_in = json.dumps(raw_in, ensure_ascii=False)
    elif isinstance(raw_in, (list, tuple)):
        raw_in = " ".join([str(x) for x in raw_in if x])
    else:
        raw_in = str(raw_in or "")

    raw = normalize(raw_in)
    bad_markers = {"[object object]", "undefined", "null"}
    if not raw or raw.lower() in bad_markers:
        return "research papers"

    # If already short (≤10 words), keep it
    words = raw.split()
    if len(words) <= 10:
        return raw[:80] or "research papers"

    # 2) Deterministic heuristic squeeze
    tokens = [t.lower() for t in re.findall(r"[A-Za-z0-9\-]+", raw)]
    stop = {
        "the","a","an","and","or","for","of","to","in","on","at","with",
        "using","based","via","from","by","about","into","over","under",
        "study","approach","method","paper","analysis","results","review","system",
        "new","novel","toward","towards"
    }
    filtered = [t for t in tokens if t not in stop and len(t) > 2]
    # Stable de-duplication preserving order
    seen = set(); squeezed = []
    for t in filtered or tokens:
        if t not in seen:
            seen.add(t)
            squeezed.append(t)
    short = " ".join(squeezed[:8]).strip()[:80]
    return short or "research papers"


#print(generate_short_query("artificial intelligence."))
