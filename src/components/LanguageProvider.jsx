import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from '@/lib/i18n/translations';
import { getLanguage } from '@/lib/i18n/languages';

const LanguageContext = createContext(null);

const STORAGE_KEY = 'onekor-language';

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) || 'en';
    }
    return 'en';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    const language = getLanguage(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = language.dir;
  }, [lang]);

  const t = useCallback(
    (text) => {
      if (!text) return text;
      const map = translations[lang];
      if (map && map[text]) return map[text];
      return text;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}