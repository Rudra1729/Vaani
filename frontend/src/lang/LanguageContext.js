import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from './translations';

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  t: (key, vars) => key,
});

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem('appLanguage') || '';
    } catch {
      return '';
    }
  });

  const setLanguage = (lang) => {
    setLanguageState(lang);
    try { localStorage.setItem('appLanguage', lang); } catch {}
  };

  const t = useMemo(() => {
    const dict = translations[language] || translations.en;
    return (key, vars = {}) => {
      const raw = dict[key] || translations.en[key] || key;
      return Object.keys(vars).reduce((acc, k) => acc.replace(new RegExp(`{${k}}`, 'g'), String(vars[k])), raw);
    };
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);


