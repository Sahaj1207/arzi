// The three languages Arzi supports, with the BCP-47 tag the browser
// speech engines expect.
export const LANGUAGES = [
  { code: 'hi', label: 'हिन्दी', englishLabel: 'Hindi', speechTag: 'hi-IN' },
  { code: 'mr', label: 'मराठी', englishLabel: 'Marathi', speechTag: 'mr-IN' },
  { code: 'en', label: 'English', englishLabel: 'English', speechTag: 'en-IN' },
];

export const DEFAULT_LANGUAGE = 'hi';

export function getLanguage(code) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES.find((l) => l.code === DEFAULT_LANGUAGE);
}
