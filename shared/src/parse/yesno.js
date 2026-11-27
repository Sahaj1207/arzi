// Understands spoken yes / no in English, Hindi and Marathi (and mixes).
// Returns 'yes', 'no', or null when unclear (then Arzi asks again).
import { normalize, tokenize, hasAny } from './normalize.js';

const YES = [
  'yes', 'yeah', 'yep', 'yup', 'ya', 'correct', 'right', 'ok', 'okay', 'sure', 'true', 'agree', 'done',
  'haan', 'han', 'haa', 'ha', 'ji', 'jee', 'sahi', 'theek', 'thik', 'bilkul', 'zaroor',
  'हां', 'हाँ', 'हा', 'जी', 'सही', 'ठीक', 'बिल्कुल', 'बिलकुल', 'जरूर', 'ओके',
  'ho', 'hoy', 'barobar', 'हो', 'होय', 'बरोबर', 'चालेल',
  'అవును', 'ఔను', 'అవునండి', 'సరే', 'సరి', 'సరైనది', 'సరిగ్గా', 'కరెక్ట్', 'ఓకే', 'హా',
];

const NO = [
  'no', 'nope', 'nah', 'not', 'wrong', 'incorrect', 'cancel',
  'nahi', 'nahin', 'nai', 'na', 'galat', 'mat',
  'नहीं', 'नही', 'ना', 'गलत', 'मत',
  'nako', 'nahi re', 'नको', 'नाही', 'चूक', 'चुकीचे', 'चुकीचं',
  'కాదు', 'కాదండి', 'లేదు', 'లేదండి', 'వద్దు', 'తప్పు', 'సరికాదు', 'సరి కాదు',
];

export function parseYesNo(text) {
  const norm = normalize(text);
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  const no = hasAny(tokens, norm, NO);
  const yes = hasAny(tokens, norm, YES);

  // "not correct", "sahi nahi hai", "बरोबर नाही" → a negated yes is a no.
  if (no) return 'no';
  if (yes) return 'yes';
  return null;
}
