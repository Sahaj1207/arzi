// Reads dates and time periods from speech.
//   parseDate("15 March 2026")        → { iso: '2026-03-15', precision: 'day' }
//   parseDate("15/3/26")              → day-first, Indian style
//   parseDate("पंद्रह मार्च")             → most recent past 15 March
//   parseDate("March 2026")           → { iso: '2026-03-01', precision: 'month' }
//   parseDate("do mahine pehle")      → today minus 2 months (precision 'month')
//   parseDuration("teen mahine se")   → { value: 3, unit: 'month', days: 90 }
//   parsePending(...)                 → a date OR a duration, for "how long pending"
// Anything unclear returns null so Arzi asks again.
import { normalize, tokenize, hasAny } from './normalize.js';
import { digitValue, wordValue, MODIFIERS } from './numberWords.js';
import { durationUnit, DAYS_PER_UNIT } from './units.js';

const MONTH_WORDS = [
  ['january', 'jan', 'जनवरी', 'जानेवारी', 'జనవరి'],
  ['february', 'feb', 'फरवरी', 'फ़रवरी', 'फेब्रुवारी', 'ఫిబ్రవరి', 'ఫిబ్రవరీ'],
  ['march', 'mar', 'मार्च', 'మార్చి', 'మార్చ్'],
  ['april', 'apr', 'अप्रैल', 'अप्रेल', 'एप्रिल', 'ఏప్రిల్', 'ఏప్రిల'],
  ['may', 'मई', 'मे', 'మే'],
  ['june', 'jun', 'जून', 'జూన్', 'జూను'],
  ['july', 'jul', 'जुलाई', 'जुलै', 'జూలై', 'జులై'],
  ['august', 'aug', 'अगस्त', 'ऑगस्ट', 'ఆగస్టు', 'ఆగస్ట్'],
  ['september', 'sep', 'sept', 'सितंबर', 'सितम्बर', 'सप्टेंबर', 'సెప్టెంబర్', 'సెప్టెంబరు'],
  ['october', 'oct', 'अक्टूबर', 'अक्तूबर', 'ऑक्टोबर', 'అక్టోబర్', 'అక్టోబరు'],
  ['november', 'nov', 'नवंबर', 'नवम्बर', 'नोव्हेंबर', 'నవంబర్', 'నవంబరు'],
  ['december', 'dec', 'दिसंबर', 'दिसम्बर', 'डिसेंबर', 'డిసెంబర్', 'డిసెంబరు'],
];
const MONTHS = new Map();
MONTH_WORDS.forEach((words, i) => words.forEach((w) => MONTHS.set(normalize(w), i + 1)));
// Marathi adds case endings: मार्चमध्ये, एप्रिलला. Match month at the start of a token.
const monthOf = (tok) => {
  if (MONTHS.has(tok)) return MONTHS.get(tok);
  if (/^[a-z]/.test(tok)) return null; // English needs an exact word ("may" vs "mayank")
  for (const [w, m] of MONTHS) if (w.length >= 3 && /^[^a-z]/.test(w) && tok.startsWith(w)) return m;
  return null;
};

const WEAK_MONTHS = new Set(['may', 'mar', 'मे', 'మే'].map(normalize));

const AGO_WORDS = ['ago', 'back', 'before', 'pehle', 'pahle', 'pehale', 'पहले', 'पूर्वी', 'आधी', 'agodar', 'अगोदर', 'క్రితం', 'ముందు'];
const LAST_MONTH = [
  'last month', 'pichhle mahine', 'pichle mahine', 'पिछले महीने', 'पिछला महीना', 'मागच्या महिन्यात', 'गेल्या महिन्यात',
  'मागील महिन्यात', 'గత నెల', 'పోయిన నెల', 'పోయిన నెలలో', 'గత నెలలో',
];
const LAST_WEEK = [
  'last week', 'pichhle hafte', 'pichle hafte', 'पिछले हफ्ते', 'पिछले सप्ताह', 'मागच्या आठवड्यात', 'गेल्या आठवड्यात',
  'గత వారం', 'పోయిన వారం',
];
const TODAY = ['today', 'aaj', 'आज', 'ఈరోజు', 'ఇవాళ', 'ఈ రోజు'];
// Hindi "kal" can mean yesterday OR tomorrow, so it is not trusted. Marathi काल and Telugu నిన్న are.
const YESTERDAY = ['yesterday', 'काल', 'నిన్న'];

// ---- small date helpers (all in UTC to avoid timezone surprises) ----
const pad = (n) => String(n).padStart(2, '0');
const toIso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const todayParts = (today) => ({ y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() });

function isRealDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function shift(today, { days = 0, months = 0, years = 0 }) {
  const { y, m, d } = todayParts(today);
  const dt = new Date(Date.UTC(y + years, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(d, lastDay));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

const fullYear = (y) => (y < 100 ? 2000 + y : y);

function result(y, m, d, precision, today, allowFuture) {
  if (!isRealDate(y, m, d)) return null;
  const iso = toIso(y, m, d);
  const { y: ty, m: tm, d: td } = todayParts(today);
  if (!allowFuture && iso > toIso(ty, tm, td)) return null;
  if (y < 1990) return null;
  return { iso, precision };
}

// A number token that could be a day of the month (digits or words, 1–31).
const dayValue = (tok) => {
  const v = digitValue(tok) ?? wordValue(tok);
  return v !== null && Number.isInteger(v) && v >= 1 && v <= 31 ? v : null;
};
const yearValue = (tok) => {
  const v = digitValue(tok);
  return v !== null && Number.isInteger(v) && v >= 1990 && v <= 2100 ? v : null;
};

// Returns { iso, precision: 'day' | 'month' } or null.
export function parseDate(text, { today = new Date(), allowFuture = false } = {}) {
  const norm = normalize(text);
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  // 1. ISO: 2026-03-15
  let m = norm.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return result(+m[1], +m[2], +m[3], 'day', today, allowFuture);

  // 2. Numeric day-first: 15/03/2026, 15-3-26, 15.03.2026
  m = norm.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
  if (m) return result(fullYear(+m[3]), +m[2], +m[1], 'day', today, allowFuture);

  // 3. Month name, with day and/or year around it.
  for (let mi = 0; mi < tokens.length; mi++) {
    const month = monthOf(tokens[mi]);
    if (month === null) continue;
    let day = mi > 0 ? dayValue(tokens[mi - 1]) : null; // "15 march"
    if (day === null && tokens[mi + 1] !== undefined && yearValue(tokens[mi + 1]) === null) {
      day = dayValue(tokens[mi + 1]); // "march 15"
    }
    const nextYear = tokens[mi + 1] !== undefined ? yearValue(tokens[mi + 1]) : null;
    // "may" / "मे" are also everyday words ("I may", misspelt "में"): need a day or year beside them.
    if (WEAK_MONTHS.has(tokens[mi]) && day === null && nextYear === null) continue;

    const year = tokens.map(yearValue).find((y) => y !== null) ?? null;
    const precision = day === null ? 'month' : 'day';
    const d = day ?? 1;
    if (year !== null) return result(year, month, d, precision, today, allowFuture);
    // No year said: this year, unless that is still in the future, then last year.
    const { y: ty } = todayParts(today);
    return result(ty, month, d, precision, today, allowFuture) ?? result(ty - 1, month, d, precision, today, allowFuture);
  }

  // 4. Relative: "last month", "3 mahine pehle", "today", "yesterday".
  if (hasAny(tokens, norm, LAST_MONTH)) return { iso: shift(today, { months: -1 }), precision: 'month' };
  if (hasAny(tokens, norm, LAST_WEEK)) return { iso: shift(today, { days: -7 }), precision: 'day' };
  if (hasAny(tokens, norm, YESTERDAY)) return { iso: shift(today, { days: -1 }), precision: 'day' };
  if (hasAny(tokens, norm, AGO_WORDS)) {
    const dur = parseDuration(text);
    if (dur) return { iso: shiftBy(today, dur, -1), precision: dur.unit === 'day' || dur.unit === 'week' ? 'day' : 'month' };
    return null;
  }
  if (hasAny(tokens, norm, TODAY)) return { iso: shift(today, {}), precision: 'day' };

  return null;
}

function shiftBy(today, { value, unit }, sign) {
  if (unit === 'month') return shift(today, { months: sign * value, days: sign * Math.round((value % 1) * 30) });
  if (unit === 'year') return shift(today, { years: sign * Math.trunc(value), months: sign * Math.round((value % 1) * 12) });
  return shift(today, { days: sign * Math.round(value * DAYS_PER_UNIT[unit]) });
}

// "teen mahine", "2 months", "डेढ़ साल", "a week" → { value, unit, days } or null.
export function parseDuration(text) {
  const tokens = tokenize(text);
  for (let i = 0; i < tokens.length; i++) {
    const unit = durationUnit(tokens[i]);
    if (!unit) continue;
    const prev = tokens[i - 1];
    let value = prev === undefined ? null : (digitValue(prev) ?? wordValue(prev));
    if (value !== null && MODIFIERS.has(tokens[i - 2])) value = MODIFIERS.get(tokens[i - 2])(value); // "saade teen mahine"
    if (value === null) continue; // "kai mahine" (many months) is too vague
    if (value <= 0 || value > 600) return null;
    return { value, unit, days: Math.round(value * DAYS_PER_UNIT[unit]) };
  }
  return null;
}

// For the "date deposit was due / how long pending" question.
// Returns { kind: 'date', iso, precision } or { kind: 'duration', value, unit, days, sinceIso }.
export function parsePending(text, { today = new Date() } = {}) {
  const tokens = tokenize(text);
  const norm = normalize(text);
  const saysAgo = hasAny(tokens, norm, AGO_WORDS);
  const dur = parseDuration(text);
  if (dur && !saysAgo && tokens.every((t) => monthOf(t) === null)) {
    return { kind: 'duration', ...dur, sinceIso: shiftBy(today, dur, -1) };
  }
  const date = parseDate(text, { today });
  return date ? { kind: 'date', ...date } : null;
}
