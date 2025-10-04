import React from "react";
import FeatureCards from "../components/FeatureCards";
import SearchBar from "../components/SearchBar";
import "./HomePage.css";

const HomePage = () => (
  <div className="homepage">
    <div className="hero-section">
      <h1 className="hero-title">
        Research<span className="blue-text">AI</span>
      </h1>
      <p className="hero-subtitle">
        Discover, analyze, and understand research papers with the power of AI. 
        Enter a topic or question to find relevant academic papers and get instant insights.
      </p>
      <div className="hero-stats">
        <div className="stat">
          <span className="stat-number">10K+</span>
          <span className="stat-label">Papers</span>
        </div>
        <div className="stat">
          <span className="stat-number">AI</span>
          <span className="stat-label">Analysis</span>
        </div>
        <div className="stat">
          <span className="stat-number">Free</span>
          <span className="stat-label">Access</span>
        </div>
      </div>
    </div>
    
    <div className="search-section">
      <SearchBar />
    </div>
    
    <div className="features-section">
      <h2 className="section-title">Why Choose ResearchAI?</h2>
      <FeatureCards />
    </div>
  </div>
);

export default HomePage;

