// The languages Arzi supports, with the BCP-47 tag the browser speech engines expect.
// All four are fully supported (Telugu checked by a Telugu speaker, 2026-11-28).
export const LANGUAGES = [
  { code: 'hi', label: 'हिन्दी', englishLabel: 'Hindi', speechTag: 'hi-IN' },
  { code: 'mr', label: 'मराठी', englishLabel: 'Marathi', speechTag: 'mr-IN' },
  { code: 'en', label: 'English', englishLabel: 'English', speechTag: 'en-IN' },
  { code: 'te', label: 'తెలుగు', englishLabel: 'Telugu', speechTag: 'te-IN' },
];

// Used when nothing else is known. The browser's own language is checked first (client).
export const DEFAULT_LANGUAGE = 'en';

export function getLanguage(code) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES.find((l) => l.code === DEFAULT_LANGUAGE);
}
