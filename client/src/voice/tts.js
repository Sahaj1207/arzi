// Browser text-to-speech. Picks the best installed voice for the language.
// Returns a promise that resolves when speaking ends (or immediately if no voice
// exists, so the caller can rely on on-screen text instead).
import { getLanguage } from '@arzi/shared';
import { hasSpeechSynthesis } from './support.js';
import { getRate } from '../lib/prefs.js';
import { api } from '../lib/api.js';
import { getUserId } from '../lib/userId.js';
import { getRuntimeConfig, aiServiceUp, markAiFailed } from '../lib/ai.js';

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

// ---- Sarvam voice (bulbul:v3), used only when the browser has no voice for
// the language (common for Telugu, and Hindi/Marathi on some desktops), the
// server has a key and the citizen agreed to AI. Failure → text highlight.
let currentAudio = null;

async function speakWithSarvam(text, langCode, rate) {
  const r = await api('/ai/tts', { method: 'POST', body: { userId: getUserId(), lang: langCode, text, aiConsent: 'yes' } });
  if (!r.ok) {
    markAiFailed('tts', r.error);
    return { spoken: false };
  }
  for (const clip of r.data.audios) {
    const ok = await new Promise((resolve) => {
      const audio = new Audio(`data:audio/wav;base64,${clip}`);
      audio.playbackRate = Math.min(1.3, Math.max(0.7, rate / 0.92));
      currentAudio = audio;
      audio.onended = () => resolve(true);
      audio.onpause = () => resolve(audio.ended); // stopSpeaking() pauses
      audio.onerror = () => resolve(false);
      audio.play().catch(() => resolve(false));
    });
    // Stopped on purpose (stopSpeaking cleared currentAudio) counts as spoken; a playback error does not.
    if (!ok) return { spoken: currentAudio === null };
  }
  currentAudio = null;
  return { spoken: true };
}

const sarvamVoiceAllowed = () => getRuntimeConfig()?.tts === 'sarvam' && aiServiceUp('tts');

export async function speak(text, langCode, { rate = getRate() } = {}) {
  const { speechTag } = getLanguage(langCode);
  const voice = hasSpeechSynthesis() ? pickVoice(await loadVoices(), speechTag) : null;
  if (!voice) return sarvamVoiceAllowed() ? speakWithSarvam(text, langCode, rate) : { spoken: false };

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
  const a = currentAudio;
  currentAudio = null;
  a?.pause();
}
