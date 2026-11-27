// Time-unit words (day / week / month / year) in English, Hindi and Marathi.
// Devanagari entries are stems: a token that STARTS with the stem matches,
// so महिन्यांपासून ("for months") still counts as "month".
import { normalize } from './normalize.js';

const UNIT_STEMS = {
  day: ['day', 'days', 'din', 'dino', 'दिन', 'दिवस', 'రోజు', 'రోజుల', 'దినాల'],
  week: ['week', 'weeks', 'hafta', 'hafte', 'hafton', 'हफ्त', 'हफ्ते', 'सप्ताह', 'आठवड', 'వారం', 'వారాల', 'వారాలు'],
  month: ['month', 'months', 'mahina', 'mahine', 'mahino', 'mahinon', 'महीन', 'महिन', 'నెల'],
  year: ['year', 'years', 'saal', 'sal', 'baras', 'साल', 'वर्ष', 'बरस', 'సంవత్సర', 'ఏడాది', 'ఏళ్ల'],
};

export const DAYS_PER_UNIT = { day: 1, week: 7, month: 30, year: 365 };

const ROMAN = new Map();
const DEVANAGARI = [];
for (const [unit, words] of Object.entries(UNIT_STEMS)) {
  for (const w of words) {
    const n = normalize(w);
    if (/^[a-z]+$/.test(n)) ROMAN.set(n, unit);
    else DEVANAGARI.push([n, unit]);
  }
}

// Returns 'day' | 'week' | 'month' | 'year' | null.
export function durationUnit(token) {
  if (!token) return null;
  if (ROMAN.has(token)) return ROMAN.get(token);
  for (const [stem, unit] of DEVANAGARI) if (token.startsWith(stem)) return unit;
  return null;
}

export const isDurationUnit = (token) => durationUnit(token) !== null;
