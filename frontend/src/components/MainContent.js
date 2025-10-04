import React from "react";
import FeatureCards from "./FeatureCards";
import SearchBar from "./SearchBar";
import "./MainContent.css";

const MainContent = () => (
  <main className="main">
    <h1>
      Research<span className="blue-text">AI</span>
    </h1>
    <p>
      Find and summarize research papers with the power of AI. Enter a topic or
      question to discover relevant academic papers and get instant summaries.
    </p>
    <FeatureCards />
    <SearchBar />
  </main>
);

export default MainContent;
