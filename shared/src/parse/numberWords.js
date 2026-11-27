// Number words in English, Hindi (Devanagari + romanised "Hinglish") and Marathi.
// Hindi and Marathi numbers 1–99 are irregular (no "twenty-one" pattern), so
// they are listed in full. Speech engines usually return digits, so these
// tables are the safety net for when a word comes through instead.
import { normalize } from './normalize.js';

const HINDI_1_TO_99 = `एक दो तीन चार पांच छह सात आठ नौ दस
ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस
इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस
इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस
इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास
इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ
इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर
इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उनासी अस्सी
इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे
इक्यानवे बानवे तिरानवे चौरानवे पंचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे`;

// Marathi spellings vary a little between writers; these are the standard forms.
const MARATHI_1_TO_99 = `एक दोन तीन चार पाच सहा सात आठ नऊ दहा
अकरा बारा तेरा चौदा पंधरा सोळा सतरा अठरा एकोणीस वीस
एकवीस बावीस तेवीस चोवीस पंचवीस सव्वीस सत्तावीस अठ्ठावीस एकोणतीस तीस
एकतीस बत्तीस तेहतीस चौतीस पस्तीस छत्तीस सदतीस अडतीस एकोणचाळीस चाळीस
एक्केचाळीस बेचाळीस त्रेचाळीस चव्वेचाळीस पंचेचाळीस सेहेचाळीस सत्तेचाळीस अठ्ठेचाळीस एकोणपन्नास पन्नास
एक्कावन्न बावन्न त्रेपन्न चोपन्न पंचावन्न छप्पन्न सत्तावन्न अठ्ठावन्न एकोणसाठ साठ
एकसष्ट बासष्ट त्रेसष्ट चौसष्ट पासष्ट सहासष्ट सदुसष्ट अडुसष्ट एकोणसत्तर सत्तर
एक्काहत्तर बाहत्तर त्र्याहत्तर चौर्‍याहत्तर पंच्याहत्तर शहात्तर सत्याहत्तर अठ्ठ्याहत्तर एकोणऐंशी ऐंशी
एक्क्याऐंशी ब्याऐंशी त्र्याऐंशी चौर्‍याऐंशी पंच्याऐंशी शहाऐंशी सत्त्याऐंशी अठ्ठ्याऐंशी एकोणनव्वद नव्वद
एक्क्याण्णव ब्याण्णव त्र्याण्णव चौर्‍याण्णव पंच्याण्णव शहाण्णव सत्त्याण्णव अठ्ठ्याण्णव नव्व्याण्णव`;

// Extra spellings speech engines produce.
const EXTRA_WORDS = {
  0: ['zero', 'शून्य', 'shunya', 'sifar'],
  1: ['one', 'ek', 'a', 'an'],
  2: ['two', 'do'],
  3: ['three', 'teen', 'tin'],
  4: ['four', 'char', 'chaar'],
  5: ['five', 'panch', 'paanch', 'pach'],
  6: ['six', 'chhe', 'chhah', 'che', 'chheh', 'छः', 'छे', 'saha'],
  7: ['seven', 'saat', 'sat'],
  8: ['eight', 'aath', 'ath'],
  9: ['nine', 'nau', 'nav'],
  10: ['ten', 'das', 'daha'],
  11: ['eleven', 'gyarah', 'gyara'],
  12: ['twelve', 'barah', 'bara'],
  13: ['thirteen', 'terah', 'tera'],
  14: ['fourteen', 'chaudah', 'chauda'],
  15: ['fifteen', 'pandrah', 'pandra', 'pandhra'],
  16: ['sixteen', 'solah', 'sola'],
  17: ['seventeen', 'satrah', 'satra'],
  18: ['eighteen', 'atharah', 'athara', 'athra'],
  19: ['nineteen', 'unnis', 'unees'],
  20: ['twenty', 'bees', 'bis', 'vees'],
  21: ['ikkis'],
  22: ['bais', 'baees'],
  23: ['teis'],
  24: ['chaubis', 'chobis'],
  25: ['pachchis', 'pachis', 'pachees'],
  26: ['chhabbis'],
  27: ['sattais'],
  28: ['atthais'],
  29: ['untis'],
  30: ['thirty', 'tees', 'tis'],
  31: ['ikattis', 'iktees'],
  35: ['paintis', 'paintees'],
  40: ['forty', 'chalis', 'chaalis'],
  45: ['paintalis'],
  50: ['fifty', 'pachas', 'pachaas', 'pannas'],
  60: ['sixty', 'saath'],
  70: ['seventy', 'sattar'],
  75: ['pachattar', 'pachhattar'],
  80: ['eighty', 'assi'],
  90: ['ninety', 'nabbe'],
};

// Words that multiply what came before ("bees hazaar" = 20 × 1000).
const MULTIPLIER_WORDS = {
  100: ['hundred', 'sau', 'सौ', 'शंभर', 'shambhar'],
  1000: ['thousand', 'hazaar', 'hazar', 'hajar', 'hajaar', 'हजार', 'हज़ार', 'k'],
  100000: ['lakh', 'lakhs', 'lac', 'lacs', 'लाख'],
  1000000: ['million'],
  10000000: ['crore', 'crores', 'karod', 'करोड़', 'करोड', 'कोटी'],
};

// Fraction words that stand for a whole value: "dedh lakh" = 1.5 lakh.
const FRACTION_VALUES = {
  1.5: ['dedh', 'derh', 'डेढ़', 'डेढ', 'दीड', 'deed'],
  2.5: ['dhai', 'dhaai', 'adhai', 'ढाई', 'अडीच', 'adich'],
};

// Fraction words that change the NEXT value: "saade teen" = 3.5.
const MODIFIER_WORDS = [
  { words: ['saade', 'sade', 'saadhe', 'साढ़े', 'साढे', 'साडे'], apply: (v) => v + 0.5 },
  { words: ['sava', 'sawa', 'सवा', 'सव्वा'], apply: (v) => v + 0.25 },
  { words: ['paune', 'pone', 'पौने', 'पावणे'], apply: (v) => v - 0.25 },
];

// Words that may sit between parts of one number: "one hundred AND fifty".
export const CONNECTORS = new Set(['and', 'aur', 'और', 'आणि', 'va', 'व'].map(normalize));

function buildMap(entries) {
  const map = new Map();
  for (const [value, words] of entries) for (const w of words) map.set(normalize(w), Number(value));
  return map;
}

export const UNIT_WORDS = buildMap([
  ...HINDI_1_TO_99.split(/\s+/).map((w, i) => [i + 1, [w]]),
  ...MARATHI_1_TO_99.split(/\s+/).map((w, i) => [i + 1, [w]]),
  ...Object.entries(EXTRA_WORDS),
  ...Object.entries(FRACTION_VALUES),
]);

export const MULTIPLIERS = buildMap(Object.entries(MULTIPLIER_WORDS));

export const MODIFIERS = new Map();
for (const { words, apply } of MODIFIER_WORDS) for (const w of words) MODIFIERS.set(normalize(w), apply);

// Value of a token written in digits: "20000", "20,000", "1,50,000", "1.5".
export function digitValue(token) {
  if (!/^\d{1,3}(,\d{2,3})+(\.\d+)?$|^\d+(\.\d+)?$/.test(token)) return null;
  return Number(token.replace(/,/g, ''));
}

export function wordValue(token) {
  return UNIT_WORDS.has(token) ? UNIT_WORDS.get(token) : null;
}
