import { createContext, useContext, useState, useEffect } from 'react';

const BrandingContext = createContext(null);
const STORAGE_KEY = 'onekor-branding';

const defaultBranding = {
  siteName: 'OneKor',
  tagline: 'Enterprise Workspace',
  logoLight: null,
  logoDark: null,
  favicon: null,
};

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return { ...defaultBranding, ...JSON.parse(stored) };
      } catch (e) {
        // ignore parse errors
      }
    }
    return defaultBranding;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(branding));

    // Apply favicon
    if (branding.favicon) {
      let link = document.querySelector("link[rel='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = branding.favicon;
    }

    // Apply document title
    if (branding.siteName) {
      document.title = `${branding.siteName} · Enterprise AI Platform`;
    }
  }, [branding]);

  const updateBranding = (updates) => {
    setBranding((prev) => ({ ...prev, ...updates }));
  };

  return (
    <BrandingContext.Provider value={{ branding, updateBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider');
  return ctx;
}