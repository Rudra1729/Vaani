import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, Mic, MicOff, Square } from "lucide-react";
import "./SearchBar.css";

const SearchBar = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState(null);
  const navigate = useNavigate();
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

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
    const queryCandidate = typeof searchQuery === 'string' ? searchQuery : searchTerm;
    const queryToUse = (queryCandidate || '').toString();
    console.log("Searching with query:", queryToUse);
    
    if (!queryToUse.trim()) {
      setError("Please enter a search term");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("http://127.0.0.1:5001/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ searchTerm: queryToUse.trim() }),
      });

      const data = await response.json();
      console.log("Search Response:", data);

      if (data.results && data.results.length > 0) {
        localStorage.setItem("searchResult", JSON.stringify(data.results));
        navigate("/research");
      } else {
        setError("No papers found for your search. Try different keywords.");
      }
    } catch (error) {
      console.error("Error searching papers:", error);
      setError("Failed to search papers. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        console.log("Audio data received:", event.data.size, "bytes");
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        console.log("Recording stopped, total chunks:", audioChunksRef.current.length);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        console.log("Audio blob size:", audioBlob.size, "bytes");
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setError("");
      console.log("Recording started");
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

  const transcribeAudio = async (audioBlob) => {
    setIsTranscribing(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      const response = await fetch("http://127.0.0.1:5001/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
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
        <h2>Discover Research Papers</h2>
        <p>Find and analyze academic papers with AI-powered insights</p>
      </div>
      
      <div className="search-input-container">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Enter your research topic or question..."
            value={searchTerm}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={isLoading || isTranscribing}
            className="search-input"
          />
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
        </div>
        <button 
          className="search-button" 
          onClick={handleSearch}
          disabled={isLoading || !searchTerm.trim() || isTranscribing}
        >
          {isLoading ? (
            <>
              <Loader2 className="loading-icon" size={18} />
              Searching...
            </>
          ) : isTranscribing ? (
            <>
              <Loader2 className="loading-icon" size={18} />
              Transcribing...
            </>
          ) : (
            "Search Papers"
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
        <p>Popular searches:</p>
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