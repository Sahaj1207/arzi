// Outside AI services, used only when a key is set AND the citizen said yes to the
// consent question (the browser sends aiConsent=yes; without it we refuse).
// Speech-to-text: Sarvam, then Groq (free backup). Voice + understanding: Sarvam.
// Every route answers a failure with { error, fallback } so the browser switches
// back to free browser speech / demo parsing and keeps going.
//
//   POST /api/ai/stt?userId=&lang=&aiConsent=yes   body: recorded audio → { text, provider }
//   POST /api/ai/tts      { userId, lang, text, aiConsent }       → { audios: [base64 wav] }
//   POST /api/ai/extract  { userId, lang, field, text, aiConsent } → { value } | { value: null }
//   POST /api/ai/intent   { userId, lang, text, aiConsent }        → { intent }
//   POST /api/ai/story    { userId, lang, text, aiConsent }        → { fields, facts }
import express, { Router } from 'express';
import { FIELDS, getField, isValidFieldValue, LANGUAGES } from '@arzi/shared';
import { synthesize, chat, sarvamConfigured } from '../providers/sarvam.js';
import { ProviderError } from '../providers/errors.js';
import { transcribeWithFallback, sttChain } from '../providers/speech.js';
import { takeQuota } from '../usage.js';

export const aiRouter = Router();
const LANG_CODES = new Set(LANGUAGES.map((l) => l.code));
const USER_ID = /^[A-Za-z0-9-]{8,64}$/;
const AUDIO_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg']);

// Shared checks: key present, consent given, valid user, quota left.
// configured: is there a service for this job (Sarvam by default).
function guard(req, { userId, lang, aiConsent }, configured = sarvamConfigured) {
  if (!configured()) throw new ProviderError('not_configured', 'no key');
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
    guard(req, { userId, lang, aiConsent }, () => sttChain().length > 0);
    const mime = String(req.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
    if (!AUDIO_TYPES.has(mime) || !req.body?.length) throw new ProviderError('bad_request', 'no audio');
    res.json(await transcribeWithFallback(req.body, mime, lang));
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

// The model's JSON for one field → a checked value, or null. Same rules for one
// answer (/extract) and for a whole story (/story).
function normalizeValue(field, v, today) {
  // {"value": null} is the model saying "not in the answer". (A duration also has a
  // `value` key, so only that exact "unsure" shape is refused here.)
  if (!v || typeof v !== 'object' || ('value' in v && !v.kind)) return null;
  if (field.type === 'pending' && v.kind === 'duration' && DAYS[v.unit]) {
    const n = Number(v.value);
    v = { kind: 'duration', value: n, unit: v.unit, days: Math.round(n * DAYS[v.unit]), sinceIso: shiftBack(today, n, v.unit) };
  }
  if (field.type === 'amount') v = { amount: Math.round(Number(v.amount)) };
  if ((field.type === 'name' || field.type === 'address') && typeof v.text === 'string') v = { text: v.text.trim().slice(0, 300) };
  if (v.iso && v.iso > today) return null;
  return isValidFieldValue(field, v) ? v : null;
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
    res.json({ value: normalizeValue(field, parseJsonReply(reply), today) });
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

// AI mode, after the citizen told the whole story: every one of the 7 details
// that is CLEARLY in it, plus up to 4 extra facts worth putting in the notice
// (the landlord's excuse, deductions, damage claims, promises made…).
// Facts come back twice: in English for the notice, and in the citizen's language
// for the read-back. Nothing is guessed; the citizen confirms everything, and the
// advocate checks the notice.
const LANG_NAME = { hi: 'Hindi', mr: 'Marathi', en: 'English', te: 'Telugu' };
const factText = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 240);

aiRouter.post('/story', async (req, res) => {
  try {
    const { userId, lang, text, aiConsent } = req.body ?? {};
    guard(req, { userId, lang, aiConsent });
    if (!text || typeof text !== 'string') throw new ProviderError('bad_request', 'no text');
    const today = new Date().toISOString().slice(0, 10);
    const shapes = FIELDS.map((f) => `"${f.id}": ${SHAPES[f.type]}  // ${f.question.en}`).join('\n');

    const reply = await chat(
      [
        {
          role: 'system',
          content:
            'You read the story of an Indian tenant whose landlord or PG owner has not returned the security deposit ' +
            '(Hindi, Marathi, Telugu, English or a mix). ' +
            `Today is ${today}. Dates are in the past. Indian numbering: hazaar/వేలు = thousand, lakh = 100,000.\n` +
            'Reply with JSON only: {"fields": {...}, "facts": [...]}.\n' +
            `"fields": include ONLY the details the person clearly said, with these shapes:\n${shapes}\n` +
            'Names and addresses exactly as said, in the same script. Leave out anything not clearly said. Never guess.\n' +
            '"facts": up to 4 other facts from the story that matter for a legal notice about the deposit ' +
            "(the landlord's reason or excuse for not paying, deductions claimed, damage alleged, promises to pay, " +
            'when the person asked for the money). Do NOT repeat the 7 details above. Each fact: ' +
            `{"en": "<one short sentence in English, first person (I/my), neutral, no legal claims>", "local": "<the same in ${LANG_NAME[lang] ?? 'English'}>"}. ` +
            'If there are no such facts, "facts": [].',
        },
        { role: 'user', content: text.slice(0, 4000) },
      ],
      { maxTokens: 900 },
    );
    const data = parseJsonReply(reply) ?? {};
    const fields = {};
    for (const f of FIELDS) {
      const v = normalizeValue(f, data.fields?.[f.id], today);
      if (v) fields[f.id] = v;
    }
    const facts = (Array.isArray(data.facts) ? data.facts : [])
      .map((x) => ({ en: factText(x?.en), local: factText(x?.local) }))
      .filter((x) => x.en.length >= 8 && x.local.length >= 4)
      .slice(0, 4);
    res.json({ fields, facts });
  } catch (err) {
    fail(res, err);
  }
});
