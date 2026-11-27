// Sarvam AI client (https://docs.sarvam.ai, checked 2026-11-27). Plain fetch, no SDK.
//   transcribe()   POST /speech-to-text   model saaras:v4 (multipart; webm/ogg/wav ok; < 30 s)
//   synthesize()   POST /text-to-speech   model bulbul:v3 (JSON; returns base64 WAV in audios[])
//   chat()         POST /v1/chat/completions  model sarvam-105b-conversations
//   transliterate() POST /transliterate   e.g. te-IN → en-IN
// The key is read only here, on the server. Every failure becomes a ProviderError
// with a `kind` the caller can act on: 'quota' (out of credits / rate limit),
// 'auth' (bad key), 'unavailable' (timeout, 5xx), 'bad_request', 'not_configured'.
import { config } from '../config.js';
import { ProviderError } from './errors.js';

// SARVAM_BASE_URL exists only so tests can point at a fake Sarvam server.
const BASE = process.env.SARVAM_BASE_URL || 'https://api.sarvam.ai';
export const STT_MODEL = 'saaras:v4';
export const TTS_MODEL = 'bulbul:v3';
export const CHAT_MODEL = 'sarvam-105b-conversations';
const TTS_SPEAKER = process.env.SARVAM_TTS_SPEAKER || 'priya';

export { ProviderError };

export const sarvamConfigured = () => Boolean(config.keys.sarvam);

const LANG_TAG = { hi: 'hi-IN', mr: 'mr-IN', en: 'en-IN', te: 'te-IN' };
export const sarvamLang = (lang) => LANG_TAG[lang] ?? 'unknown';

async function call(path, { json, form, timeoutMs }) {
  if (!config.keys.sarvam) throw new ProviderError('not_configured', 'SARVAM_API_KEY not set');
  const headers = { 'api-subscription-key': config.keys.sarvam };
  if (path.startsWith('/v1/')) headers.Authorization = `Bearer ${config.keys.sarvam}`; // chat lists both
  if (json) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(BASE + path, {
      method: 'POST',
      headers,
      body: json ? JSON.stringify(json) : form,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new ProviderError('unavailable', `Sarvam ${path}: ${err.name === 'TimeoutError' ? 'timeout' : err.message}`);
  }
  if (res.ok) return res.json();

  const body = await res.json().catch(() => null);
  const code = body?.error?.code ?? '';
  const message = `Sarvam ${path} ${res.status}: ${body?.error?.message ?? res.statusText}`;
  if (res.status === 429 || code === 'insufficient_quota_error' || code === 'rate_limit_exceeded_error') {
    throw new ProviderError('quota', message, res.status);
  }
  if (res.status === 401 || res.status === 403 || code === 'invalid_api_key_error' || code === 'authentication_error') {
    throw new ProviderError('auth', message, res.status);
  }
  if (res.status >= 500) throw new ProviderError('unavailable', message, res.status);
  throw new ProviderError('bad_request', message, res.status);
}

// audio: Buffer, mime: e.g. 'audio/webm'. Returns { text, languageCode }.
export async function transcribe(audio, mime, lang) {
  const form = new FormData();
  const ext = mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : mime.includes('mp4') ? 'm4a' : 'webm';
  form.append('file', new Blob([audio], { type: mime }), `answer.${ext}`);
  form.append('model', STT_MODEL);
  form.append('mode', 'transcribe');
  form.append('language_code', sarvamLang(lang));
  const r = await call('/speech-to-text', { form, timeoutMs: 20000 });
  return { text: String(r.transcript ?? '').trim(), languageCode: r.language_code ?? null };
}

// Returns an array of base64 WAV clips to play in order.
export async function synthesize(text, lang) {
  const r = await call('/text-to-speech', {
    json: {
      text: text.slice(0, 2500),
      language_code: sarvamLang(lang) === 'unknown' ? 'en-IN' : sarvamLang(lang),
      model: TTS_MODEL,
      speaker: TTS_SPEAKER,
      pace: 0.95,
      speech_sample_rate: 22050,
      output_audio_codec: 'wav',
    },
    timeoutMs: 15000,
  });
  if (!Array.isArray(r.audios) || r.audios.length === 0) throw new ProviderError('unavailable', 'Sarvam TTS: no audio');
  return r.audios;
}

// Returns the assistant's text.
export async function chat(messages, { maxTokens = 300 } = {}) {
  const r = await call('/v1/chat/completions', {
    json: { model: CHAT_MODEL, messages, temperature: 0, max_tokens: maxTokens, reasoning_effort: null },
    timeoutMs: 20000,
  });
  return String(r.choices?.[0]?.message?.content ?? '');
}

export async function transliterate(input, sourceLang) {
  const r = await call('/transliterate', {
    json: { input, source_language_code: sourceLang, target_language_code: 'en-IN', numerals_format: 'international' },
    timeoutMs: 10000,
  });
  return String(r.transliterated_text ?? '').trim();
}
