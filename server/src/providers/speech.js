// Speech-to-text with server-side fallback: Sarvam first, then Groq, for the SAME
// recording, so the citizen is not asked again when the first service fails.
// If every configured service fails, the route answers { fallback: 'browser' } and
// the browser switches to its own free speech recognition.
//
// A service that ran out of credits or rejected the key is skipped for a while
// (it is the same key for every user), so later answers don't wait on it.
import { config } from '../config.js';
import { ProviderError } from './errors.js';
import * as sarvam from './sarvam.js';
import * as groq from './groq.js';

const SERVICES = {
  sarvam: { configured: () => Boolean(config.keys.sarvam), transcribe: sarvam.transcribe },
  groq: { configured: () => Boolean(config.keys.groq), transcribe: groq.transcribe },
};
export const STT_ORDER = ['sarvam', 'groq'];

const COOL_DOWN = { quota: 10 * 60_000, auth: 30 * 60_000, unavailable: 60_000 };
const skipUntil = new Map();

export const sttChain = () => STT_ORDER.filter((name) => SERVICES[name].configured());

export function resetSttCooldowns() {
  skipUntil.clear();
}

// Returns { text, provider }. Throws the most telling ProviderError if all fail.
export async function transcribeWithFallback(audio, mime, lang) {
  const chain = sttChain();
  if (!chain.length) throw new ProviderError('not_configured', 'no speech-to-text key');
  let lastErr = null;
  for (const name of chain) {
    if (Date.now() < (skipUntil.get(name) ?? 0)) continue;
    try {
      const { text } = await SERVICES[name].transcribe(audio, mime, lang);
      return { text, provider: name };
    } catch (err) {
      const e = err instanceof ProviderError ? err : new ProviderError('unavailable', String(err?.message ?? err));
      const rest = e.retryMs ?? COOL_DOWN[e.kind];
      if (rest) skipUntil.set(name, Date.now() + rest);
      console.warn(`[stt] ${name} failed (${e.kind}): ${e.message}${chain.at(-1) === name ? '' : '; trying the next service'}`);
      lastErr = e;
    }
  }
  throw lastErr ?? new ProviderError('quota', 'all speech services are resting after errors');
}
