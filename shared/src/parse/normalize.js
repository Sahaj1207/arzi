// Text cleanup shared by every parser.
// Speech engines spell the same word in many ways (ज़ vs ज, पाँच vs पांच,
// ३ vs 3), so we squash those differences before matching anything.

const DEVANAGARI_DIGIT_ZERO = 0x0966;

export function normalize(text) {
  return (
    String(text ?? '')
      .normalize('NFC') // also splits precomposed nukta letters (क़ → क + ़)
      .replace(/़/g, '') // drop nukta: ज़ → ज, ड़ → ड
      .replace(/ँ/g, 'ं') // chandrabindu → anusvara: पाँच → पांच
      .replace(/[​-‍﻿]/g, '') // zero-width joiners
      .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - DEVANAGARI_DIGIT_ZERO)) // ३ → 3
      .replace(/[।॥]/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// Splits normalized text into word tokens.
// Keeps "15/03/2026" and "1,50,000" together, splits "20000rs" → "20000", "rs"
// and "20k" → "20", "k", and strips English ordinals ("15th" → "15").
export function tokenize(text) {
  const clean = normalize(text)
    .replace(/₹/g, ' ')
    .replace(/\/-/g, ' ') // "20,000/-"
    .replace(/[^\p{L}\p{M}\p{N}.,/:-]+/gu, ' ');

  const tokens = [];
  for (let raw of clean.split(' ')) {
    raw = raw.replace(/^[.,/:-]+|[.,/:-]+$/g, '');
    if (!raw) continue;
    raw = raw.replace(/^(\d+)(st|nd|rd|th)$/, '$1');
    for (const part of raw.split(/(?<=\d)(?=\p{L})|(?<=\p{L})(?=\d)/u)) {
      if (part) tokens.push(part);
    }
  }
  return tokens;
}

// Does any token equal one of the words, or the text contain one of the phrases?
// Single words match whole tokens only, so "maar" never matches inside "maarch".
export function hasAny(tokens, normText, words) {
  for (const w of words) {
    const n = normalize(w);
    if (n.includes(' ') ? normText.includes(n) : tokens.includes(n)) return true;
  }
  return false;
}

// Like hasAny, but a token may also START with the word (for Devanagari stems
// that take suffixes, e.g. महिन्यांपासून starts with महिन्या).
export function hasAnyStem(tokens, normText, stems) {
  for (const s of stems) {
    const n = normalize(s);
    if (n.includes(' ') ? normText.includes(n) : tokens.some((t) => t.startsWith(n))) return true;
  }
  return false;
}
