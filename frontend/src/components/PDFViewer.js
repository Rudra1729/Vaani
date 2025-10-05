import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, FileText, Send, Loader2, AlertCircle, Mic, Square, Share2 } from "lucide-react";
import "./PDFViewer.css";
import { useLanguage } from "../lang/LanguageContext";

const PDFViewer = () => {
  const [activeTab, setActiveTab] = useState("analysis");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedText, setSelectedText] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mindmapMd, setMindmapMd] = useState("");
  const [mindmapSummary, setMindmapSummary] = useState("");
  const [mindmapLoading, setMindmapLoading] = useState(false);
  const [mindmapError, setMindmapError] = useState("");
  const [graphData, setGraphData] = useState(null);
  
  const containerRef = useRef(null);
  const selectionTimeoutRef = useRef(null);
  const lastSentRef = useRef("");
  const renderInProgressRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const currentStreamRef = useRef(null);
  const audioRef = useRef(null);
  const currentAudioUrlRef = useRef(null);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const inactivityIntervalRef = useRef(null);
  const speakingActiveRef = useRef(false);
  const wakeStartedAtRef = useRef(0);
  const pendingSubmitRef = useRef(false);
  const utteranceRecRef = useRef(null);
  const utteranceTimerRef = useRef(null);
  const utteranceActiveRef = useRef(false);
  const utteranceFinalTextRef = useRef("");
  const [isUtteranceActive, setIsUtteranceActive] = useState(false);
  const postWakeActiveRef = useRef(false);
  const postWakeStreamRef = useRef(null);
  const postWakeRecorderRef = useRef(null);
  const postWakeChunksRef = useRef([]);
  const podcastStartingRef = useRef(false);
  const vadAudioCtxRef = useRef(null);
  const vadAnalyserRef = useRef(null);
  const vadDataArrayRef = useRef(null);
  const vadRAFRef = useRef(null);
  const vadHadSpeechRef = useRef(false);
  const vadSilenceStartRef = useRef(0);
  const [isPostWakeRecording, setIsPostWakeRecording] = useState(false);

  // Podcast Mode (VAD) state and controls
  const [isPodcastMode, setIsPodcastMode] = useState(false);
  const [isPodcastHindiMode, setIsPodcastHindiMode] = useState(false);
  // Hysteresis thresholds to reduce flicker: higher to start, lower to keep speaking
  const [vadStartThreshold, setVadStartThreshold] = useState(0.02);
  const [vadStopThreshold, setVadStopThreshold] = useState(0.01);
  // Timing tuned to avoid premature stops (allow longer pauses and longer utterances)
  const [vadMinSpeechMs, setVadMinSpeechMs] = useState(800);
  const [vadSilenceMs, setVadSilenceMs] = useState(2600);
  const vadSpeechStartRef = useRef(0);
  const ttsSuspendRef = useRef(false);
  const podcastModeRef = useRef(false);
  const podcastHindiModeRef = useRef(false);
  const vadRmsEmaRef = useRef(0);
  // Grace and cooldown windows to avoid chatter
  const [vadGraceMs, setVadGraceMs] = useState(600); // ignore brief dips right after speech starts
  const [vadCooldownMs, setVadCooldownMs] = useState(1000); // ignore starts shortly after an end
  const vadLastEndRef = useRef(0);
  const [vadMaxUtteranceMs, setVadMaxUtteranceMs] = useState(20000);

  const { t, language } = useLanguage();
  // PDF URL from backend
  const pdfUrl = "http://127.0.0.1:5001/pdf";
  const pageNumberToDivRef = useRef(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Initialize PDF.js and render PDF (using the exact working HTML approach)
  useEffect(() => {
    const initializePDF = () => {
      // Load PDF.js if not already loaded
      if (!window.pdfjsLib) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.min.js';
        script.onload = () => {
          renderPDF();
        };
        script.onerror = () => {
          setError("Failed to load PDF.js library");
        };
        document.head.appendChild(script);
      } else {
        renderPDF();
      }
    };

    const renderPDF = async () => {
      const container = containerRef.current;
      if (!container) return;

      // Prevent multiple simultaneous renders
      if (renderInProgressRef.current) {
        console.log('PDF render already in progress, skipping...');
        return;
      }

      renderInProgressRef.current = true;
      setIsRendering(true);
      setError("");

      try {
        // Clear container
        container.innerHTML = "";

        // Load PDF document
        const pdf = await window.pdfjsLib.getDocument(pdfUrl).promise;
        console.log(`PDF loaded: ${pdf.numPages} pages`);
        setTotalPages(pdf.numPages);
        pageNumberToDivRef.current.clear();
        
        // Create array to store page elements in correct order
        const pageElements = new Array(pdf.numPages);
        let completedPages = 0;

        // Render all pages with proper ordering
        for (let i = 1; i <= pdf.numPages; i++) {
          try {
            const page = await pdf.getPage(i);
            const scale = 1.5;
            const viewport = page.getViewport({ scale });
            
            // Create page container
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.style.width = viewport.width + 'px';
            pageDiv.style.height = viewport.height + 'px';
            pageDiv.setAttribute('data-page-number', i);

            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            pageDiv.appendChild(canvas);

            // Render page to canvas
            await page.render({ 
              canvasContext: canvas.getContext('2d'), 
              viewport 
            }).promise;

            // Add text layer
            const textContent = await page.getTextContent();
            const textLayer = document.createElement('div');
            textLayer.className = 'textLayer';
            pageDiv.appendChild(textLayer);
            
            window.pdfjsLib.renderTextLayer({
              textContent, 
              container: textLayer,
              viewport, 
              textDivs: []
            });

            // Store page element in correct position and map
            pageElements[i - 1] = pageDiv;
            pageNumberToDivRef.current.set(i, pageDiv);
            completedPages++;

            // Append pages in order as they complete
            if (completedPages === pdf.numPages) {
              // All pages completed, append them in order
              pageElements.forEach(pageElement => {
                if (pageElement) {
                  container.appendChild(pageElement);
                }
              });
              setIsRendering(false);
              // Scroll to first page after render
              setCurrentPage(1);
              try { pageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
            }

          } catch (pageError) {
            console.error(`Error rendering page ${i}:`, pageError);
            // Continue with other pages even if one fails
          }
        }

      } catch (error) {
        console.error('PDF load error:', error);
        setError('Failed to load PDF. Please check if the backend server is running.');
        setIsRendering(false);
      } finally {
        renderInProgressRef.current = false;
      }
    };

    initializePDF();
  }, []);

  // Handle text selection (exact same as working HTML version)
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text && text !== lastSentRef.current) {
      setSelectedText(text);
      
      // Debounce the API call
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      
      selectionTimeoutRef.current = setTimeout(() => {
        sendSelectionForAnalysis(text);
      }, 300);
    }
  };

  const sendSelectionForAnalysis = async (text) => {
    if (!text) return;

    lastSentRef.current = text;
    setLoading(true);
    setError("");
    // Also generate mindmap for selection in parallel
    try { sendSelectionForMindmap(text); } catch {}

    try {
      const response = await fetch("http://127.0.0.1:5001/process-selection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (error) {
      console.error("Error analyzing text:", error);
      setError("Failed to analyze text. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const sendSelectionForMindmap = async (text) => {
    try {
      setMindmapLoading(true);
      setMindmapError("");
      const res = await fetch("http://127.0.0.1:5001/mindmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data && (data.mindmap_md || data.summary)) {
        setMindmapMd(data.mindmap_md || "");
        setMindmapSummary(data.summary || "");
        setGraphData(data.graph || null);
      } else if (data && data.error) {
        setMindmapError(data.error);
      } else {
        setMindmapError("Failed to generate mind map.");
      }
    } catch (e) {
      setMindmapError("Mind map generation failed. Try again.");
    } finally {
      setMindmapLoading(false);
    }
  };

  const buildMindmapHtml = (md) => {
    const safeMd = (md || "- Mindmap\n  - No content");
    return `<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><style>
html,body{height:100%;margin:0;background:#0b1220;color:#e5e7eb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif}
#mind{width:100%;height:100vh}
.summary{padding:10px 14px;background:#0f172a;border-bottom:1px solid #1f2a44;color:#cbd5e1}
code,pre{color:inherit}
</style>
<script src=\"https://cdn.jsdelivr.net/npm/d3@7\"></script>
<script src=\"https://cdn.jsdelivr.net/npm/markmap-view@0.16.1\"></script>
<script src=\"https://cdn.jsdelivr.net/npm/markmap-lib@0.16.1/dist/browser/index.min.js\"></script></head>
<body>
<div id=\"mind\"></div>
<script>
  const md = ${JSON.stringify(safeMd)};
  window.addEventListener('DOMContentLoaded', () => {
    try {
      const { Transformer, Markmap } = window.markmap;
      const transformer = new Transformer();
      const { root } = transformer.transform(md);
      Markmap.create('#mind', undefined, root);
    } catch (e) {
      const el = document.getElementById('mind');
      if (el) {
        el.style.whiteSpace = 'pre-wrap';
        el.style.padding = '16px';
        el.textContent = md;
      }
    }
  });
</script>
</body></html>`;
  };

  const buildForceGraphHtml = (graph) => {
    const dataJson = JSON.stringify(graph || { nodes: [], links: [] });
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
html,body{height:100%;margin:0;background:#0b1220;color:#fff}
#wrap{position:relative;width:100%;height:100vh}
#graph{width:100%;height:100vh}
.label{font:12px system-ui;pointer-events:none;fill:#e5e7eb}
.hud{position:absolute;top:12px;right:12px;display:flex;gap:8px;z-index:10}
.hud button{background:#111827;color:#e5e7eb;border:1px solid #374151;border-radius:8px;padding:6px 10px;cursor:pointer}
.hud button:hover{background:#1f2937}
</style></head><body>
<div id="wrap">
  <svg id="graph"></svg>
  <div class="hud">
    <button id="zoomIn">Zoom +</button>
    <button id="zoomOut">Zoom -</button>
    <button id="reset">Reset</button>
    <button id="fs">Fullscreen</button>
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script>
const data=${dataJson};
const svg=d3.select('#graph');
const width=window.innerWidth,height=window.innerHeight;
svg.attr('viewBox',[0,0,width,height]);

// Zoom/Pan behavior
const zoom = d3.zoom().scaleExtent([0.2, 3]).on('zoom', (event)=>{
  g.attr('transform', event.transform);
});
svg.call(zoom);

// Root group
const g = svg.append('g');

// Compute degree map for sizing
const degree = {};
for (const n of data.nodes) degree[n.id] = 0;
for (const l of data.links) {
  const s = (typeof l.source === 'object') ? l.source.id : l.source;
  const t = (typeof l.target === 'object') ? l.target.id : l.target;
  if (s != null) degree[s] = (degree[s]||0) + 1;
  if (t != null) degree[t] = (degree[t]||0) + 1;
}

function nodeRadius(d){
  const deg = degree[d.id] || 0;
  const depth = (d.group || 0);
  const base = 8;
  const byDegree = Math.sqrt(deg + 1) * 4;
  const byDepth = Math.max(0, 3 - depth) * 2;
  return base + byDegree + byDepth;
}

function shortLabel(d){
  const raw = (d.label || d.id || '').trim();
  if (!raw) return d.id;
  const words = raw.split(/\s+/).slice(0,3).join(' ');
  return words.length > 28 ? words.slice(0,28) + '…' : words;
}

const link=g.append('g').attr('stroke','#394a6b').attr('stroke-opacity',0.7).selectAll('line').data(data.links).join('line').attr('stroke-width',d=>Math.sqrt(d.value||1));
const node=g.append('g').selectAll('g').data(data.nodes).join('g');
const simulation=d3.forceSimulation(data.nodes)
  .force('link', d3.forceLink(data.links).id(d=>d.id).distance(120).strength(0.8))
  .force('charge', d3.forceManyBody().strength(-220))
  .force('center', d3.forceCenter(width/2,height/2))
  .on('tick',()=>{
    link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
    node.attr('transform',d=>'translate(' + d.x + ',' + d.y + ')');
  });
node.append('circle').attr('r',d=>nodeRadius(d)).attr('fill',d=>d3.schemeTableau10[(d.group||0)%10]).call(drag(simulation));
node.append('text').attr('class','label').attr('x',12).attr('y',4).text(d=>shortLabel(d));
node.append('title').text(d=>d.label || d.id);
function drag(sim){
  function dragstarted(event){if(!event.active) sim.alphaTarget(0.3).restart(); event.subject.fx=event.subject.x; event.subject.fy=event.subject.y;}
  function dragged(event){event.subject.fx=event.x; event.subject.fy=event.y;}
  function dragended(event){if(!event.active) sim.alphaTarget(0); event.subject.fx=null; event.subject.fy=null;}
  return d3.drag().on('start',dragstarted).on('drag',dragged).on('end',dragended);
}

// HUD controls
document.getElementById('zoomIn').onclick = () => svg.transition().call(zoom.scaleBy, 1.2);
document.getElementById('zoomOut').onclick = () => svg.transition().call(zoom.scaleBy, 0.8);
document.getElementById('reset').onclick = () => svg.transition().call(zoom.transform, d3.zoomIdentity);
document.getElementById('fs').onclick = () => {
  const wrap = document.getElementById('wrap');
  if (!document.fullscreenElement) wrap.requestFullscreen().catch(()=>{}); else document.exitFullscreen().catch(()=>{});
};
</script>
</body></html>`;
  };

  // Auto-generate a full-paper mind map when the Visualization tab opens
  useEffect(() => {
    const run = async () => {
      if (activeTab !== 'viz') return;
      // Skip if we already generated and no selection change
      if (mindmapMd || mindmapLoading) return;
      try {
        setMindmapLoading(true);
        setMindmapError("");
        const res = await fetch("http://127.0.0.1:5001/mindmap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: 'document' })
        });
        const data = await res.json();
        if (data && (data.mindmap_md || data.summary)) {
          setMindmapMd(data.mindmap_md || "");
          setMindmapSummary(data.summary || "");
          setGraphData(data.graph || null);
        } else if (data && data.error) {
          setMindmapError(data.error);
        } else {
          setMindmapError("Failed to generate full-paper mind map.");
        }
      } catch (e) {
        setMindmapError("Mind map generation failed. Try again.");
      } finally {
        setMindmapLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Voice recording helpers
  const getSupportedMimeType = () => {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
      "audio/mpeg"
    ];
    for (const t of types) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return "audio/webm";
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Microphone not supported in this browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      currentStreamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          await sendAudioForTranscription(blob, mimeType);
        } catch (err) {
          console.error(err);
          setError("Failed to process recording.");
        } finally {
          if (currentStreamRef.current) {
            currentStreamRef.current.getTracks().forEach(t => t.stop());
            currentStreamRef.current = null;
          }
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      setError("Microphone permission denied or unavailable.");
    }
  };

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch {}
    setIsRecording(false);
  };

  const sendAudioForTranscription = async (blob, mimeType) => {
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : mimeType.includes("mpeg") ? "mp3" : "wav";
      form.append("audio", blob, `recording.${ext}`);
      form.append("language", "en");

      const res = await fetch("http://127.0.0.1:5001/transcribe", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data && data.text) {
        // Auto-ask the transcribed question
        await submitQuestion(data.text);
      } else if (data && data.error) {
        setError(data.error);
      } else {
        setError("Transcription failed. Try again.");
      }
    } catch (e) {
      console.error(e);
      setError("Failed to send audio for transcription.");
    } finally {
      setLoading(false);
    }
  };

  const sendAudioForTranscriptionHindi = async (blob, mimeType) => {
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : mimeType.includes("mpeg") ? "mp3" : "wav";
      form.append("audio", blob, `recording.${ext}`);
      form.append("language", "hi");

      const res = await fetch("http://127.0.0.1:5001/transcribe", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data && data.text) {
        // Route to Hindi ask
        await submitHindiQuestion(data.text);
      } else if (data && data.error) {
        setError(data.error);
      } else {
        setError("Transcription failed. Try again.");
      }
    } catch (e) {
      console.error(e);
      setError("Failed to send audio for transcription.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Podcast Mode (VAD) helpers ─────────────────────────────────────────────
  const computeRms = (buf) => {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i];
      sum += v * v;
    }
    return Math.sqrt(sum / Math.max(1, buf.length));
  };

  const startUtteranceRecording = (stream) => {
    if (!stream) return;
    if (postWakeRecorderRef.current && postWakeRecorderRef.current.state !== 'inactive') return;
    const mimeType = getSupportedMimeType();
    const options = mimeType ? { mimeType } : undefined;
    const rec = new MediaRecorder(stream, options);
    postWakeChunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) postWakeChunksRef.current.push(e.data);
    };
    rec.onerror = () => {
      try { rec.stop(); } catch {}
      setIsPostWakeRecording(false);
      try { postWakeRecorderRef.current = null; } catch {}
    };
    rec.onstop = async () => {
      try {
        const blob = new Blob(postWakeChunksRef.current, { type: mimeType || 'audio/webm' });
        if (podcastHindiModeRef.current) {
          await sendAudioForTranscriptionHindi(blob, mimeType || 'audio/webm');
        } else {
          await sendAudioForTranscription(blob, mimeType || 'audio/webm');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to process recorded utterance.');
      }
      setIsPostWakeRecording(false);
      try { postWakeRecorderRef.current = null; } catch {}
    };
    postWakeRecorderRef.current = rec;
    setIsPostWakeRecording(true);
    rec.start();
  };

  const stopUtteranceRecording = () => {
    try {
      if (postWakeRecorderRef.current && postWakeRecorderRef.current.state !== 'inactive') {
        postWakeRecorderRef.current.stop();
      }
    } catch {}
    try { postWakeRecorderRef.current = null; } catch {}
  };

  // Internal starter that spins up the shared VAD engine without touching language flags
  const internalStartPodcastVAD = async () => {
    try {
      if (podcastStartingRef.current) return;
      podcastStartingRef.current = true;
      // Disable browser SR auto-listen if active to avoid conflicts
      if (autoListenEnabled) stopAutoListen();
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Microphone not supported in this browser.');
        podcastStartingRef.current = false;
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      postWakeStreamRef.current = stream;

      // Web Audio setup
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      vadAudioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.04;
      source.connect(analyser);
      vadAnalyserRef.current = analyser;
      vadDataArrayRef.current = new Float32Array(analyser.fftSize);
      vadHadSpeechRef.current = false;
      vadSilenceStartRef.current = 0;
      vadSpeechStartRef.current = 0;

      const loop = () => {
        // Run while either English or Hindi podcast mode is active
        if (!(podcastModeRef.current || podcastHindiModeRef.current) || !vadAnalyserRef.current) return;
        try {
          vadAnalyserRef.current.getFloatTimeDomainData(vadDataArrayRef.current);
          const rms = computeRms(vadDataArrayRef.current);
          // Exponential moving average to stabilize VAD
          const alpha = 0.2;
          vadRmsEmaRef.current = alpha * rms + (1 - alpha) * (vadRmsEmaRef.current || rms);
          const now = performance.now();
          const speaking = vadHadSpeechRef.current
            ? vadRmsEmaRef.current >= vadStopThreshold
            : vadRmsEmaRef.current >= vadStartThreshold;

          if (speaking) {
            if (!vadHadSpeechRef.current) {
              // Rate-limit new utterances with cooldown
              if (vadLastEndRef.current && (now - vadLastEndRef.current) < vadCooldownMs) {
                // Do not start a new utterance yet
              } else {
              vadHadSpeechRef.current = true;
              vadSpeechStartRef.current = now;
              vadSilenceStartRef.current = 0;
              // Start an utterance recorder if not already
              if (!isPostWakeRecording) startUtteranceRecording(postWakeStreamRef.current);
              }
            }
          } else {
            if (vadHadSpeechRef.current) {
              // Grace period: ignore brief dips right after speech begins
              const sinceStart = now - (vadSpeechStartRef.current || now);
              if (sinceStart <= vadGraceMs) {
                // treat as speaking during grace
                vadSilenceStartRef.current = 0;
              } else {
                if (!vadSilenceStartRef.current) vadSilenceStartRef.current = now;
              }
              const speechMs = now - (vadSpeechStartRef.current || now);
              const silenceMs = now - (vadSilenceStartRef.current || now);
              const hitMax = speechMs >= vadMaxUtteranceMs;
              if ((silenceMs >= vadSilenceMs && speechMs >= vadMinSpeechMs) || hitMax) {
                // End utterance
                vadHadSpeechRef.current = false;
                vadSilenceStartRef.current = 0;
                vadSpeechStartRef.current = 0;
                vadLastEndRef.current = now;
                stopUtteranceRecording();
              }
            }
          }
        } catch {}
        vadRAFRef.current = requestAnimationFrame(loop);
      };
      vadRAFRef.current = requestAnimationFrame(loop);
      podcastStartingRef.current = false;
    } catch (err) {
      console.error(err);
      setError('Failed to start Podcast Mode.');
      await stopPodcastVAD();
      podcastStartingRef.current = false;
    }
  };

  // Watchdog: if Hindi Podcast is enabled but no analyser/stream, try restarting
  useEffect(() => {
    const id = setInterval(async () => {
      if (podcastHindiModeRef.current && (!vadAnalyserRef.current || !postWakeStreamRef.current)) {
        try {
          await internalStartPodcastVAD();
        } catch {}
      }
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // English entrypoint: ensure Hindi is off, stop any existing VAD, then start
  const startPodcastVAD = async () => {
    if (podcastStartingRef.current) return;
    try { await stopPodcastVAD(); } catch {}
    podcastHindiModeRef.current = false;
    setIsPodcastHindiMode(false);
    podcastModeRef.current = true;
    setIsPodcastMode(true);
    await internalStartPodcastVAD();
  };

  const stopPodcastVAD = async () => {
    podcastModeRef.current = false;
    setIsPodcastMode(false);
    try { if (vadRAFRef.current) cancelAnimationFrame(vadRAFRef.current); } catch {}
    vadRAFRef.current = null;
    // Stop any active utterance recording
    stopUtteranceRecording();
    postWakeRecorderRef.current = null;
    setIsPostWakeRecording(false);
    // Close audio context
    try { if (vadAudioCtxRef.current) await vadAudioCtxRef.current.close(); } catch {}
    vadAudioCtxRef.current = null;
    vadAnalyserRef.current = null;
    vadDataArrayRef.current = null;
    // Stop mic tracks
    try {
      if (postWakeStreamRef.current) {
        postWakeStreamRef.current.getTracks().forEach(t => t.stop());
      }
    } catch {}
    postWakeStreamRef.current = null;
  };

  // Suspend VAD/mic during TTS without turning Podcast Mode off
  const suspendPodcastVAD = async () => {
    // Keep Podcast Mode flags as-is (remain enabled)
    try { if (vadRAFRef.current) cancelAnimationFrame(vadRAFRef.current); } catch {}
    vadRAFRef.current = null;
    // Stop any active utterance recording
    stopUtteranceRecording();
    // Close audio context
    try { if (vadAudioCtxRef.current) await vadAudioCtxRef.current.close(); } catch {}
    vadAudioCtxRef.current = null;
    vadAnalyserRef.current = null;
    vadDataArrayRef.current = null;
    // Stop mic tracks
    try {
      if (postWakeStreamRef.current) {
        postWakeStreamRef.current.getTracks().forEach(t => t.stop());
      }
    } catch {}
    postWakeStreamRef.current = null;
  };

  // Hindi Podcast VAD flows reuse the same VAD engine but flip a flag
  const startPodcastHindiVAD = async () => {
    if (podcastStartingRef.current) return;
    try { await stopPodcastVAD(); } catch {}
    podcastModeRef.current = false;
    setIsPodcastMode(false);
    podcastHindiModeRef.current = true;
    setIsPodcastHindiMode(true);
    await internalStartPodcastVAD();
  };

  const stopPodcastHindiVAD = async () => {
    podcastHindiModeRef.current = false;
    setIsPodcastHindiMode(false);
    await stopPodcastVAD();
  };

  const submitQuestion = async (questionText) => {
    const trimmed = (questionText || "").trim();
    if (!trimmed) return;
    const newChatHistory = [...chatHistory, { type: "user", message: trimmed }];
    setChatHistory(newChatHistory);
    setChatInput("");

    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:5001/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await response.json();
      if (data.answer) {
        setChatHistory([...newChatHistory, { type: "bot", message: data.answer, page: data.page }]);
        if (data.page) {
          // Auto-scroll to cited page
          scrollToPage(data.page);
          // If a snippet is provided, attempt to highlight it briefly on the page
          if (data.snippet) {
            try {
              // Try precise span highlighting; if not found, try neighbors and token-based highlighting
              let ok = highlightBestContext(data.page, data.snippet, trimmed);
              // If still ambiguous and anchors available, probe anchors to disambiguate
              if (!ok && Array.isArray(data.anchors) && data.anchors.length) {
                for (const tri of data.anchors) {
                  if (highlightSnippetOnPage(data.page, tri)) { ok = true; break; }
                  if (highlightSnippetOnPage(Number(data.page) - 1, tri)) { scrollToPage(Number(data.page) - 1); ok = true; break; }
                  if (highlightSnippetOnPage(Number(data.page) + 1, tri)) { scrollToPage(Number(data.page) + 1); ok = true; break; }
                }
              }
              const pageDiv = pageNumberToDivRef.current.get(Number(data.page));
              if (pageDiv) {
                const textLayer = pageDiv.querySelector('.textLayer');
                if (textLayer && !textLayer.querySelector('.pdf-highlight') && !ok) {
                  const mark = document.createElement('div');
                  mark.className = 'snippet-flash';
                  mark.textContent = '';
                  textLayer.appendChild(mark);
                  setTimeout(() => { try { textLayer.removeChild(mark); } catch {} }, 1200);
                }
              }
            } catch {}
          }
        }
      } else if (data.error) {
        setChatHistory([...newChatHistory, { type: "error", message: data.error }]);
      }
    } catch (error) {
      console.error("Error asking question:", error);
      setChatHistory([...newChatHistory, { type: "error", message: "Failed to get answer. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const submitHindiQuestion = async (questionHindiText) => {
    const trimmed = (questionHindiText || "").trim();
    if (!trimmed) return;
    const newChatHistory = [...chatHistory, { type: "user", message: trimmed }];
    setChatHistory(newChatHistory);
    setChatInput("");

    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:5001/ask-hindi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question_hi: trimmed }),
      });
      const data = await response.json();
      if (data.answer_hi) {
        setChatHistory([...newChatHistory, { type: "bot", message: data.answer_hi, page: data.page }]);
        if (data.page) {
          scrollToPage(data.page);
        }
        // Speak in Hindi using TTS
        try { await playElevenLabs(data.answer_hi); } catch {}
      } else if (data.error) {
        setChatHistory([...newChatHistory, { type: "error", message: data.error }]);
      }
    } catch (error) {
      console.error("Error asking Hindi question:", error);
      setChatHistory([...newChatHistory, { type: "error", message: "Failed to get answer. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMessage = chatInput.trim();
    await submitQuestion(userMessage);
  };

  const formatAnalysis = (text) => {
    return text
      .replace(/\*\*Operational Context\*\*/g, '<h4 style="margin:10px 0;color:#06b6d4">Operational Context</h4>')
      .replace(/\*\*Other Use-cases\*\*/g, '<h4 style="margin:10px 0;color:#06b6d4">Other Use-cases</h4>');
  };

  // Initialize audio element for ElevenLabs playback
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }
    return () => {
      try {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        if (currentAudioUrlRef.current) {
          URL.revokeObjectURL(currentAudioUrlRef.current);
          currentAudioUrlRef.current = null;
        }
      } catch {}
    };
  }, []);

  // Auto-play ElevenLabs TTS for the latest bot reply
  useEffect(() => {
    const last = chatHistory[chatHistory.length - 1];
    if (last && last.type === "bot" && last.message) {
      playElevenLabs(last.message);
    }
  }, [chatHistory]);

  // Ensure only the active language's podcast mode remains enabled
  useEffect(() => {
    try {
      if (language === 'hi' && isPodcastMode) {
        stopPodcastVAD();
      }
      if (language !== 'hi' && isPodcastHindiMode) {
        stopPodcastHindiVAD();
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const playElevenLabs = async (text) => {
    if (!text || !audioRef.current) return;
    try {
      // Stop any ongoing playback and clean old URL
      try { audioRef.current.pause(); } catch {}
      // In Podcast Mode, suspend mic while TTS plays to avoid feedback
      if (isPodcastMode || isPodcastHindiMode) {
        ttsSuspendRef.current = true;
        try { await suspendPodcastVAD(); } catch {}
      }
      if (currentAudioUrlRef.current) {
        try { URL.revokeObjectURL(currentAudioUrlRef.current); } catch {}
        currentAudioUrlRef.current = null;
      }

      // Stream via GET to allow faster start (browser can stream progressively)
      const url = `http://127.0.0.1:5001/tts?` + new URLSearchParams({ text });
      // Set src directly for progressive playback
      audioRef.current.src = url;
      // When playback ends, resume Podcast Mode if it was active
      audioRef.current.onended = async () => {
        if ((podcastModeRef.current || podcastHindiModeRef.current) && ttsSuspendRef.current) {
          ttsSuspendRef.current = false;
          try {
            if (podcastHindiModeRef.current) {
              await startPodcastHindiVAD();
            } else if (podcastModeRef.current) {
              await startPodcastVAD();
            }
          } catch {}
        }
      };
      await audioRef.current.play().catch(() => {});
    } catch (e) {
      console.error("Failed to play ElevenLabs TTS:", e);
    }
  };

  // ─── Always-On Wake Word Listening ("hey vani" / "hey vaani") ───────────────
  const [autoListenEnabled, setAutoListenEnabled] = useState(false);
  const wakeStateRef = useRef({ wakeDetected: false, buffer: "", lastHeardAt: 0 });
  const [wakePreset, setWakePreset] = useState("hey vaani");
  const [customWake, setCustomWake] = useState("");

  const supportsSpeechRecognition = () => {
    return typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  };

  const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // Convert a phrase like "hey vaani" into a tolerant regex allowing repeated vowels and small variations
  const phraseToRegex = (phrase) => {
    const words = normalize(phrase).split(' ').filter(Boolean);
    const parts = words.map(w => {
      // allow repeated vowels and minor variations for the wake name
      const flexible = w
        .replace(/a/g, 'a+')
        .replace(/e/g, 'e+')
        .replace(/i/g, 'i+')
        .replace(/o/g, 'o+')
        .replace(/u/g, 'u+');
      return flexible;
    });
    return new RegExp("\\b" + parts.join("\\s+") + "\\b", 'i');
  };

  const getWakeRegexes = () => {
    const presets = [];
    if (wakePreset === 'hey vaani') presets.push('hey vaani', 'hey vani');
    if (wakePreset === 'okay vaani') presets.push('okay vaani', 'ok vaani', 'okay vani', 'ok vani');
    if (wakePreset === 'hey research') presets.push('hey research');
    if (wakePreset === 'custom' && customWake.trim()) presets.push(customWake.trim());
    // Fallback to default if empty
    if (presets.length === 0) presets.push('hey vaani');
    return presets.map(phraseToRegex);
  };

  // Scroll helper to bring a given page into view
  const scrollToPage = (pageNum) => {
    if (!pageNum) return;
    const num = Number(pageNum);
    if (!num || Number.isNaN(num)) return;
    const div = pageNumberToDivRef.current.get(num);
    if (div) {
      try { div.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
      setCurrentPage(num);
    }
  };

  // Highlight snippet text on a given page by matching spans in the text layer
  // Build a searchable index for a textLayer
  const buildSpanIndex = (textLayer) => {
    const spans = Array.from(textLayer.querySelectorAll('span'));
    const lowerTexts = spans.map(s => (s.textContent || '').toLowerCase());
    const joined = lowerTexts.join(' ');
    const starts = [];
    let cur = 0;
    for (let i = 0; i < lowerTexts.length; i++) {
      starts.push(cur);
      cur += lowerTexts[i].length + (i === lowerTexts.length - 1 ? 0 : 1);
    }
    return { spans, lowerTexts, joined, starts };
  };

  const selectSpansForRange = (index, startIdx, endIdx) => {
    const selected = [];
    for (let i = 0; i < index.spans.length; i++) {
      const sStart = index.starts[i];
      const sEnd = sStart + index.lowerTexts[i].length;
      const overlap = Math.max(0, Math.min(sEnd, endIdx) - Math.max(sStart, startIdx));
      if (overlap >= Math.min(6, index.lowerTexts[i].length)) {
        selected.push(index.spans[i]);
      }
    }
    return selected;
  };

  const highlightSnippetOnPage = (pageNum, snippet) => {
    const num = Number(pageNum);
    if (!num || !snippet) return;
    const pageDiv = pageNumberToDivRef.current.get(num);
    if (!pageDiv) return;
    const textLayer = pageDiv.querySelector('.textLayer');
    if (!textLayer) return;
    const target = (snippet || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!target) return false;
    try {
      const index = buildSpanIndex(textLayer);
      const maxLen = Math.min(target.length, 220);
      const searchStr = target.slice(0, maxLen);
      const idx = index.joined.indexOf(searchStr);
      // Clear previous highlights
      index.spans.forEach(s => s.classList.remove('pdf-highlight'));
      if (idx === -1) return false;
      const endIdx = idx + searchStr.length;
      const selectedSpans = selectSpansForRange(index, idx, endIdx);
      if (!selectedSpans.length) return false;
      selectedSpans.forEach(s => s.classList.add('pdf-highlight'));
      // Auto-clear after a few seconds
      setTimeout(() => index.spans.forEach(s => s.classList.remove('pdf-highlight')), 4000);

      // Draw bounding boxes around union of selected spans
      if (selectedSpans.length) {
        const overlay = ensureBoxOverlay(pageDiv);
        drawBoundingBox(overlay, selectedSpans);
      }
      return true;
    } catch {}
    return false;
  };

  const highlightByTokens = (pageNum, query) => {
    const num = Number(pageNum);
    if (!num || !query) return false;
    const pageDiv = pageNumberToDivRef.current.get(num);
    if (!pageDiv) return false;
    const textLayer = pageDiv.querySelector('.textLayer');
    if (!textLayer) return false;
    const tokens = (query.toLowerCase().match(/[a-z0-9]{3,}/g) || []).slice(0, 6);
    if (!tokens.length) return false;
    const spans = Array.from(textLayer.querySelectorAll('span'));
    spans.forEach(s => s.classList.remove('pdf-highlight'));
    let count = 0;
    const selectedSpans = [];
    for (const s of spans) {
      const t = (s.textContent || '').toLowerCase();
      if (tokens.some(tok => t.includes(tok))) {
        s.classList.add('pdf-highlight');
        count++;
        selectedSpans.push(s);
      }
      if (count > 60) break; // safety cap
    }
    if (count > 0) {
      setTimeout(() => spans.forEach(s => s.classList.remove('pdf-highlight')), 4000);
      const overlay = ensureBoxOverlay(pageDiv);
      drawBoundingBox(overlay, selectedSpans);
      return true;
    }
    return false;
  };

  const highlightBestContext = (page, snippet, query) => {
    // Try stated page
    if (highlightSnippetOnPage(page, snippet)) return true;
    // Try neighbors with snippet
    if (highlightSnippetOnPage(Number(page) - 1, snippet)) {
      scrollToPage(Number(page) - 1);
      return true;
    }
    if (highlightSnippetOnPage(Number(page) + 1, snippet)) {
      scrollToPage(Number(page) + 1);
      return true;
    }
    // Token fallback on page and neighbors
    if (highlightByTokens(page, query)) return true;
    if (highlightByTokens(Number(page) - 1, query)) {
      scrollToPage(Number(page) - 1);
      return true;
    }
    if (highlightByTokens(Number(page) + 1, query)) {
      scrollToPage(Number(page) + 1);
      return true;
    }
    return false;
  };

  // Ensure a positioned overlay div for drawing boxes exists on a page
  const ensureBoxOverlay = (pageDiv) => {
    let overlay = pageDiv.querySelector('.box-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'box-overlay';
      pageDiv.appendChild(overlay);
    }
    // Clear previous boxes
    Array.from(overlay.querySelectorAll('.pdf-box')).forEach(el => el.remove());
    return overlay;
  };

  // Draw a single bounding box around the union rect of selected spans
  const drawBoundingBox = (overlay, spans) => {
    if (!overlay || !spans || !spans.length) return;
    const rects = spans.map(s => s.getBoundingClientRect());
    const overlayRect = overlay.getBoundingClientRect();
    const minLeft = Math.min(...rects.map(r => r.left));
    const minTop = Math.min(...rects.map(r => r.top));
    const maxRight = Math.max(...rects.map(r => r.right));
    const maxBottom = Math.max(...rects.map(r => r.bottom));
    const box = document.createElement('div');
    box.className = 'pdf-box';
    box.style.left = `${minLeft - overlayRect.left}px`;
    box.style.top = `${minTop - overlayRect.top}px`;
    box.style.width = `${maxRight - minLeft}px`;
    box.style.height = `${maxBottom - minTop}px`;
    overlay.appendChild(box);
    setTimeout(() => { try { box.remove(); } catch {} }, 4200);
  };

  const startAutoListen = () => {
    if (!supportsSpeechRecognition()) {
      setError("Auto-listen not supported in this browser.");
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    const scheduleSilenceSubmit = (delayMs) => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(async () => {
        if (!wakeStateRef.current.wakeDetected || !wakeStateRef.current.buffer) return;
        if (pendingSubmitRef.current) return;
        pendingSubmitRef.current = true;
        const toAsk = wakeStateRef.current.buffer.trim();
        wakeStateRef.current.wakeDetected = false;
        wakeStateRef.current.buffer = "";
        try { await submitQuestion(toAsk); } catch {}
        pendingSubmitRef.current = false;
      }, Math.max(0, delayMs || 0));
    };

    // Single-utterance recognition helpers
    const stopUtteranceRecognition = () => {
      try { if (utteranceRecRef.current) utteranceRecRef.current.stop(); } catch {}
      if (utteranceTimerRef.current) clearTimeout(utteranceTimerRef.current);
      utteranceActiveRef.current = false;
      setIsUtteranceActive(false);
    };

    const startUtteranceRecognition = () => {
      if (utteranceActiveRef.current) return;
      const SR2 = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec2 = new SR2();
      rec2.lang = 'en-US';
      rec2.continuous = false; // stop on pause
      rec2.interimResults = true;
      utteranceRecRef.current = rec2;
      utteranceActiveRef.current = true;
      setIsUtteranceActive(true);
      utteranceFinalTextRef.current = "";

      let latestTranscript = "";
      rec2.onresult = (evt) => {
        let full = "";
        for (let i = evt.resultIndex; i < evt.results.length; i++) {
          full += evt.results[i][0].transcript;
          if (evt.results[i].isFinal) {
            utteranceFinalTextRef.current = full;
          }
        }
        latestTranscript = full;
      };

      rec2.onend = async () => {
        const chosen = (utteranceFinalTextRef.current || latestTranscript || "").trim();
        stopUtteranceRecognition();
        if (chosen) {
          wakeStateRef.current.wakeDetected = false;
          wakeStateRef.current.buffer = '';
          try { await submitQuestion(chosen); } catch {}
        } else {
          // No speech captured; just reset wake
          wakeStateRef.current.wakeDetected = false;
          wakeStateRef.current.buffer = '';
        }
        if (autoListenEnabled) {
          try { recognition.start(); } catch {}
        }
      };

      // Safety cutoff in case the API hangs
      if (utteranceTimerRef.current) clearTimeout(utteranceTimerRef.current);
      utteranceTimerRef.current = setTimeout(() => {
        stopUtteranceRecognition();
      }, 12000);

      try { rec2.start(); } catch {}
    };

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        transcript += res[0].transcript;
      }
      const lower = normalize(transcript);
      const now = Date.now();
      // Check against selected/custom phrases
      const wakeRegexes = getWakeRegexes();
      const match = wakeRegexes.map(r => lower.match(r)).find(Boolean);
      const containsWake = Boolean(match);

      // Any audible result updates last heard time
      wakeStateRef.current.lastHeardAt = now;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      if (!wakeStateRef.current.wakeDetected) {
        if (containsWake) {
          wakeStateRef.current.wakeDetected = true;
          wakeStartedAtRef.current = now;
          // Stop base recognition and run a single-utterance capture that ends on silence
          try { recognition.stop(); } catch {}
          startUtteranceRecognition();
        }
      }
      // Prefer final results as a cue to submit soon
      const hasFinal = Array.from(event.results).some(r => r.isFinal);
      // No-op: single-utterance capture handles submission
    };

    recognition.onspeechstart = () => {
      speakingActiveRef.current = true;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    recognition.onspeechend = () => {
      speakingActiveRef.current = false;
      // handled by single-utterance capture
    };

    recognition.onsoundend = () => {
      // handled by single-utterance capture
    };

    recognition.onaudioend = () => {
      // handled by single-utterance capture
    };

    recognition.onend = () => {
      // Auto-restart while enabled
      if (autoListenEnabled) {
        try { recognition.start(); } catch {}
      }
    };

    recognition.onerror = () => {
      // brief backoff and restart
      if (autoListenEnabled) {
        setTimeout(() => {
          try { recognition.start(); } catch {}
        }, 500);
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch {}
    setAutoListenEnabled(true);

    // Fallback inactivity checker: if we haven't heard anything for 1.2s after wake, submit
    if (inactivityIntervalRef.current) clearInterval(inactivityIntervalRef.current);
    inactivityIntervalRef.current = setInterval(() => {
      if (!autoListenEnabled) return;
      const nowTs = Date.now();
      // If single-utterance capture isn't active and wake detected, fallback submit on inactivity
      if (wakeStateRef.current.wakeDetected && !utteranceActiveRef.current) {
        if (nowTs - (wakeStateRef.current.lastHeardAt || 0) > 1500 && !pendingSubmitRef.current) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          pendingSubmitRef.current = true;
          const toAsk = (wakeStateRef.current.buffer || '').trim();
          wakeStateRef.current.wakeDetected = false;
          wakeStateRef.current.buffer = '';
          submitQuestion(toAsk).finally(() => { pendingSubmitRef.current = false; });
        }
      }
      // Safety cutoff: if wake active for too long without input, reset
      if (wakeStartedAtRef.current && nowTs - wakeStartedAtRef.current > 15000) {
        wakeStateRef.current.wakeDetected = false;
        wakeStateRef.current.buffer = '';
        wakeStartedAtRef.current = 0;
      }
    }, 400);
  };

  const stopAutoListen = () => {
    setAutoListenEnabled(false);
    try { if (recognitionRef.current) recognitionRef.current.stop(); } catch {}
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (inactivityIntervalRef.current) clearInterval(inactivityIntervalRef.current);
    wakeStateRef.current = { wakeDetected: false, buffer: "", lastHeardAt: 0 };
    speakingActiveRef.current = false;
    pendingSubmitRef.current = false;
    wakeStartedAtRef.current = 0;
  };

  // Add event listeners for text selection (same as working HTML version)
  useEffect(() => {
    const handleSelectionChange = () => {
      clearTimeout(selectionTimeoutRef.current);
      selectionTimeoutRef.current = setTimeout(() => {
        const sel = window.getSelection().toString().trim();
        if (sel && sel !== lastSentRef.current) {
          setSelectedText(sel);
          sendSelectionForAnalysis(sel);
        }
      }, 300);
    };

    const handleMouseUp = () => {
      clearTimeout(selectionTimeoutRef.current);
      const sel = window.getSelection().toString().trim();
      if (sel && sel !== lastSentRef.current) {
        setSelectedText(sel);
        sendSelectionForAnalysis(sel);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleMouseUp);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="pdf-viewer-container">
      <div className="pdf-viewer-main">
        {/* PDF Display - using exact same structure as working HTML */}
        <div className="pdf-display" onMouseUp={handleTextSelection}>
          <div className="page-nav">
            <button
              type="button"
              className="page-btn"
              onClick={() => {
                const prev = Math.max(1, currentPage - 1);
                setCurrentPage(prev);
                const div = pageNumberToDivRef.current.get(prev);
                if (div) try { div.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
              }}
            >
              ←
            </button>
            <span className="page-info-small">Page {currentPage} / {totalPages}</span>
            <button
              type="button"
              className="page-btn"
              onClick={() => {
                const next = Math.min(totalPages || currentPage, currentPage + 1);
                setCurrentPage(next);
                const div = pageNumberToDivRef.current.get(next);
                if (div) try { div.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
              }}
            >
              →
            </button>
          </div>
          {error ? (
            <div className="pdf-error">
              <AlertCircle size={48} />
              <h3>Error Loading PDF</h3>
              <p>{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="retry-btn"
              >
                Retry
              </button>
            </div>
          ) : isRendering ? (
            <div className="pdf-loading">
              <Loader2 size={48} className="loading-spinner" />
              <h3>Loading PDF</h3>
              <p>Rendering pages...</p>
            </div>
          ) : (
            <div ref={containerRef} className="pdf-container" />
          )}
        </div>
      </div>

      {/* Sidebar - same structure as working HTML */}
      <div className="pdf-sidebar">
        <div className="sidebar-tabs">
          <button
            className={`tab-btn ${activeTab === "analysis" ? "active" : ""}`}
            onClick={() => setActiveTab("analysis")}
          >
            <FileText size={18} />
            Text Analysis
          </button>
          <button
            className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            <MessageSquare size={18} />
            Chatbot
          </button>
          <button
            className={`tab-btn ${activeTab === "viz" ? "active" : ""}`}
            onClick={() => setActiveTab("viz")}
          >
            <Share2 size={18} />
            Visualization
          </button>
        </div>

        <div className="tab-content">
          {activeTab === "analysis" && (
            <div className="analysis-tab">
              {selectedText ? (
                <div className="analysis-result">
                  <div className="selected-text">
                    <h4>Selected Text:</h4>
                    <p className="selected-text-content">"{selectedText}"</p>
                  </div>
                  
                  {loading && (
                    <div className="analysis-loading">
                      <Loader2 size={20} className="loading-spinner" />
                      <span>Analyzing...</span>
                    </div>
                  )}
                  
                  {analysis && !loading && (
                    <div 
                      className="analysis-content"
                      dangerouslySetInnerHTML={{ __html: formatAnalysis(analysis) }}
                    />
                  )}
                  
                  {error && (
                    <div className="analysis-error">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-selection">
                  <FileText size={48} className="no-selection-icon" />
                  <h3>Select Text to Analyze</h3>
                  <p>Highlight any text in the PDF to get AI-powered analysis and insights.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "chat" && (
            <div className="chat-tab">
              <div className="chat-history">
                {chatHistory.length === 0 ? (
                  <div className="no-chat">
                    <MessageSquare size={48} className="no-chat-icon" />
                    <h3>Start a Conversation</h3>
                    <p>Ask questions about the document content.</p>
                  </div>
                ) : (
                  chatHistory.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.type}`}>
                      <div className="message-content">
                        {msg.type === "user" && <strong>You:</strong>}
                        {msg.type === "bot" && <strong>AI:</strong>}
                        {msg.type === "error" && <AlertCircle size={16} />}
                        <span>{msg.message}</span>
                      </div>
                    </div>
                  ))
                )}
                {loading && (
                  <div className="chat-loading">
                    <Loader2 size={16} className="loading-spinner" />
                    <span>AI is thinking...</span>
                  </div>
                )}
              </div>

              <div className="chat-controls-row">
                <button
                  type="button"
                  aria-label={isRecording ? "Stop recording" : "Start recording"}
                  className={`chat-mic-btn ${isRecording ? 'recording' : ''}`}
                  disabled={loading}
                  onClick={() => (isRecording ? stopRecording() : startRecording())}
                >
                  {isRecording ? <Square size={16} /> : <Mic size={16} />}
                </button>

                {language === 'hi' ? (
                  <button
                    type="button"
                    aria-label={isPodcastHindiMode ? "Disable Hindi Podcast" : "Enable Hindi Podcast"}
                    className={`podcast-btn hindi ${isPodcastHindiMode ? 'enabled' : ''}`}
                    onClick={() => (isPodcastHindiMode ? stopPodcastHindiVAD() : startPodcastHindiVAD())}
                  >
                    {isPodcastHindiMode ? 'Podcast (हिंदी): On' : 'Podcast (हिंदी): Off'}
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={isPodcastMode ? "Disable Podcast Mode" : "Enable Podcast Mode"}
                    className={`podcast-btn ${isPodcastMode ? 'enabled' : ''}`}
                    onClick={() => (isPodcastMode ? stopPodcastVAD() : startPodcastVAD())}
                  >
                    {isPodcastMode ? 'Podcast: On' : 'Podcast: Off'}
                  </button>
                )}

                {isRecording && (
                  <div className="listening-indicator">
                    <span className="dot" />
                    Listening...
                  </div>
                )}
                {isPostWakeRecording && (
                  <div className="listening-indicator" style={{ color: '#10b981' }}>
                    <span className="dot" style={{ background: '#10b981' }} />
                    Recording question…
                  </div>
                )}
              </div>
              
              <form onSubmit={handleChatSubmit} className="chat-input-form">
                <div className="chat-input-wrapper">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask a question about the document..."
                    disabled={loading}
                    className="chat-input"
                  />
                  <button 
                    type="submit" 
                    disabled={loading || !chatInput.trim()}
                    className="chat-send-btn"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "viz" && (
            <div className="visualization-tab">
              <div className="viz-result">
                <div className="no-selection">
                  <Share2 size={48} className="no-selection-icon" />
                  <h3>Visualization</h3>
                  <p>Full-paper graph is generated automatically.</p>
                  {selectedText && (
                    <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#6b7280' }}>
                      Selection-based graph will reflect your current selection
                    </p>
                  )}
                </div>
                {mindmapLoading && (
                  <div className="analysis-loading" style={{ marginTop: '1rem' }}>
                    <Loader2 size={20} className="loading-spinner" />
                    <span>Generating mind map...</span>
                  </div>
                )}
                {mindmapError && (
                  <div className="analysis-error" style={{ marginTop: '1rem' }}>
                    <AlertCircle size={16} />
                    {mindmapError}
                  </div>
                )}
                {graphData && !mindmapLoading && (
                  <div>
                    <div style={{ marginBottom: '1rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '4px', borderLeft: '3px solid #10b981' }}>
                      <strong>Graph View</strong>
                    </div>
                    <iframe
                      title="Graph View"
                      className="mindmap-iframe"
                      sandbox="allow-scripts allow-same-origin"
                      srcDoc={buildForceGraphHtml(graphData)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;