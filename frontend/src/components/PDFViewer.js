import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, FileText, Send, Loader2, AlertCircle } from "lucide-react";
import "./PDFViewer.css";

const PDFViewer = () => {
  const [activeTab, setActiveTab] = useState("analysis");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedText, setSelectedText] = useState("");
  const [analysis, setAnalysis] = useState("");
  
  const containerRef = useRef(null);
  const selectionTimeoutRef = useRef(null);
  const lastSentRef = useRef("");

  // PDF URL from backend
  const pdfUrl = "http://127.0.0.1:5001/pdf";

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

    const renderPDF = () => {
      const container = containerRef.current;
      if (!container) return;

      // Clear container
      container.innerHTML = "";

      // Use the exact same approach as the working HTML version
      window.pdfjsLib.getDocument(pdfUrl).promise.then(pdf => {
        console.log(`PDF loaded: ${pdf.numPages} pages`);
        
        for (let i = 1; i <= pdf.numPages; i++) {
          pdf.getPage(i).then(page => {
            const scale = 1.5;
            const viewport = page.getViewport({ scale });
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.style.width = viewport.width + 'px';
            pageDiv.style.height = viewport.height + 'px';
            container.appendChild(pageDiv);

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            pageDiv.appendChild(canvas);

            page.render({ canvasContext: canvas.getContext('2d'), viewport })
              .promise.then(() => page.getTextContent())
              .then(textContent => {
                const textLayer = document.createElement('div');
                textLayer.className = 'textLayer';
                pageDiv.appendChild(textLayer);
                window.pdfjsLib.renderTextLayer({
                  textContent, 
                  container: textLayer,
                  viewport, 
                  textDivs: []
                });
              });
          });
        }
      }).catch(error => {
        console.error('PDF load error:', error);
        setError('Failed to load PDF. Please check if the backend server is running.');
      });
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

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    
    // Add user message to chat history
    const newChatHistory = [...chatHistory, { type: "user", message: userMessage }];
    setChatHistory(newChatHistory);

    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:5001/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: userMessage }),
      });

      const data = await response.json();
      if (data.answer) {
        setChatHistory([...newChatHistory, { type: "bot", message: data.answer }]);
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

  const formatAnalysis = (text) => {
    return text
      .replace(/\*\*Operational Context\*\*/g, '<h4 style="margin:10px 0;color:#06b6d4">Operational Context</h4>')
      .replace(/\*\*Other Use-cases\*\*/g, '<h4 style="margin:10px 0;color:#06b6d4">Other Use-cases</h4>');
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
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;