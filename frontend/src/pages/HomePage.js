import React, { useEffect } from "react";
import FeatureCards from "../components/FeatureCards";
import SearchBar from "../components/SearchBar";
import "./HomePage.css";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../lang/LanguageContext";

const HomePage = () => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  useEffect(() => {
    if (!language) {
      navigate('/select-language');
    }
  }, [language, navigate]);

  return (
    <div className="homepage">
      <div className="hero-section">
        <h1 className="hero-title">
          {t('home.title')}<span className="blue-text">AI</span>
        </h1>
        <p className="hero-subtitle">
          {t('home.subtitle')}
        </p>
        <div className="hero-stats">
          <div className="stat">
            <span className="stat-number">10K+</span>
            <span className="stat-label">{t('home.stats.papers')}</span>
          </div>
          <div className="stat">
            <span className="stat-number">AI</span>
            <span className="stat-label">{t('home.stats.analysis')}</span>
          </div>
          <div className="stat">
            <span className="stat-number">Free</span>
            <span className="stat-label">{t('home.stats.free')}</span>
          </div>
        </div>
      </div>
      
      <div className="search-section">
        <SearchBar />
      </div>
      
      <div className="features-section">
        <h2 className="section-title">{t('home.features.title')}</h2>
        <FeatureCards />
      </div>
    </div>
  );
};

export default HomePage;

