// Groq speech-to-text: the free backup when Sarvam fails (https://console.groq.com/docs/speech-to-text,
// checked 2026-11-27). Plain fetch, no SDK.
//   transcribe()  POST /openai/v1/audio/transcriptions  model whisper-large-v3
//                 multipart: file (webm/ogg/wav/m4a ok, 25 MB on the free plan), model, language (ISO-639-1)
//                 response_format=json → { text }
// Free-plan limits for whisper-large-v3: 20 requests/minute and 2,000/day (plus audio-seconds caps).
// We count our own requests and stop BEFORE Groq says no, and on a 429 we also
// respect its retry-after. Either way the caller gets ProviderError('quota') and
// the browser falls back to its own speech.
import { config } from '../config.js';
import { ProviderError } from './errors.js';

// GROQ_BASE_URL exists only so tests can point at a fake Groq server.
const BASE = process.env.GROQ_BASE_URL || 'https://api.groq.com';
export const GROQ_STT_MODEL = 'whisper-large-v3';
const LANG = { hi: 'hi', mr: 'mr', en: 'en', te: 'te' };

export const groqConfigured = () => Boolean(config.keys.groq);

// ---- our own rate limiter (one server process, so memory is enough) ----
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const sent = []; // timestamps of requests in the last 24 h
let blockedUntil = 0; // set from Groq's retry-after on a 429

export function groqLimits() {
  return { perMinute: config.limits.groqPerMinute, perDay: config.limits.groqPerDay };
}

function takeGroqSlot(now = Date.now()) {
  while (sent.length && sent[0] <= now - DAY) sent.shift();
  if (now < blockedUntil) throw new ProviderError('quota', 'Groq: waiting for retry-after', null, blockedUntil - now);
  const lastMinute = sent.filter((t) => t > now - MINUTE);
  const { perMinute, perDay } = groqLimits();
  if (lastMinute.length >= perMinute) {
    throw new ProviderError('quota', `Groq: ${perMinute} requests/minute reached`, null, lastMinute[0] + MINUTE - now);
  }
  if (sent.length >= perDay) throw new ProviderError('quota', `Groq: ${perDay} requests/day reached`, null, sent[0] + DAY - now);
  sent.push(now);
}

// For tests.
export function resetGroqLimiter() {
  sent.length = 0;
  blockedUntil = 0;
}

// audio: Buffer, mime: e.g. 'audio/webm'. Returns { text }.
export async function transcribe(audio, mime, lang) {
  if (!config.keys.groq) throw new ProviderError('not_configured', 'GROQ_API_KEY not set');
  takeGroqSlot();

  const form = new FormData();
  const ext = mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : mime.includes('mp4') ? 'm4a' : 'webm';
  form.append('file', new Blob([audio], { type: mime }), `answer.${ext}`);
  form.append('model', GROQ_STT_MODEL);
  form.append('response_format', 'json');
  form.append('temperature', '0');
  if (LANG[lang]) form.append('language', LANG[lang]);

  let res;
  try {
    res = await fetch(`${BASE}/openai/v1/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.keys.groq}` },
      body: form,
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new ProviderError('unavailable', `Groq: ${err.name === 'TimeoutError' ? 'timeout' : err.message}`);
  }
  if (res.ok) {
    const r = await res.json().catch(() => null);
    return { text: String(r?.text ?? '').trim() };
  }

  const body = await res.json().catch(() => null);
  const message = `Groq ${res.status}: ${body?.error?.message ?? res.statusText}`;
  if (res.status === 429) {
    const wait = Number.parseFloat(res.headers.get('retry-after') ?? '');
    const waitMs = Number.isFinite(wait) && wait > 0 ? wait * 1000 : MINUTE;
    blockedUntil = Date.now() + waitMs;
    throw new ProviderError('quota', message, 429, waitMs);
  }
  if (res.status === 401 || res.status === 403) throw new ProviderError('auth', message, res.status);
  if (res.status >= 500 || res.status === 498 || res.status === 499) throw new ProviderError('unavailable', message, res.status);
  throw new ProviderError('bad_request', message, res.status);
}
