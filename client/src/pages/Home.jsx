// Home: tagline (with English subtitle), language picker, one big mic button,
// "How it works", trust cues, and the sample case for visitors without a mic.
// After the tap, the whole interview runs here (InterviewView), then the
// result is saved and the citizen is taken to the document's status page.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LANGUAGES, t } from '@arzi/shared';
import { api } from '../lib/api.js';
import { getUserId } from '../lib/userId.js';
import MicButton from '../components/MicButton.jsx';
import InterviewView from '../components/InterviewView.jsx';
import EmergencyPanel from '../components/EmergencyPanel.jsx';
import HowItWorks from '../components/HowItWorks.jsx';
import TrustCues from '../components/TrustCues.jsx';
import { useInterview } from '../conversation/useInterview.js';
import { runInterview } from '../conversation/interview.js';
import { createScriptedProvider } from '../demo/scriptedProvider.js';
import { SAMPLE_SCRIPT } from '../demo/sampleScript.js';
import { getAiConsent, setAiConsent } from '../lib/prefs.js';
import { hasSpeechRecognition, isSecureForMic } from '../voice/support.js';

// Sample case pacing: Arzi's lines are shown (not spoken) just long enough to
// read, and answers "type" quickly, so each question takes about 3 seconds.
const sampleSpeak = (text) =>
  new Promise((resolve) => setTimeout(() => resolve({ spoken: true }), Math.min(1300, Math.max(650, 300 + text.length * 7))));

export default function Home({ lang, setLang, config }) {
  const { view, start, respond, reset } = useInterview({ lang, setLang });
  const started = view.running || view.outcome;
  const navigate = useNavigate();
  const [save, setSave] = useState(null); // null | 'saving' | 'failed'
  const [sample, setSample] = useState(false); // running "Try a sample case"
  const [skip, setSkip] = useState(null); // null | 'busy' | 'failed'

  // Real interview. If an outside AI service is configured, ask for consent once per session.
  const startInterview = () => {
    setSample(false);
    const aiAvailable = (config?.aiProviders?.length ?? 0) > 0;
    const askAiConsent = aiAvailable && getAiConsent() === null;
    start((io) =>
      runInterview({ ...io, onAiConsent: setAiConsent }, { askAiConsent, aiProviders: config?.aiProviders?.join(' / ') }),
    );
  };

  // "Try a sample case": the real interview, answered by a script (no mic, no keys).
  const startSample = () => {
    setSample(true);
    start(runInterview, {
      provider: createScriptedProvider(SAMPLE_SCRIPT[lang] ?? SAMPLE_SCRIPT.en, { wordMs: 55, thinkMs: 250 }),
      speakWith: sampleSpeak,
    });
  };

  // "Skip to an approved document" / "Skip to end": a ready, approved sample → read-back.
  const skipToApproved = async () => {
    if (skip === 'busy') return;
    setSkip('busy');
    try {
      reset();
      const r = await api('/demo/sample', { method: 'POST', body: { userId: getUserId(), lang } });
      if (!r.ok) throw new Error(r.error);
      setSkip(null);
      navigate(`/documents/${r.data.id}`, { state: { autoReadBack: true } });
    } catch (err) {
      console.warn('[sample] skip failed:', err);
      setSkip('failed');
    }
  };

  // When the interview finishes, save it: a notice goes to the advocate; a
  // non-deposit problem is noted only if the user said yes.
  const submit = useCallback(async () => {
    const o = view.outcome;
    if (!o) return;
    const base = { userId: getUserId(), lang: o.lang, problem: o.problem, transcript: o.transcript };
    if (o.outcome === 'other' && !o.noted) return;
    setSave('saving');
    const consent = getAiConsent();
    const r =
      o.outcome === 'ready'
        ? await api('/documents', {
            method: 'POST',
            body: { ...base, fields: o.fields, sample, aiConsent: consent === null ? null : consent === 'yes' },
          })
        : await api('/notes', { method: 'POST', body: base });
    if (!r.ok) return setSave('failed');
    setSave(null);
    // A sample case goes on to the demo advocate's approval and then the read-back.
    if (o.outcome === 'ready') navigate(`/documents/${r.data.id}`, { state: sample ? { sample: true } : undefined });
  }, [view.outcome, navigate, sample]);

  useEffect(() => {
    if (view.outcome?.outcome === 'ready' || view.outcome?.outcome === 'other') submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.outcome]);

  if (view.emergency) return <EmergencyPanel lang={lang} onClose={reset} />;

  if (!started) {
    return (
      <main className="home">
        <section className="hero">
          <h1 className="tagline">{t(lang, 'tagline')}</h1>
          {lang !== 'en' && (
            <p className="tagline-en" lang="en">
              {t('en', 'tagline')}
            </p>
          )}

          <div className="lang-row" role="radiogroup" aria-label={t(lang, 'chooseLanguage')}>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                role="radio"
                aria-checked={lang === l.code}
                className={`lang ${lang === l.code ? 'lang-on' : ''}`}
                onClick={() => setLang(l.code)}
                lang={l.code}
              >
                {l.label}
              </button>
            ))}
          </div>

          <MicButton label={t(lang, 'tapToSpeak')} onClick={startInterview} />

          {!(hasSpeechRecognition() && isSecureForMic()) && (
            <p className="warning" role="alert">
              {t(lang, 'unsupportedBrowser')}
            </p>
          )}
        </section>

        <HowItWorks lang={lang} />
        <TrustCues lang={lang} />

        <section className="sample-box">
          <p>{t(lang, 'trySampleHelp')}</p>
          <button type="button" className="btn btn-primary btn-big" onClick={startSample}>
            {t(lang, 'trySample')}
          </button>
          <button type="button" className="btn btn-big" onClick={skipToApproved} disabled={skip === 'busy'} aria-busy={skip === 'busy'}>
            {skip === 'busy' ? t(lang, 'opening') : t(lang, 'skipToApproved')}
          </button>
          {skip === 'failed' && (
            <p className="keyboard-error" role="alert">
              {t(lang, 'skipFailed')}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="home is-talking">
      {sample && view.running && (
        <div className="sample-banner" role="status">
          <span>{t(lang, 'sampleBanner')}</span>
          <button type="button" className="btn" onClick={skipToApproved} disabled={skip === 'busy'}>
            {skip === 'busy' ? t(lang, 'opening') : t(lang, 'skipToEnd')}
          </button>
        </div>
      )}

      <InterviewView lang={lang} view={view} respond={respond} sample={sample} />

      {view.outcome?.outcome === 'ready' && <h2 className="outcome-title">{t(lang, 'readyTitle')}</h2>}
      {save === 'saving' && (
        <p className="muted" role="status">
          {t(lang, 'saving')}
        </p>
      )}
      {(save === 'failed' || skip === 'failed') && (
        <div className="save-failed" role="alert">
          <p className="warning">{t(lang, save === 'failed' ? 'saveFailed' : 'skipFailed')}</p>
          {save === 'failed' && (
            <button type="button" className="btn btn-primary btn-big" onClick={submit}>
              {t(lang, 'retry')}
            </button>
          )}
        </div>
      )}
      {view.outcome?.outcome === 'other' && (
        <div className="outcome">
          <h2 className="outcome-title">{t(lang, 'otherTitle')}</h2>
          <p>{t(lang, view.outcome.noted ? 'noted' : 'notNoted')}</p>
        </div>
      )}

      <button
        type="button"
        className="btn btn-link"
        onClick={() => {
          setSave(null);
          setSkip(null);
          setSample(false);
          reset();
        }}
      >
        {t(lang, 'startOver')}
      </button>
    </main>
  );
}
