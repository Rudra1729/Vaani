import React from "react";
import "./FeatureCards.css";

const FeatureCards = () => (
  <div className="features">
    <FeatureCard icon="🔍" title="Semantic Search" description="Find papers based on concepts, not just keywords" />
    <FeatureCard icon="📄" title="AI Summaries" description="Get concise summaries of complex research papers" />
    <FeatureCard icon="📚" title="Citation Export" description="Export citations in multiple formats" />
  </div>
);

const FeatureCard = ({ icon, title, description }) => (
  <div className="feature-card">
    <span className="icon">{icon}</span>
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
);

export default FeatureCards;
