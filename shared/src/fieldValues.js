// One place that knows, for each field type, how to
//   parse an answer   → a stored value (or null = ask again)
//   display it        → big text on the card
//   speak it          → what Arzi says to confirm (numbers and dates digit by digit)
// Used by the interview (client) and by drafting (server).
import { normalize, tokenize, hasAny } from './parse/normalize.js';
import { extractName, extractAddress } from './parse/name.js';
import { parseAmount } from './parse/amount.js';
import { parseDate, parsePending } from './parse/date.js';
import { SAME_ADDRESS_WORDS } from './fields.js';
import { formatINR, formatDate, formatDuration, speakAmount, speakDate } from './format.js';

// Value shapes:
//   name / address: { text, same? }
//   amount:         { amount }
//   date:           { iso, precision }
//   pending:        { kind: 'date', iso, precision } | { kind: 'duration', value, unit, days, sinceIso }
export function parseFieldAnswer(field, text, { today = new Date(), fields = {} } = {}) {
  switch (field.type) {
    case 'name': {
      const name = extractName(text);
      return name ? { text: name } : null;
    }
    case 'address': {
      if (field.id === 'landlordAddress' && fields.tenantAddress?.text) {
        const tokens = tokenize(text);
        if (tokens.length <= 3 && hasAny(tokens, normalize(text), SAME_ADDRESS_WORDS)) {
          return { text: fields.tenantAddress.text, same: true };
        }
      }
      const address = extractAddress(text);
      return address ? { text: address } : null;
    }
    case 'amount': {
      const a = parseAmount(text);
      return a ? { amount: a.value } : null;
    }
    case 'date':
      return parseDate(text, { today });
    case 'pending':
      return parsePending(text, { today });
    default:
      return null;
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const PRECISION = new Set(['day', 'month']);

// Server-side check that a submitted value has the right shape for its field.
export function isValidFieldValue(field, v) {
  if (!v || typeof v !== 'object') return false;
  switch (field.type) {
    case 'name':
    case 'address':
      return typeof v.text === 'string' && v.text.trim().length >= 2 && v.text.length <= 300;
    case 'amount':
      return Number.isInteger(v.amount) && v.amount >= 100 && v.amount <= 10_000_000;
    case 'date':
      return ISO.test(v.iso) && PRECISION.has(v.precision);
    case 'pending':
      if (v.kind === 'date') return ISO.test(v.iso) && PRECISION.has(v.precision);
      return v.kind === 'duration' && v.value > 0 && ['day', 'week', 'month', 'year'].includes(v.unit) && ISO.test(v.sinceIso);
    default:
      return false;
  }
}

export function displayFieldValue(field, value, lang) {
  if (!value) return '';
  switch (field.type) {
    case 'amount':
      return formatINR(value.amount);
    case 'date':
      return formatDate(value.iso, lang, value.precision);
    case 'pending':
      return value.kind === 'duration'
        ? `${formatDuration(value, lang)} (${formatDate(value.sinceIso, lang, 'day')})`
        : formatDate(value.iso, lang, value.precision);
    default:
      return value.text;
  }
}

// The value as Arzi reads it back for confirmation.
export function speakFieldValue(field, value, lang) {
  if (!value) return '';
  switch (field.type) {
    case 'amount':
      return speakAmount(value.amount, lang);
    case 'date':
      return `${formatDate(value.iso, lang, value.precision)}. ${speakDate(value.iso, lang, value.precision)}.`;
    case 'pending':
      return value.kind === 'duration'
        ? formatDuration(value, lang)
        : `${formatDate(value.iso, lang, value.precision)}. ${speakDate(value.iso, lang, value.precision)}.`;
    default:
      return value.text;
  }
}
