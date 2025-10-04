import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SearchBar.css";

const SearchBar = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const handleInputChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleSearch = async () => {
    console.log("Searching for:", searchTerm);

    try {
      const response = await fetch("http://127.0.0.1:5001/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ searchTerm }),
      });

      const data = await response.json();
      console.log("Python Response:", data);

      if (data.results) {
        // Store results in localStorage (as JSON)
        localStorage.setItem("searchResult", JSON.stringify(data.results));
        navigate("/research");
      }
    } catch (error) {
      console.error("Error sending data to Python:", error);
    }
  };

  return (
    <div className="search-box">
      <h2>Search for Research Papers</h2>
      <p>Enter a research area</p>
      <div className="search-inputs">
        <input
          type="text"
          placeholder="Enter a research paper area"
          value={searchTerm}
          onChange={handleInputChange}
        />
        <button className="search-button" onClick={handleSearch}>
          Search Papers
        </button> 
      </div>
    </div>
  );
};

export default SearchBar;

<p>lorem
  
</p>