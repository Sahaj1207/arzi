// Browser text-to-speech. Picks the best installed voice for the language.
// Returns a promise that resolves when speaking ends (or immediately if no voice
// exists, so the caller can rely on on-screen text instead).
import { getLanguage } from '@arzi/shared';
import { hasSpeechSynthesis } from './support.js';

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

export async function speak(text, langCode, { rate = 0.92 } = {}) {
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
    u.onend = () => resolve({ spoken: true });
    u.onerror = () => resolve({ spoken: false });
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (hasSpeechSynthesis()) speechSynthesis.cancel();
}
