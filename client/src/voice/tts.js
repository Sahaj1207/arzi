// Browser text-to-speech. Picks the best installed voice for the language.
// Returns a promise that resolves when speaking ends (or immediately if no voice
// exists, so the caller can rely on on-screen text instead).
import { getLanguage } from '@arzi/shared';
import { hasSpeechSynthesis } from './support.js';
import { getRate } from '../lib/prefs.js';

// Voices load asynchronously; start loading as soon as this file is imported.
if (hasSpeechSynthesis()) speechSynthesis.getVoices();

function loadVoices() {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500); // some browsers never fire voiceschanged
  });
}

// Prefer exact locale (hi-IN), then same language (hi), then Google/Microsoft
// network voices, which sound more natural than the default local ones.
export function pickVoice(voices, speechTag) {
  const base = speechTag.split('-')[0];
  const score = (v) =>
    (v.lang === speechTag ? 4 : 0) +
    (v.lang.split(/[-_]/)[0] === base ? 2 : 0) +
    (/google|microsoft|natural/i.test(v.name) ? 1 : 0);
  const best = voices.filter((v) => v.lang.split(/[-_]/)[0] === base).sort((a, b) => score(b) - score(a))[0];
  return best ?? null;
}

export async function speak(text, langCode, { rate = getRate() } = {}) {
  if (!hasSpeechSynthesis()) return { spoken: false };
  const { speechTag } = getLanguage(langCode);
  const voice = pickVoice(await loadVoices(), speechTag);
  if (!voice) return { spoken: false };

  speechSynthesis.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = rate;

    let settled = false;
    const done = (spoken) => {
      if (settled) return;
      settled = true;
      clearTimeout(safety);
      clearInterval(keepAlive);
      resolve({ spoken });
    };

    // Chrome sometimes never fires `onend` (no audio device, background tab),
    // which would freeze the conversation. Give up after a generous estimate.
    const expectedMs = (text.length * 85) / rate;
    const safety = setTimeout(() => {
      speechSynthesis.cancel();
      done(true);
    }, expectedMs + 4000);

    // Chrome on desktop silently stops utterances longer than ~15 s unless nudged.
    const keepAlive = setInterval(() => {
      if (speechSynthesis.speaking && !speechSynthesis.paused) {
        speechSynthesis.pause();
        speechSynthesis.resume();
      }
    }, 10000);

    u.onend = () => done(true);
    u.onerror = (e) => done(e.error === 'interrupted' || e.error === 'canceled' ? true : false);
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (hasSpeechSynthesis()) speechSynthesis.cancel();
}
