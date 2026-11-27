// Home screen: language picker + one big mic button. Arzi greets on first tap
// (browsers block audio until the user interacts with the page).
import { useState } from 'react';
import { LANGUAGES, t } from '@arzi/shared';
import MicButton from '../components/MicButton.jsx';
import { speak, stopSpeaking } from '../voice/tts.js';
import { hasSpeechRecognition, isSecureForMic } from '../voice/support.js';

export default function Home({ lang, setLang }) {
  const [micState, setMicState] = useState('idle');
  const [said, setSaid] = useState('');

  const voiceOk = hasSpeechRecognition() && isSecureForMic();

  async function start() {
    if (micState === 'speaking') {
      stopSpeaking();
      setMicState('idle');
      return;
    }
    const greeting = t(lang, 'greeting');
    setSaid(greeting); // always shown on screen, even if no voice is installed
    setMicState('speaking');
    await speak(greeting, lang);
    setMicState('idle');
    // Step 3 starts listening here.
  }

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
              onClick={() => setLang(l.code)}
              lang={l.code}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <MicButton state={micState} label={t(lang, 'tapToSpeak')} onClick={start} />

      {said && (
        <p className="arzi-says" aria-live="polite">
          {said}
        </p>
      )}

      {!voiceOk && (
        <p className="warning" role="alert">
          {t(lang, 'unsupportedBrowser')}
        </p>
      )}
    </main>
  );
}
