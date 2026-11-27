// Read-back + spoken consent (core flow step 6).
//   1. Read the approved plain-language summary aloud, point by point,
//      highlighting each point on screen.
//   2. Ask: "Did you understand this document and do you agree? Say: yes, I
//      understood and I agree." The answer is RECORDED (MediaRecorder) while
//      speech recognition listens, then uploaded and saved with the document.
//   3. "English" → read the full English notice; "read again" → repeat the points;
//      "no" → nothing is saved.
//   Backup (CLAUDE.md §6): if voice fails or the mic is busy, the recording keeps
//   running and a big "I understood and I agree" button confirms instead.
import { useEffect, useRef, useState } from 'react';
import { t, parseConsent, isEmergency } from '@arzi/shared';
import { ask as voiceAsk } from '../voice/ask.js';
import { getSpeechProvider } from '../voice/speechProvider.js';
import { speak, stopSpeaking } from '../voice/tts.js';
import { startRecording } from '../voice/recorder.js';
import { getUserId } from '../lib/userId.js';
import { getRate, setRate, RATE_MIN, RATE_MAX } from '../lib/prefs.js';
import ArziSays from './ArziSays.jsx';
import LiveTranscript from './LiveTranscript.jsx';
import EmergencyPanel from './EmergencyPanel.jsx';

