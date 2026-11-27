// Home screen: language picker + one big mic button.
// Step 3: tapping the mic greets the user and listens to their problem, with
// live transcript, silence / noise handling and the keyboard fallback.
// Step 4 replaces the end of this flow with the full interview.
import { useState } from 'react';
import { LANGUAGES, t } from '@arzi/shared';
import MicButton from '../components/MicButton.jsx';
import ArziSays from '../components/ArziSays.jsx';
import LiveTranscript from '../components/LiveTranscript.jsx';
import KeyboardFallback from '../components/KeyboardFallback.jsx';
import { useVoice } from '../voice/useVoice.js';
import { hasSpeechRecognition, isSecureForMic } from '../voice/support.js';

export default function Home({ lang, setLang }) {
  const { state, run, cancel } = useVoice(lang);
  const [heard, setHeard] = useState('');

  const voiceOk = hasSpeechRecognition() && isSecureForMic();
  const busy = state.phase === 'speaking' || state.phase === 'listening' || state.phase === 'thinking';

  async function start() {
    if (busy) return cancel();
    setHeard('');
    const result = await run({ prompt: t(lang, 'greeting') });
    if (result.status === 'answer') setHeard(result.text);
  }

  const chooseLanguage = (code) => {
    cancel();
    setHeard('');
    setLang(code);
  };

  const micState = state.phase === 'speaking' ? 'speaking' : state.phase === 'listening' ? 'listening' : 'idle';

  return (
    <main className="home">
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
              onClick={() => chooseLanguage(l.code)}
              lang={l.code}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <MicButton
        state={micState}
        label={busy ? t(lang, 'stop') : t(lang, 'tapToSpeak')}
        onClick={start}
      />

      <ArziSays text={state.text} speaking={state.phase === 'speaking'} voiceless={state.voiceless} />

      <LiveTranscript lang={lang} text={state.phase === 'listening' ? state.interim : heard} listening={state.phase === 'listening'} />

      {state.phase === 'paused' && (
        <>
          <p className="paused-note">{t(lang, 'pausedPrompt')}</p>
          <button type="button" className="btn btn-primary btn-big" onClick={start}>
            {t(lang, 'tapToContinue')}
          </button>
        </>
      )}

      {state.phase === 'keyboard' && (
        <KeyboardFallback
          key={lang}
          lang={lang}
          messageKey={state.messageKey}
          onSubmit={(text) => {
            setHeard(text);
            cancel();
          }}
        />
      )}

      {!voiceOk && state.phase !== 'keyboard' && (
        <p className="warning" role="alert">
          {t(lang, 'unsupportedBrowser')}
        </p>
      )}
    </main>
  );
}
