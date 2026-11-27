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