export default function ReadBack({ doc, onDone, onClose }) {
  const lang = doc.language;
  const lines = doc.version.summary.split('\n').filter(Boolean);

  // phase: reading | asking | fallback | saving | declined | failed | emergency
  const [phase, setPhase] = useState('reading');
  const [current, setCurrent] = useState(-1); // highlighted summary point
  const [said, setSaid] = useState('');
  const [voiceless, setVoiceless] = useState(false);
  const [voice, setVoice] = useState({ phase: 'idle', interim: '' });
  const [recording, setRecording] = useState(false);
  const [fallbackMsg, setFallbackMsg] = useState(null);

  const abortRef = useRef(null);
  const recRef = useRef(null);

  const signal = () => abortRef.current?.signal;
  const say = async (text, l = lang) => {
    if (signal()?.aborted) return;
    setSaid(text);
    const { spoken } = await speak(text, l);
    setVoiceless(!spoken);
  };

  const cancelRecording = () => {
    recRef.current?.cancel();
    recRef.current = null;
    setRecording(false);
  };

  // ---- Reading with pause / repeat / speed controls ----
  const ctrl = useRef({ paused: false, repeat: false, resume: null });
  const [paused, setPaused] = useState(false);
  const [rate, setRateState] = useState(getRate());

  const waitWhilePaused = () =>
    ctrl.current.paused ? new Promise((resolve) => (ctrl.current.resume = resolve)) : null;

  // Reads items one by one. A pause or "repeat" interrupts the current item,
  // which is then read again from its start.
  async function readList(items, { l = lang, highlight = false } = {}) {
    ctrl.current.repeat = false; // a "repeat" tapped during the intro should not repeat point 1
    for (let i = 0; i < items.length; i++) {
      await waitWhilePaused();
      if (signal()?.aborted) return;
      if (highlight) setCurrent(i);
      await say(items[i].text, l);
      if (signal()?.aborted) return;
      if (ctrl.current.paused || ctrl.current.repeat) {
        ctrl.current.repeat = false;
        i -= 1;
      }
    }
    setCurrent(-1);
  }

  async function readPoints() {
    setPhase('reading');
    await say(t(lang, 'readbackIntro'));
    await readList(lines.map((line, i) => ({ text: `${t(lang, 'point', { n: i + 1 })} ${line}` })), { highlight: true });
  }

  async function readEnglish() {
    cancelRecording();
    setPhase('reading');
    await say(t(lang, 'englishIntro'));
    const paragraphs = doc.version.notice.split(/\n{2,}/).map((p) => ({ text: p.replace(/\n/g, '. ') }));
    await readList(paragraphs, { l: 'en' });
  }

  const pause = () => {
    ctrl.current.paused = true;
    setPaused(true);
    stopSpeaking();
  };
  const resume = () => {
    ctrl.current.paused = false;
    setPaused(false);
    ctrl.current.resume?.();
    ctrl.current.resume = null;
  };
  const repeatPoint = () => {
    if (ctrl.current.paused) return resume(); // resuming re-reads the current point anyway
    ctrl.current.repeat = true;
    stopSpeaking();
  };
  const changeSpeed = (delta) => {
    setRateState(setRate(rate + delta));
    if (phase === 'reading' && !ctrl.current.paused) repeatPoint(); // hear the new speed now
  };

  async function upload(method, transcript) {
    setPhase('saving');
    const blob = recRef.current ? await recRef.current.stop() : null;
    recRef.current = null;
    setRecording(false);
    const qs = new URLSearchParams({ userId: getUserId(), method, transcript: transcript ?? '' });
    try {
      const res = await fetch(`/api/documents/${doc.id}/consent?${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': blob?.size ? blob.type : 'application/octet-stream' },
        body: blob?.size ? blob : undefined,
      });
      if (!res.ok) throw new Error(String(res.status));
      const updated = await res.json();
      await say(t(lang, 'consentThanks'));
      onDone(updated);
    } catch {
      setPhase('failed');
    }
  }

  // Ask for consent, recording the answer. Loops on "English" / "read again".
  async function askConsent() {
    for (;;) {
      if (signal()?.aborted) return;
      setPhase('asking');
      await say(`${t(lang, 'consentAsk')} ${t(lang, 'consentHelp')}`);
      if (signal()?.aborted) return;

      recRef.current = await startRecording();
      setRecording(Boolean(recRef.current));

      const r = await voiceAsk({
        prompt: t(lang, 'consentAsk'),
        skipFirstPrompt: true,
        lang,
        provider: getSpeechProvider(),
        speak: (text, l) => say(text, l),
        signal: signal(),
        parse: (text) => (isEmergency(text) ? 'emergency' : parseConsent(text)),
        onState: (s) => setVoice((v) => ({ ...v, ...s })),
      });
      setVoice({ phase: 'idle', interim: '' });

      // Aborted by a button tap: whoever aborted decides what happens to the recording.
      if (r.status === 'aborted') return;
      if (r.status !== 'answer') {
        // Voice did not work (mic busy, noise, silence): keep recording, offer the button.
        setFallbackMsg(recRef.current ? 'micBusy' : null);
        setPhase('fallback');
        return;
      }
      if (r.value === 'emergency') {
        cancelRecording();
        stopSpeaking();
        return setPhase('emergency');
      }
      if (r.value === 'agree') return upload('voice', r.text);
      if (r.value === 'no') {
        cancelRecording();
        setPhase('declined');
        await say(t(lang, 'consentDeclined'));
        return;
      }
      if (r.value === 'english') await readEnglish();
      else {
        cancelRecording();
        await readPoints();
      }
    }
  }

  async function run(first = 'points') {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    ctrl.current.paused = false; // release a paused reader so it can see the abort
    ctrl.current.repeat = false;
    ctrl.current.resume?.();
    ctrl.current.resume = null;
    setPaused(false);
    cancelRecording();
    if (first === 'points') await readPoints();
    else await readEnglish();
    await askConsent();
  }

  // Started by the "Listen and give consent" tap, so the browser allows audio.
  useEffect(() => {
    run();
    return () => {
      abortRef.current?.abort();
      stopSpeaking();
      cancelRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agreeByButton = () => {
    abortRef.current?.abort(); // stop listening; the recording (if any) is kept
    abortRef.current = new AbortController();
    stopSpeaking();
    upload('button', '');
  };

  if (phase === 'emergency') return <EmergencyPanel lang={lang} onClose={onClose} />;

  return (
    <section className="readback" lang={lang}>
      <ol className="readback-points">
        {lines.map((line, i) => (
          <li key={i} className={i === current ? 'is-current' : ''} aria-current={i === current ? 'step' : undefined}>
            {line}
          </li>
        ))}
      </ol>

      {phase === 'reading' && (
        <div className="readback-controls" role="group" aria-label="Reading controls">
          <button type="button" className="btn btn-primary" onClick={paused ? resume : pause}>
            {paused ? `▶ ${t(lang, 'resume')}` : `❚❚ ${t(lang, 'pause')}`}
          </button>
          <button type="button" className="btn" onClick={repeatPoint}>
            ↻ {t(lang, 'repeatPoint')}
          </button>
          <div className="speed">
            <button type="button" className="btn" onClick={() => changeSpeed(-0.15)} disabled={rate <= RATE_MIN}>
              {t(lang, 'slower')}
            </button>
            <span className="speed-value">{t(lang, 'speed', { n: rate.toFixed(2).replace(/0$/, '') })}</span>
            <button type="button" className="btn" onClick={() => changeSpeed(0.15)} disabled={rate >= RATE_MAX}>
              {t(lang, 'faster')}
            </button>
          </div>
        </div>
      )}

      <ArziSays text={said} speaking={phase === 'reading' && !paused} voiceless={voiceless} />
      {voice.phase === 'listening' && <LiveTranscript lang={lang} text={voice.interim} listening />}
      {recording && (
        <p className="rec-badge" role="status">
          <span className="rec-dot" aria-hidden="true" /> {t(lang, 'recordingNow')}
        </p>
      )}
      {phase === 'fallback' && fallbackMsg && <p className="keyboard-help">{t(lang, fallbackMsg)}</p>}
      {phase === 'saving' && <p className="muted">{t(lang, 'saving')}</p>}
      {phase === 'failed' && <p className="warning">{t(lang, 'saveFailed')}</p>}

      {['asking', 'fallback', 'declined', 'failed', 'reading'].includes(phase) && (
        <div className="readback-buttons">
          {phase !== 'reading' && phase !== 'declined' && (
            <button type="button" className="btn btn-primary btn-big" onClick={agreeByButton}>
              {t(lang, 'agreeButton')}
            </button>
          )}
          <button type="button" className="btn btn-big" onClick={() => run('points')}>
            {t(lang, 'readAgain')}
          </button>
          <button type="button" className="btn btn-big" onClick={() => run('english')}>
            {t(lang, 'hearEnglish')}
          </button>
        </div>
      )}
    </section>
  );
}
