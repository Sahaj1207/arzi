// App shell: header with badges, routes, and the "not legal advice" footer.
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LANGUAGES, t } from '@arzi/shared';
import { api } from './lib/api.js';
import { getUserId, getSavedLanguage, saveLanguage, detectLanguage } from './lib/userId.js';
import ModeBadges from './components/ModeBadges.jsx';
import { setRuntimeConfig } from './lib/ai.js';
import Home from './pages/Home.jsx';
// Other screens load only when opened, so the home screen starts faster.
const DocumentStatus = lazy(() => import('./pages/DocumentStatus.jsx'));
const Advocate = lazy(() => import('./pages/Advocate.jsx'));
const History = lazy(() => import('./pages/History.jsx'));

export default function App() {
  const [config, setConfig] = useState(null);
  const [lang, setLangState] = useState(() => {
    const visible = (code) => LANGUAGES.some((l) => l.code === code);
    const saved = getSavedLanguage();
    if (saved && visible(saved)) return saved;
    const detected = detectLanguage();
    return visible(detected) ? detected : 'en';
  });

  useEffect(() => {
    getUserId(); // make sure this device has an anonymous ID
    api('/config').then((r) => {
      if (!r.ok) return;
      setRuntimeConfig(r.data); // voice code reads which paid services exist
      setConfig(r.data);
    });
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
        {/* translate="no": browser page-translation must not turn the logo into words */}
        <Link to="/" className="brand" aria-label="Arzi home" translate="no">
          <span className="brand-mark notranslate" aria-hidden="true">अ</span>
          <span className="brand-name notranslate">arzi</span>
        </Link>
        {!wide && (
          <Link to="/history" className="nav-link">
            {t(lang, 'history')}
          </Link>
        )}
      </header>

      <Suspense fallback={<p className="muted page-loading">…</p>}>
      <Routes>
        <Route path="/" element={<Home lang={lang} setLang={setLang} config={config} />} />
        <Route path="/documents/:id" element={<DocumentStatus lang={lang} />} />
        <Route path="/history" element={<History lang={lang} />} />
        <Route path="/advocate" element={<Advocate config={config} />} />
        <Route path="/advocate/:id" element={<Advocate config={config} />} />
        <Route path="*" element={<Home lang={lang} setLang={setLang} config={config} />} />
      </Routes>
      </Suspense>

      <footer className="footer">
        <p>{t(lang, 'notLegalAdvice')}</p>
        <ModeBadges config={config} />
      </footer>
    </div>
  );
}
