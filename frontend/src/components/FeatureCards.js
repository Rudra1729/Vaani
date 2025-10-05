import React from "react";
import { Search, Brain, FileText, MessageSquare, Zap, Shield } from "lucide-react";
import "./FeatureCards.css";
import { useLanguage } from "../lang/LanguageContext";

const FeatureCards = () => {
  const { t } = useLanguage();
  return (
    <div className="features-grid">
      <FeatureCard 
        icon={<Search size={32} />} 
        title={t('feature.smartSearch.title') || 'Smart Search'} 
        description={t('feature.smartSearch.desc') || 'Find relevant papers using AI-powered semantic search across thousands of research papers.'} 
      />
      <FeatureCard 
        icon={<Brain size={32} />} 
        title={t('feature.aiAnalysis.title') || 'AI Analysis'} 
        description={t('feature.aiAnalysis.desc') || 'Get intelligent analysis and contextual explanations of complex research concepts and methodologies.'} 
      />
      <FeatureCard 
        icon={<FileText size={32} />} 
        title={t('feature.pdfViewer.title') || 'PDF Viewer'} 
        description={t('feature.pdfViewer.desc') || 'Interactive PDF viewer with text selection and real-time analysis capabilities.'} 
      />
      <FeatureCard 
        icon={<MessageSquare size={32} />} 
        title={t('feature.aiChat.title') || 'AI Chatbot'} 
        description={t('feature.aiChat.desc') || 'Ask questions about any paper and get instant, intelligent responses from our AI assistant.'} 
      />
      <FeatureCard 
        icon={<Zap size={32} />} 
        title={t('feature.fast.title') || 'Fast Processing'} 
        description={t('feature.fast.desc') || 'Quick paper loading and analysis with optimized performance for seamless user experience.'} 
      />
      <FeatureCard 
        icon={<Shield size={32} />} 
        title={t('feature.secure.title') || 'Secure Access'} 
        description={t('feature.secure.desc') || 'Safe and secure access to research papers with privacy-focused design and data protection.'} 
      />
    </div>
  );
};

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
