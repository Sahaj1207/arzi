// Paid AI services, used only when SARVAM_API_KEY is set AND the citizen said yes
// to the consent question (the browser sends aiConsent=yes; without it we refuse).
// Every route answers a failure with { error, fallback } so the browser switches
// back to free browser speech / demo parsing and keeps going.
//
//   POST /api/ai/stt?userId=&lang=&aiConsent=yes   body: recorded audio → { text }
//   POST /api/ai/tts      { userId, lang, text, aiConsent }       → { audios: [base64 wav] }
//   POST /api/ai/extract  { userId, lang, field, text, aiConsent } → { value } | { value: null }
//   POST /api/ai/intent   { userId, lang, text, aiConsent }        → { intent }
import express, { Router } from 'express';
import { getField, isValidFieldValue, LANGUAGES } from '@arzi/shared';
import { transcribe, synthesize, chat, sarvamConfigured, ProviderError } from '../providers/sarvam.js';
import { takeQuota } from '../usage.js';

export const aiRouter = Router();
const LANG_CODES = new Set(LANGUAGES.map((l) => l.code));
const USER_ID = /^[A-Za-z0-9-]{8,64}$/;
const AUDIO_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg']);

// Shared checks: key present, consent given, valid user, quota left.
function guard(req, { userId, lang, aiConsent }) {
  if (!sarvamConfigured()) throw new ProviderError('not_configured', 'no key');
  if (aiConsent !== true && aiConsent !== 'yes') throw new ProviderError('no_consent', 'citizen did not agree to AI');
  if (!USER_ID.test(userId ?? '')) throw new ProviderError('bad_request', 'invalid user');
  if (lang && !LANG_CODES.has(lang)) throw new ProviderError('bad_request', 'invalid language');
  takeQuota({ userId, ip: req.ip });
}

const STATUS = { not_configured: 503, no_consent: 403, limit: 429, quota: 503, auth: 503, unavailable: 503, bad_request: 400 };
function fail(res, err) {
  const kind = err instanceof ProviderError ? err.kind : 'unavailable';
  if (!(err instanceof ProviderError)) console.error('[ai] unexpected:', err);
  else if (kind !== 'no_consent' && kind !== 'not_configured') console.warn(`[ai] ${kind}: ${err.message}`);
  res.status(STATUS[kind] ?? 503).json({ error: kind, fallback: 'browser' });
}

aiRouter.post('/stt', express.raw({ type: () => true, limit: 4 * 1024 * 1024 }), async (req, res) => {
  try {
    const { userId, lang, aiConsent } = req.query;
    guard(req, { userId, lang, aiConsent });
    const mime = String(req.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
    if (!AUDIO_TYPES.has(mime) || !req.body?.length) throw new ProviderError('bad_request', 'no audio');
    const { text, languageCode } = await transcribe(req.body, mime, lang);
    res.json({ text, languageCode });
  } catch (err) {
    fail(res, err);
  }
});

aiRouter.post('/tts', async (req, res) => {
  try {
    const { userId, lang, text, aiConsent } = req.body ?? {};
    guard(req, { userId, lang, aiConsent });
    if (!text || typeof text !== 'string') throw new ProviderError('bad_request', 'no text');
    res.json({ audios: await synthesize(text, lang), format: 'wav' });
  } catch (err) {
    fail(res, err);
  }
});

// ---------- LLM helpers: understanding free-form answers ----------
// The LLM only PROPOSES a value. The interview still reads it back and the
// citizen must confirm it, exactly like a value parsed without AI.
const SHAPES = {
  name: '{"text": "<the person\'s name exactly as said, in the same script>"}',
  address: '{"text": "<the full address exactly as said, in the same script>"}',
  amount: '{"amount": <integer rupees>}',
  date: '{"iso": "YYYY-MM-DD", "precision": "day" or "month"}',
  pending:
    '{"kind": "date", "iso": "YYYY-MM-DD", "precision": "day" or "month"}  OR  {"kind": "duration", "value": <number>, "unit": "day"|"week"|"month"|"year"}',
};
const DAYS = { day: 1, week: 7, month: 30, year: 365 };

export function parseJsonReply(text) {
  const cleaned = String(text).replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function shiftBack(today, value, unit) {
  const d = new Date(`${today}T00:00:00Z`);
  if (unit === 'month') d.setUTCMonth(d.getUTCMonth() - Math.round(value));
  else if (unit === 'year') d.setUTCFullYear(d.getUTCFullYear() - Math.round(value));
  else d.setUTCDate(d.getUTCDate() - Math.round(value * DAYS[unit]));
  return d.toISOString().slice(0, 10);
}

aiRouter.post('/extract', async (req, res) => {
  try {
    const { userId, lang, field: fieldId, text, aiConsent } = req.body ?? {};
    guard(req, { userId, lang, aiConsent });
    const field = getField(fieldId);
    if (!field || !text) throw new ProviderError('bad_request', 'bad field or text');
    const today = new Date().toISOString().slice(0, 10);

    const reply = await chat([
      {
        role: 'system',
        content:
          'You read one answer spoken by an Indian tenant (Hindi, Marathi, Telugu, English or a mix) and extract one fact. ' +
          `Today is ${today}. Dates are in the past. Indian numbering: hazaar/వేలు = thousand, lakh = 100,000. ` +
          `Reply with JSON only, in this shape: ${SHAPES[field.type]}. If the answer does not clearly contain the fact, reply {"value": null}. Never guess.`,
      },
      { role: 'user', content: `Question: ${field.question.en}\nAnswer: ${String(text).slice(0, 600)}` },
    ]);
    let v = parseJsonReply(reply);
    if (v && field.type === 'pending' && v.kind === 'duration' && DAYS[v.unit]) {
      v = { kind: 'duration', value: Number(v.value), unit: v.unit, days: Math.round(Number(v.value) * DAYS[v.unit]), sinceIso: shiftBack(today, Number(v.value), v.unit) };
    }
    if (v && field.type === 'amount') v = { amount: Math.round(Number(v.amount)) };
    const ok = v && !('value' in v) && isValidFieldValue(field, v) && !(v.iso && v.iso > today);
    res.json({ value: ok ? v : null });
  } catch (err) {
    fail(res, err);
  }
});

aiRouter.post('/intent', async (req, res) => {
  try {
    const { userId, lang, text, aiConsent } = req.body ?? {};
    guard(req, { userId, lang, aiConsent });
    const reply = await chat(
      [
        {
          role: 'system',
          content:
            'Classify what an Indian citizen said (any Indian language or mix). Reply JSON only: {"intent": "deposit"} if it is about a landlord, PG or hostel owner not returning a security deposit or advance; {"intent": "emergency"} if it mentions violence, threats to safety or an emergency; otherwise {"intent": "other"}.',
        },
        { role: 'user', content: String(text ?? '').slice(0, 800) },
      ],
      { maxTokens: 30 },
    );
    const intent = parseJsonReply(reply)?.intent;
    res.json({ intent: ['deposit', 'emergency', 'other'].includes(intent) ? intent : null });
  } catch (err) {
    fail(res, err);
  }
});
