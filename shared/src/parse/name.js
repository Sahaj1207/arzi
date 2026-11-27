// Cleans spoken names and addresses: people rarely say just the name.
//   "mera naam Ramesh Kumar hai"   → "Ramesh Kumar"
//   "माझे नाव सुनीता पाटील आहे"       → "सुनीता पाटील"
//   "my address is 12 MG Road"     → "12 MG Road"

const NAME_PREFIXES = [
  /^(my|the|his|her|their)?\s*(full\s+)?name\s+(is|was)\s+/i,
  /^(i am|i'm|this is|it is|it's|he is|she is|owner is|landlord is)\s+/i,
  /^(the\s+)?(landlord|owner|pg owner)('s)?\s+(full\s+)?name\s+(is\s+)?/i,
  /^(mera|meraa|meri|hamara)\s+(pura\s+|poora\s+)?naam\s+/i,
  /^(unka|unke|uska|malik ka|owner ka|landlord ka|makan malik ka)\s+(pura\s+|poora\s+)?naam\s+/i,
  /^naam\s+/i,
  /^(मेरा|हमारा)\s+(पूरा\s+)?नाम\s+/,
  /^(उनका|उसका|मालिक का|मकान मालिक का|पीजी मालिक का)\s+(पूरा\s+)?नाम\s+/,
  /^नाम\s+/,
  /^(माझे|माझं|आमचे)\s+(पूर्ण\s+)?नाव\s+/,
  /^(त्यांचे|त्याचे|तिचे|मालकाचे|घरमालकाचे)\s+(पूर्ण\s+)?नाव\s+/,
  /^नाव\s+/,
];

const ADDRESS_PREFIXES = [
  /^(my|the|his|her|their|landlord's|owner's)?\s*(full\s+)?address\s+(is\s+)?/i,
  /^(it is|it's|i lived at|i stayed at|he lives at|she lives at)\s+/i,
  /^(mera|unka|uska|malik ka)\s+(pura\s+)?(pata|address)\s+/i,
  /^(pata|address)\s+/i,
  /^(मेरा|उनका|उसका|मालिक का|मकान मालिक का)\s+(पूरा\s+)?(पता|एड्रेस)\s+/,
  /^(पता|एड्रेस)\s+/,
  /^(माझा|त्यांचा|मालकाचा|घरमालकाचा)\s+(पूर्ण\s+)?पत्ता\s+/,
  /^पत्ता\s+/,
];

// Trailing "is / hai / आहे" and polite words.
const SUFFIX = /[\s,]+(hai|he|hain|h|ji|sir|है|हैं|जी|आहे|आहेत|बस)[\s.!।]*$/i;

function strip(text, prefixes) {
  let s = String(text ?? '').trim().replace(/[।.!?,\s]+$/u, '');
  for (let i = 0; i < 3; i++) {
    const before = s;
    for (const p of prefixes) s = s.replace(p, '');
    s = s.replace(SUFFIX, '').trim();
    if (s === before) break;
  }
  return s.replace(/^[\s,:-]+|[\s,:-]+$/g, '').replace(/\s+/g, ' ');
}

const titleCase = (s) =>
  s.replace(/\b[a-z][a-z']*/g, (w) => w[0].toUpperCase() + w.slice(1));

// Returns the name, or null when it does not look like a name.
export function extractName(text) {
  const s = strip(text, NAME_PREFIXES);
  if (s.length < 2 || s.length > 60) return null;
  if (/\d/.test(s)) return null; // names have no digits: probably misheard
  if (!/\p{L}/u.test(s)) return null;
  if (s.split(' ').length > 6) return null;
  return titleCase(s);
}

// Returns the address, or null when it is too short to be one.
export function extractAddress(text) {
  const s = strip(text, ADDRESS_PREFIXES);
  if (s.length < 5 || !/\p{L}/u.test(s)) return null;
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
