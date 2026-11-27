// Home: before starting, a language picker and one big mic button.
// After the tap, the whole interview runs here (InterviewView), then the
// result is saved and the citizen is taken to the document's status page.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FIELDS, LANGUAGES, t } from '@arzi/shared';
import { api } from '../lib/api.js';
import { getUserId } from '../lib/userId.js';
import MicButton from '../components/MicButton.jsx';
import InterviewView from '../components/InterviewView.jsx';
import FieldCards from '../components/FieldCards.jsx';
import EmergencyPanel from '../components/EmergencyPanel.jsx';
import { useInterview } from '../conversation/useInterview.js';
import { runInterview } from '../conversation/interview.js';
import { createScriptedProvider } from '../demo/scriptedProvider.js';
import { SAMPLE_SCRIPT } from '../demo/sampleScript.js';
import { getAiConsent, setAiConsent } from '../lib/prefs.js';
import { hasSpeechRecognition, isSecureForMic } from '../voice/support.js';

export default function Home({ lang, setLang, config }) {
  const { view, start, respond, reset } = useInterview({ lang, setLang });
  const started = view.running || view.outcome;
  const navigate = useNavigate();
  const [save, setSave] = useState(null); // null | 'saving' | 'failed'
  const [sample, setSample] = useState(false); // running "Try a sample case"

  // Real interview. If an outside AI service is configured, ask for consent once per session.
  const startInterview = () => {
    setSample(false);
    const aiAvailable = (config?.aiProviders?.length ?? 0) > 0;
    const askAiConsent = aiAvailable && getAiConsent() === null;
    start((io) =>
      runInterview(
        { ...io, onAiConsent: setAiConsent },
        { askAiConsent, aiProviders: config?.aiProviders?.join(' / ') },
      ),
    );
  };

  // "Try a sample case": the real interview, answered by a script (no mic, no keys).
  const startSample = () => {
    setSample(true);
    start(runInterview, { provider: createScriptedProvider(SAMPLE_SCRIPT[lang] ?? SAMPLE_SCRIPT.en) });
  };

  // "Skip to an approved document": straight to read-back and consent.
  const skipToApproved = async () => {
    const r = await api('/demo/sample', { method: 'POST', body: { userId: getUserId(), lang } });
    if (r.ok) navigate(`/documents/${r.data.id}`, { state: { autoReadBack: true } });
    else setSave('failed');
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

  const inFields = FIELDS.some((f) => f.id === view.current);
  const showCards = inFields || ['summary', 'done'].includes(view.current) || view.outcome?.outcome === 'ready';

  return (
    <main className="home">
      {!started && (
        <>
          <p className="tagline">{t(lang, 'tagline')}</p>
          <section aria-labelledby="lang-heading" className="lang-picker">
            <h2 id="lang-heading">{t(lang, 'chooseLanguage')}</h2>
            <div className="lang-row" role="radiogroup">
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
          </section>
          <MicButton label={t(lang, 'tapToSpeak')} onClick={startInterview} />
          {!(hasSpeechRecognition() && isSecureForMic()) && (
            <p className="warning" role="alert">
              {t(lang, 'unsupportedBrowser')}
            </p>
          )}
          <section className="sample-box">
            <button type="button" className="btn btn-big" onClick={startSample}>
              {t(lang, 'trySample')}
            </button>
            <p className="muted">{t(lang, 'trySampleHelp')}</p>
            <button type="button" className="btn btn-link" onClick={skipToApproved}>
              {t(lang, 'skipToApproved')}
            </button>
          </section>
        </>
      )}

      {started && sample && view.running && <p className="sample-banner">{t(lang, 'sampleBanner')}</p>}

      {started && <InterviewView lang={lang} view={view} respond={respond} showCards={false} />}

      {view.outcome?.outcome === 'ready' && <h2 className="outcome-title">{t(lang, 'readyTitle')}</h2>}
      {save === 'saving' && <p className="muted" role="status">{t(lang, 'saving')}</p>}
      {save === 'failed' && (
        <div className="save-failed" role="alert">
          <p className="warning">{t(lang, 'saveFailed')}</p>
          <button type="button" className="btn btn-primary btn-big" onClick={submit}>
            {t(lang, 'retry')}
          </button>
        </div>
      )}
      {view.outcome?.outcome === 'other' && (
        <div className="outcome">
          <h2 className="outcome-title">{t(lang, 'otherTitle')}</h2>
          <p>{t(lang, view.outcome.noted ? 'noted' : 'notNoted')}</p>
        </div>
      )}

      {started && showCards && <FieldCards lang={lang} fields={view.fields} current={view.current} />}

      {started && (
        <button
          type="button"
          className="btn btn-link"
          onClick={() => {
            setSave(null);
            reset();
          }}
        >
          {t(lang, 'startOver')}
        </button>
      )}
    </main>
  );
}
