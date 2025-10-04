import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import "./SearchBar.css";

const SearchBar = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleInputChange = (event) => {
    setSearchTerm(event.target.value);
    setError("");
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
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
        body: JSON.stringify({ searchTerm: searchTerm.trim() }),
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
            disabled={isLoading}
            className="search-input"
          />
        </div>
        <button 
          className="search-button" 
          onClick={handleSearch}
          disabled={isLoading || !searchTerm.trim()}
        >
          {isLoading ? (
            <>
              <Loader2 className="loading-icon" size={18} />
              Searching...
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