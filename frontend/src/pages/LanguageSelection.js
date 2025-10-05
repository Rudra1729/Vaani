import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../lang/LanguageContext';
import './HomePage.css';

const LanguageSelection = () => {
  const { setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const choose = (lang) => {
    setLanguage(lang);
    navigate('/');
  };

  return (
    <div className="homepage">
      <div className="hero-section" style={{ paddingTop: 80 }}>
        <h1 className="hero-title">{t('lang.select_title')}</h1>
        <p className="hero-subtitle">{t('lang.select_sub')}</p>
        <div className="hero-stats" style={{ justifyContent: 'center', gap: 16 }}>
          <button className="analyze-btn" onClick={() => choose('en')}>
            {t('lang.english')}
          </button>
          <button className="analyze-btn" onClick={() => choose('hi')}>
            {t('lang.hindi')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelection;


