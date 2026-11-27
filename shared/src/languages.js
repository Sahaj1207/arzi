// The three languages Arzi supports, with the BCP-47 tag the browser
// speech engines expect.
export const LANGUAGES = [
  { code: 'hi', label: 'हिन्दी', englishLabel: 'Hindi', speechTag: 'hi-IN' },
  { code: 'mr', label: 'मराठी', englishLabel: 'Marathi', speechTag: 'mr-IN' },
  { code: 'en', label: 'English', englishLabel: 'English', speechTag: 'en-IN' },
];

// Used when nothing else is known. The browser's own language is checked first (client).
export const DEFAULT_LANGUAGE = 'en';

export function getLanguage(code) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES.find((l) => l.code === DEFAULT_LANGUAGE);
}
