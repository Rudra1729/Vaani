Inspiration
Every student we spoke to shared the same pain: research isn’t hard because of lack of content-it’s hard because of lack of time and the steep learning curve involved in learning how to read academic texts. You’re drowning in PDFs, skimming abstracts, and guessing which sections are relevant. We built Vaani to feel like a one-stop multilingual solution for all a person's research needs and to reduce the friction and inconvenience caused while reading research papers.

What it does
Discover the right papers quickly specific to your interest area Read smarter in a custom PDF viewer that anchors answers to exact pages and passages. Highlight any sentence; Vaani returns a two‑section, ultra‑concise contextual explanation (Operational Context + Other Use‑cases), linked to the research paper.

Ask questions in natural language; answers are grounded and this feature highlights the relevant parts and auto scrolls to make it convenient for you to find things in the paper.

Talk to Vaani: record voice queries, engage in meaningful discussion, get instant transcription, and hear streaming TTS responses regarding your question.

“Podcast Mode” for hands‑free research: wake‑word + voice activity detection = continuous, fluid Q&A. English↔️Hindi pathway so readers can understand cutting‑edge work in their comfortable language.

Intuitive mindmap graph for users to visualise and summarise whatever they just read in the research paper

How we built it
Frontend- React.js, Create React-app

PDF display + custom text‑overlay using pdf.js library.

Speech and voice interaction: Elevenlabs text to speech and speech to text API for english language. Google speech API for text to speech in Hindi.

Backend -Flask RESTFUL API for app routing Gemini API- For response and text generation , Chatbot RAG pipeline and for generating vector embeddings Chroma db-To store and retrieve vector embeddings. Vector similarity used for retrieval.

Challenges we ran into
Span‑level accuracy: Reassembling the PDF text layer to reliably locate snippet spans across mixed encodings and line wraps. Voice reliability in browsers: MIME detection, permissions UX, and mic stream cleanup across edge cases, ensuring contextual nuances in languages are captured. Wake‑word/VAD stability: Reducing false starts/ends with EMA smoothing, grace windows, and cooldowns. Ensuring high accuracy of responses

Accomplishments that we're proud of-
Page‑anchored answers that auto‑scroll and visually box the exact passage-trust built in milliseconds. A complete voice loop: Talk → transcribe → grounded answer → stream speech back-completely eliminates friction and improves usability. Hands‑free “Podcast Mode” that actually works live on PDFs. Strong UI. High accuracy of AI responses and low latency.

What we learned-
Importance of building a product that identifies user needs and builds something that solves a major pain point of users

How to increase accuracy and reducing latency for model responses.

Importance of UX and UI in maintaining a positive user experience and seamless integration.

What's next for Vaani-
More sources and better recall: arXiv + PubMed + OpenAlex, and user PDF libraries with on‑device caches. Rich citations/notes: one‑click exports, scholarly formats, Zotero/Mendeley integrations. Collaborative reading: shared highlights, comments, and study sessions. Multimodal understanding: figure/table Q&A and equation‑aware summaries.
