// Works out what the citizen is asking for, by keyword matching (Demo mode).
// AI mode (step 9) can do better, but this must always work without any key.
import { normalize, tokenize, hasAny, hasAnyStem } from './parse/normalize.js';

// Violence or emergency: show 112 and stop drafting. Checked FIRST, always.
const EMERGENCY = [
  'emergency', 'help me', 'save me', 'hit', 'hits', 'beat', 'beaten', 'beating', 'attack', 'attacked',
  'assault', 'assaulted', 'hurt', 'injured', 'kill', 'killed', 'knife', 'gun', 'rape', 'molest', 'violence',
  'threatened to kill', 'locked me', 'bleeding', 'fire',
  // (not "pita": in Hindi that also means father)
  'bachao', 'maara', 'maar diya', 'peeta', 'jaan se', 'chaku', 'hinsa', 'khoon',
  'बचाओ', 'मारा', 'मार दिया', 'मारपीट', 'पीटा', 'पीट', 'जान से', 'चाकू', 'हिंसा', 'खून', 'आग', 'हमला', 'घायल',
  'वाचवा', 'मारले', 'मारहाण', 'मारझोड', 'जीवे मारण्याची', 'सुरा', 'हल्ला', 'जखमी', 'रक्त',
];

const DEPOSIT = [
  'deposit', 'security', 'advance', 'security money', 'caution money',
  'jama', 'jamaa', 'amanat', 'anamat', 'bayana',
  'जमा', 'डिपॉजिट', 'डिपोजिट', 'सिक्योरिटी', 'सिक्युरिटी', 'एडवांस', 'एडव्हान्स', 'अमानत', 'बयाना',
  'अनामत', 'ठेव', 'डिपॉझिट',
];
const LANDLORD = [
  'landlord', 'landlady', 'owner', 'house owner', 'pg', 'hostel', 'flat', 'room', 'rent', 'kiraya', 'makan malik',
  'malik', 'मकान मालिक', 'मालिक', 'किराया', 'किराए', 'पीजी', 'हॉस्टल', 'घरमालक', 'मालक', 'भाडे', 'खोली',
];
const MONEY_BACK = [
  'return', 'returned', 'refund', 'back', 'wapas', 'vapas', 'waapas', 'lautaya', 'diya nahi', 'not given', 'paise',
  'वापस', 'लौटाया', 'लौटा', 'पैसे', 'परत', 'दिले नाही', 'दिलेले नाही',
];

// Returns { intent: 'emergency' | 'deposit' | 'other' | 'empty' }.
export function detectIntent(text) {
  const norm = normalize(text);
  const tokens = tokenize(text);
  if (tokens.length === 0) return { intent: 'empty' };
  if (hasAny(tokens, norm, EMERGENCY)) return { intent: 'emergency' };
  if (hasAny(tokens, norm, DEPOSIT)) return { intent: 'deposit' };
  if (hasAny(tokens, norm, LANDLORD) && hasAny(tokens, norm, MONEY_BACK)) return { intent: 'deposit' };
  return { intent: 'other' };
}

export function isEmergency(text) {
  return detectIntent(text).intent === 'emergency';
}

// "Speak in Marathi", "हिंदी में बोलो", "मराठीत बोला", "English please" → 'mr' | 'hi' | 'en' | null.
const LANGUAGE_NAMES = {
  hi: ['hindi', 'हिंदी', 'हिन्दी', 'हिंदीत', 'हिंदीमध्ये'],
  mr: ['marathi', 'मराठी', 'मराठीत', 'मराठीमध्ये', 'मराठीमें'],
  en: ['english', 'angrezi', 'इंग्लिश', 'अंग्रेजी', 'इंग्रजी', 'इंग्रजीत', 'इंग्लिशमध्ये'],
};
const SWITCH_WORDS = [
  'speak', 'talk', 'say', 'language', 'please', 'in', 'switch', 'change',
  'bolo', 'boliye', 'baat', 'mein', 'me', 'bhasha', 'karo',
  'बोलो', 'बोलिए', 'बोलिये', 'बात', 'में', 'मे', 'भाषा', 'करो', 'कीजिए',
  'बोला', 'बोल', 'बोलणे', 'मध्ये', 'भाषेत', 'करा',
];

export function detectLanguageSwitch(text) {
  const norm = normalize(text);
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;
  const found = Object.entries(LANGUAGE_NAMES).filter(([, names]) => hasAnyStem(tokens, norm, names));
  if (found.length !== 1) return null;
  // A short utterance ("Marathi", "मराठीत") or one with a "speak/in" word counts.
  if (tokens.length <= 2 || hasAny(tokens, norm, SWITCH_WORDS)) return found[0][0];
  return null;
}

// During the summary: "change the amount", "naam galat hai", "रक्कम बदला" → field id or null.
const FIELD_WORDS = {
  name: ['name', 'naam', 'नाम', 'नाव', 'spelling'],
  address: ['address', 'pata', 'patta', 'पता', 'पत्ता', 'एड्रेस', 'ऍड्रेस'],
  landlord: ['landlord', 'owner', 'malik', 'makan malik', 'मालिक', 'मकान मालिक', 'मालक', 'घरमालक', 'मालकाचे', 'मालकाचा'],
  amount: ['amount', 'money', 'deposit', 'rakam', 'raqam', 'rashi', 'paise', 'paisa', 'rupees', 'रकम', 'राशि', 'पैसे', 'रुपये', 'रक्कम', 'जमा', 'डिपॉजिट', 'अनामत'],
  movedOut: ['moved', 'move out', 'vacate', 'vacated', 'left', 'shift', 'khali', 'chhoda', 'खाली', 'छोड़ा', 'छोडा', 'सोडले', 'सोडली', 'सोडलं'],
  due: ['due', 'pending', 'kab se', 'baaki', 'baki', 'बाकी', 'कब से', 'पासून', 'थकीत'],
};

export function detectFieldToChange(text) {
  const norm = normalize(text);
  const tokens = tokenize(text);
  const has = (k) => hasAny(tokens, norm, FIELD_WORDS[k]);
  const landlord = has('landlord');

  if (has('amount')) return 'depositAmount';
  if (has('movedOut')) return 'movedOutDate';
  if (has('due')) return 'dueDate';
  if (has('address')) return landlord ? 'landlordAddress' : 'tenantAddress';
  if (has('name')) return landlord ? 'landlordName' : 'tenantName';
  return null; // "change the date" alone is ambiguous: Arzi asks which one
}
