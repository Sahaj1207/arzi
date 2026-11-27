// App shell: header with badges, routes, and the "not legal advice" footer.
import { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { DEFAULT_LANGUAGE, t } from '@arzi/shared';
import { api } from './lib/api.js';
import { getUserId, getSavedLanguage, saveLanguage } from './lib/userId.js';
import ModeBadges from './components/ModeBadges.jsx';
import Home from './pages/Home.jsx';
import DocumentStatus from './pages/DocumentStatus.jsx';

export default function App() {
  const [config, setConfig] = useState(null);
  const [lang, setLangState] = useState(getSavedLanguage() ?? DEFAULT_LANGUAGE);

  useEffect(() => {
    getUserId(); // make sure this device has an anonymous ID
    api('/config').then((r) => r.ok && setConfig(r.data));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (code) => {
    saveLanguage(code);
    setLangState(code);
  };

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Arzi home">
          <span className="brand-mark" aria-hidden="true">अ</span>
          <span className="brand-name">Arzi</span>
        </Link>
        <ModeBadges config={config} />
      </header>

      <Routes>
        <Route path="/" element={<Home lang={lang} setLang={setLang} />} />
        <Route path="/documents/:id" element={<DocumentStatus lang={lang} />} />
        <Route path="*" element={<Home lang={lang} setLang={setLang} />} />
      </Routes>

      <footer className="footer">{t(lang, 'notLegalAdvice')}</footer>
    </div>
  );
}
