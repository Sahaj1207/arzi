// App shell: header with badges, routes, and the "not legal advice" footer.
import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { DEFAULT_LANGUAGE, t } from '@arzi/shared';
import { api } from './lib/api.js';
import { getUserId, getSavedLanguage, saveLanguage } from './lib/userId.js';
import ModeBadges from './components/ModeBadges.jsx';
import Home from './pages/Home.jsx';
import DocumentStatus from './pages/DocumentStatus.jsx';
import Advocate from './pages/Advocate.jsx';
import History from './pages/History.jsx';

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

  const setLang = useCallback((code) => {
    saveLanguage(code);
    setLangState(code);
  }, []);

  // The advocate desk uses a wider layout (laptop); citizen screens stay phone-width.
  const wide = useLocation().pathname.startsWith('/advocate');

  return (
    <div className={`app ${wide ? 'app-wide' : ''}`}>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Arzi home">
          <span className="brand-mark" aria-hidden="true">अ</span>
          <span className="brand-name">Arzi</span>
        </Link>
        <div className="topbar-right">
          {!wide && (
            <Link to="/history" className="nav-link">
              {t(lang, 'history')}
            </Link>
          )}
          <ModeBadges config={config} />
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Home lang={lang} setLang={setLang} config={config} />} />
        <Route path="/documents/:id" element={<DocumentStatus lang={lang} />} />
        <Route path="/history" element={<History lang={lang} />} />
        <Route path="/advocate" element={<Advocate />} />
        <Route path="/advocate/:id" element={<Advocate />} />
        <Route path="*" element={<Home lang={lang} setLang={setLang} config={config} />} />
      </Routes>

      <footer className="footer">{t(lang, 'notLegalAdvice')}</footer>
    </div>
  );
}
