// How amounts and dates are SHOWN (large on screen) and SPOKEN (digit by digit,
// so a misheard number is easy to catch: "two zero zero zero zero").

const DIGIT_WORDS = {
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
  hi: ['शून्य', 'एक', 'दो', 'तीन', 'चार', 'पांच', 'छह', 'सात', 'आठ', 'नौ'],
  mr: ['शून्य', 'एक', 'दोन', 'तीन', 'चार', 'पाच', 'सहा', 'सात', 'आठ', 'नऊ'],
};

const MONTH_NAMES = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
  mr: ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'],
};

const RUPEES = { en: 'rupees', hi: 'रुपये', mr: 'रुपये' };

const UNIT_NAMES = {
  en: { day: ['day', 'days'], week: ['week', 'weeks'], month: ['month', 'months'], year: ['year', 'years'] },
  hi: { day: ['दिन', 'दिन'], week: ['हफ़्ता', 'हफ़्ते'], month: ['महीना', 'महीने'], year: ['साल', 'साल'] },
  mr: { day: ['दिवस', 'दिवस'], week: ['आठवडा', 'आठवडे'], month: ['महिना', 'महिने'], year: ['वर्ष', 'वर्षे'] },
};

const lang3 = (lang) => (lang === 'hi' || lang === 'mr' ? lang : 'en');

// 150000 → "₹1,50,000" (Indian digit grouping)
export function formatINR(value) {
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;
}

// "20000" → "two zero zero zero zero" / "दो शून्य शून्य शून्य शून्य"
export function spellDigits(value, lang) {
  const words = DIGIT_WORDS[lang3(lang)];
  return String(value)
    .replace(/\D/g, '')
    .split('')
    .map((d) => words[Number(d)])
    .join(' ');
}

// What Arzi says to confirm an amount: "20,000 rupees. That is: two zero zero zero zero."
export function speakAmount(value, lang) {
  const l = lang3(lang);
  const grouped = new Intl.NumberFormat('en-IN').format(value);
  const lead = { en: 'That is', hi: 'यानी', mr: 'म्हणजे' }[l];
  return `${grouped} ${RUPEES[l]}. ${lead}: ${spellDigits(value, l)}.`;
}

// "2026-03-15" → "15 March 2026" / "15 मार्च 2026"; month precision → "March 2026"
export function formatDate(iso, lang, precision = 'day') {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const month = MONTH_NAMES[lang3(lang)][m - 1];
  return precision === 'month' ? `${month} ${y}` : `${d} ${month} ${y}`;
}

// Spoken with day and year digit by digit: "1 5, March, 2 0 2 6".
export function speakDate(iso, lang, precision = 'day') {
  if (!iso) return '';
  const l = lang3(lang);
  const [y, m, d] = iso.split('-').map(Number);
  const month = MONTH_NAMES[l][m - 1];
  const year = spellDigits(y, l);
  return precision === 'month' ? `${month}, ${year}` : `${spellDigits(d, l)}, ${month}, ${year}`;
}

// { value: 3, unit: 'month' } → "3 months" / "3 महीने" / "3 महिने"
export function formatDuration({ value, unit }, lang) {
  const [one, many] = UNIT_NAMES[lang3(lang)][unit];
  return `${value} ${value === 1 ? one : many}`;
}
