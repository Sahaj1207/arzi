// Home: before starting, a language picker and one big mic button.
// After the tap, the whole interview runs here: Arzi's words, live transcript,
// the value being confirmed (large), the 7 answer cards, and the fallbacks.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FIELDS, LANGUAGES, t } from '@arzi/shared';
import { api } from '../lib/api.js';
import { getUserId } from '../lib/userId.js';
import MicButton from '../components/MicButton.jsx';
import ArziSays from '../components/ArziSays.jsx';
import LiveTranscript from '../components/LiveTranscript.jsx';
import KeyboardFallback from '../components/KeyboardFallback.jsx';
import FieldCards from '../components/FieldCards.jsx';
import ConfirmValue from '../components/ConfirmValue.jsx';
import EmergencyPanel from '../components/EmergencyPanel.jsx';
import { useInterview } from '../conversation/useInterview.js';
import { hasSpeechRecognition, isSecureForMic } from '../voice/support.js';

export default function Home({ lang, setLang }) {
  const { view, start, respond, reset } = useInterview({ lang, setLang });
  const started = view.running || view.outcome;
  const navigate = useNavigate();
  const [save, setSave] = useState(null); // null | 'saving' | 'failed'

  // When the interview finishes, save it: a notice goes to the advocate; a
  // non-deposit problem is noted only if the user said yes.
  const submit = useCallback(async () => {
    const o = view.outcome;
    if (!o) return;
    const base = { userId: getUserId(), lang: o.lang, problem: o.problem, transcript: o.transcript };
    if (o.outcome === 'other' && !o.noted) return;
    setSave('saving');
    const r =
      o.outcome === 'ready'
        ? await api('/documents', { method: 'POST', body: { ...base, fields: o.fields } })
        : await api('/notes', { method: 'POST', body: base });
    if (!r.ok) return setSave('failed');
    setSave(null);
    if (o.outcome === 'ready') navigate(`/documents/${r.data.id}`);
  }, [view.outcome, navigate]);

  useEffect(() => {
    if (view.outcome?.outcome === 'ready' || view.outcome?.outcome === 'other') submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.outcome]);

  if (view.emergency) return <EmergencyPanel lang={lang} onClose={reset} />;

  const micState = view.phase === 'speaking' ? 'speaking' : view.phase === 'listening' ? 'listening' : 'idle';
  const fieldIndex = FIELDS.findIndex((f) => f.id === view.current);
  const showCards = fieldIndex !== -1 || ['summary', 'done'].includes(view.current) || view.outcome?.outcome === 'ready';

  const onMic = () => {
    if (!started) return start();
    if (view.phase === 'paused' || view.phase === 'keyboard') return respond({ voice: true });
  };

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
        </>
      )}

      {fieldIndex !== -1 && (
        <p className="progress">{t(lang, 'step', { n: fieldIndex + 1, total: FIELDS.length })}</p>
      )}

      {!view.outcome && (
        <MicButton
          state={micState}
          size={started ? 'small' : 'big'}
          label={t(lang, view.phase === 'paused' ? 'tapToContinue' : 'tapToSpeak')}
          onClick={onMic}
          disabled={started && !['paused', 'keyboard'].includes(view.phase)}
        />
      )}

      <ArziSays text={view.text} speaking={view.phase === 'speaking'} voiceless={view.voiceless} />

      <ConfirmValue lang={lang} pending={view.pending} />

      {view.phase === 'listening' && <LiveTranscript lang={lang} text={view.interim} listening />}

      {view.phase === 'paused' && (
        <>
          <p className="paused-note">{t(lang, 'pausedPrompt')}</p>
          <button type="button" className="btn btn-primary btn-big" onClick={() => respond({ tap: true })}>
            {t(lang, 'tapToContinue')}
          </button>
        </>
      )}

      {view.phase === 'keyboard' && (
        <KeyboardFallback
          key={`${view.current}-${view.text}`}
          lang={lang}
          messageKey={view.messageKey}
          error={view.kbError}
          onSubmit={(typed) => respond({ typed })}
        />
      )}

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

      {showCards && <FieldCards lang={lang} fields={view.fields} current={view.current} />}

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

      {!started && !(hasSpeechRecognition() && isSecureForMic()) && (
        <p className="warning" role="alert">
          {t(lang, 'unsupportedBrowser')}
        </p>
      )}
    </main>
  );
}
