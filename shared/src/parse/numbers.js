// Finds every number in a sentence, whether spoken as digits or words.
//   "bees hazaar"            → [20000]
//   "ek lakh pachaas hazaar" → [150000]
//   "saade teen hazaar"      → [3500]
//   "₹20,000/-"              → [20000]
//   "20000 deposit, 3 mahine" → [20000, 3]
import { tokenize } from './normalize.js';
import { CONNECTORS, MODIFIERS, MULTIPLIERS, digitValue, wordValue } from './numberWords.js';
import { isDurationUnit } from './units.js';

const isNumberish = (tok) =>
  tok !== undefined &&
  (digitValue(tok) !== null || wordValue(tok) !== null || MULTIPLIERS.has(tok) || MODIFIERS.has(tok));

// The English articles "a"/"an" count as 1 only right before a multiplier or unit
// ("a lakh", "a month"); otherwise they are just articles.
const ARTICLES = new Set(['a', 'an']);

export function extractNumbers(text, tokens = tokenize(text)) {
  const results = [];
  let total = 0; // finished part, e.g. 20000 in "bees hazaar paanch sau"
  let current = null; // part being built, e.g. 5 → 500
  let currentFromWords = false;
  let modifier = null; // pending saade/sava/paune
  let active = false;

  const flush = () => {
    if (active) results.push(total + (current ?? 0));
    total = 0;
    current = null;
    currentFromWords = false;
    modifier = null;
    active = false;
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const next = tokens[i + 1];

    if (ARTICLES.has(tok) && !(MULTIPLIERS.has(next) || isDurationUnit(next))) {
      flush();
      continue;
    }

    const digits = digitValue(tok);
    const word = digits === null ? wordValue(tok) : null;

    if (digits !== null || word !== null) {
      let v = digits ?? word;
      if (modifier) {
        v = modifier(v);
        modifier = null;
      }
      const fromWords = digits === null;
      const nextIsMultiplier = MULTIPLIERS.has(next);

      if (current === null && total === 0) {
        current = v;
      } else if (current === null) {
        // After "hazaar"/"lakh": "bees hazaar paanch sau" joins, "20 hazaar 3 mahine" does not.
        if (nextIsMultiplier || (fromWords && v < 100 && !isDurationUnit(next))) current = v;
        else {
          flush();
          current = v;
        }
      } else if (fromWords && currentFromWords && current % 10 === 0 && current >= 20 && current < 100 && v < 10) {
        current += v; // "twenty five"
      } else if (fromWords && current >= 100 && current % 100 === 0 && v < 100 && !isDurationUnit(next)) {
        current += v; // "teen sau pachaas", "one hundred fifty"
      } else {
        flush();
        current = v;
      }
      currentFromWords = fromWords;
      active = true;
      continue;
    }

    if (MULTIPLIERS.has(tok)) {
      const m = MULTIPLIERS.get(tok);
      let base = current ?? 1;
      if (current === null && modifier) base = modifier(1); // "sava lakh"
      modifier = null;
      if (m === 100) {
        current = base * 100;
      } else {
        if (total > 0 && total < base * m) {
          // "20 hazaar ... 1 lakh": a bigger unit after a smaller one starts a new number
          flush();
        }
        total += base * m;
        current = null;
      }
      currentFromWords = true;
      active = true;
      continue;
    }

    if (MODIFIERS.has(tok)) {
      if (current !== null) flush();
      modifier = MODIFIERS.get(tok);
      continue;
    }

    if (CONNECTORS.has(tok) && active && isNumberish(next)) continue;

    flush();
  }
  flush();
  return results.map((n) => Math.round(n * 100) / 100);
}
