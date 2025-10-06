import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, Mic, MicOff, Square } from "lucide-react";
import "./SearchBar.css";
import { useLanguage } from "../lang/LanguageContext";

const SearchBar = ({ showMic = true }) => {
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState(null);
  const navigate = useNavigate();
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const currentMimeTypeRef = useRef(null);

  const handleInputChange = (event) => {
    setSearchTerm(event.target.value);
    setError("");
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  const handleSearch = async (searchQuery = null) => {
    // Normalize incoming query to a string before trimming
    const raw = (searchQuery !== null && searchQuery !== undefined) ? searchQuery : searchTerm;
    const queryToUse = (typeof raw === 'string'
      ? raw
      : (raw && typeof raw.text === 'string'
        ? raw.text
        : String(raw || '')));
    console.log("Searching with query:", queryToUse);

      if (!queryToUse || !queryToUse.trim()) {
      setError(t('search.noTerm'));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("https://vani-backend-311709302102.europe-west1.run.app/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ searchTerm: queryToUse.trim() }),
      });

      const data = await response.json();
      console.log("Search Response:", data);

      if (data.results && data.results.length > 0) {
        // Persist both results and the original search term for display on results page
        try {
          localStorage.setItem("searchResult", JSON.stringify(data.results));
          let persistedRaw = (typeof data.user_prompt === 'string' && data.user_prompt.trim())
            ? data.user_prompt.trim()
            : queryToUse.trim();
          if (typeof persistedRaw !== 'string') {
            persistedRaw = (persistedRaw && typeof persistedRaw.text === 'string') ? persistedRaw.text : String(persistedRaw);
          }
          // Remove stray wrapping quotes if any
          const persisted = persistedRaw.replace(/^"|"$/g, '');
          localStorage.setItem("lastSearchTerm", persisted);
        } catch {}
        navigate("/research");
      } else {
        setError(t('search.noResults'));
      }
    } catch (error) {
      console.error("Error searching papers:", error);
      setError(t('search.fail'));
    } finally {
      setIsLoading(false);
    }
  };

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      currentMimeTypeRef.current = mimeType;
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        try {
          const usedType = currentMimeTypeRef.current || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: usedType });
          await transcribeAudio(audioBlob, usedType);
        } finally {
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setError("");
      console.log("Recording started with:", mimeType);
    } catch (error) {
      console.error("Error starting recording:", error);
      setError("Failed to access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob, mimeType) => {
    setIsTranscribing(true);
    setError("");

    try {
      const formData = new FormData();
      const mt = (mimeType || audioBlob?.type || '').toLowerCase();
      const ext = mt.includes('webm') ? 'webm' : mt.includes('ogg') ? 'ogg' : mt.includes('mp4') ? 'm4a' : mt.includes('mpeg') ? 'mp3' : 'wav';
      formData.append('audio', audioBlob, `recording.${ext}`);
      formData.append('language', 'en');

      const response = await fetch("https://vani-backend-311709302102.europe-west1.run.app/transcribe", {
        method: "POST",
        body: formData,
      });

      let data;
      if (!response.ok) {
        // Try to extract a meaningful server error message
        try {
          const maybeJson = await response.json();
          const serverMsg = (maybeJson && (maybeJson.error || maybeJson.message)) || '';
          throw new Error(serverMsg ? `${response.status} ${serverMsg}` : `HTTP ${response.status}`);
        } catch (e) {
          // If body isn't JSON, fall back to text
          try {
            const txt = await response.text();
            throw new Error(txt ? `${response.status} ${txt}` : `HTTP ${response.status}`);
          } catch {
            throw new Error(`HTTP ${response.status}`);
          }
        }
      } else {
        data = await response.json();
      }
      console.log("Transcription response:", data);
      
      // Check if we have a valid transcription
      if (data.text && data.text.trim().length > 0) {
        const transcribedText = data.text.trim();
        setSearchTerm(transcribedText);
        setTranscriptionResult(data);
        // Automatically search with transcribed text directly
        handleSearch(transcribedText);
      } else if (data.error) {
        setError(`Transcription error: ${data.error}`);
      } else {
        setError("No speech detected. Please try speaking more clearly.");
      }
    } catch (error) {
      console.error("Error transcribing audio:", error);
      if (error.message.includes('Failed to fetch')) {
        setError("Cannot connect to server. Please make sure the backend is running.");
      } else {
        setError(`Failed to transcribe audio: ${error.message}`);
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="search-container">
      <div className="search-header">
        <h2>{t('search.heading')}</h2>
        <p>{t('search.subheading')}</p>
      </div>
      
      <div className="search-input-container">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder={t('search.placeholder')}
            value={searchTerm}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={isLoading || isTranscribing}
            className="search-input"
          />
          {showMic && (
            <button
              className={`mic-button ${isRecording ? 'recording' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading || isTranscribing}
              title={isRecording ? "Stop recording" : "Start voice recording"}
            >
              {isRecording ? (
                <Square size={18} />
              ) : (
                <Mic size={18} />
              )}
            </button>
          )}
        </div>
        <button 
          className="search-button" 
          onClick={handleSearch}
          disabled={isLoading || !searchTerm.trim() || isTranscribing}
        >
          {isLoading ? (
            <>
              <Loader2 className="loading-icon" size={18} />
              {t('search.loading')}
            </>
          ) : isTranscribing ? (
            <>
              <Loader2 className="loading-icon" size={18} />
              {t('search.transcribing')}
            </>
          ) : (
            t('search.button')
          )}
        </button>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
          
        </div>
      )}

      {transcriptionResult && (
        <div className="transcription-result">
          <p><strong>Transcribed:</strong> "{transcriptionResult.text}"</p>
          <p><strong>Confidence:</strong> {Math.round((transcriptionResult.confidence || 0) * 100)}%</p>
        </div>
      )}
      
      <div className="search-suggestions">
        <p>{t('search.popular')}</p>
        <div className="suggestion-tags">
          <button 
            className="suggestion-tag"
            onClick={() => setSearchTerm("machine learning")}
          >
            machine learning
          </button>
          <button 
            className="suggestion-tag"
            onClick={() => setSearchTerm("artificial intelligence")}
          >
            artificial intelligence
          </button>
          <button 
            className="suggestion-tag"
            onClick={() => setSearchTerm("natural language processing")}
          >
            natural language processing
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;