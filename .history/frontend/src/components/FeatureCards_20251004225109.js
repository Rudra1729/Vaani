import React from "react";
import { Search, Brain, FileText, MessageSquare, Zap, Shield } from "lucide-react";
import "./FeatureCards.css";

const FeatureCards = () => (
  <div className="features-grid">
    <FeatureCard 
      icon={<Search size={32} />} 
      title="Smart Search" 
      description="Find relevant papers using AI-powered semantic search across thousands of research papers." 
    />
    <FeatureCard 
      icon={<Brain size={32} />} 
      title="AI Analysis" 
      description="Get intelligent analysis and contextual explanations of complex research concepts and methodologies." 
    />
    <FeatureCard 
      icon={<FileText size={32} />} 
      title="PDF Viewer" 
      description="Interactive PDF viewer with text selection and real-time analysis capabilities." 
    />
    <FeatureCard 
      icon={<MessageSquare size={32} />} 
      title="AI Chatbot" 
      description="Ask questions about any paper and get instant, intelligent responses from our AI assistant." 
    />
    <FeatureCard 
      icon={<Zap size={32} />} 
      title="Fast Processing" 
      description="Quick paper loading and analysis with optimized performance for seamless user experience." 
    />
    <FeatureCard 
      icon={<Shield size={32} />} 
      title="Secure Access" 
      description="Safe and secure access to research papers with privacy-focused design and data protection." 
    />
  </div>
);

const FeatureCard = ({ icon, title, description }) => (
  <div className="feature-card">
    <div className="feature-icon">
      {icon}
    </div>
    <h3 className="feature-title">{title}</h3>
    <p className="feature-description">{description}</p>
  </div>
);

export default FeatureCards;
