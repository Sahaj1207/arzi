// The languages Arzi supports, with the BCP-47 tag the browser speech engines expect.
// `review: true` = translations waiting for a native speaker's check. Such a language
// is hidden from the picker unless the tester link (?telugu=1) was opened on that device.
export const LANGUAGES = [
  { code: 'hi', label: 'हिन्दी', englishLabel: 'Hindi', speechTag: 'hi-IN' },
  { code: 'mr', label: 'मराठी', englishLabel: 'Marathi', speechTag: 'mr-IN' },
  { code: 'en', label: 'English', englishLabel: 'English', speechTag: 'en-IN' },
  { code: 'te', label: 'తెలుగు', englishLabel: 'Telugu', speechTag: 'te-IN', review: true },
];

// Used when nothing else is known. The browser's own language is checked first (client).
export const DEFAULT_LANGUAGE = 'en';

export function getLanguage(code) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES.find((l) => l.code === DEFAULT_LANGUAGE);
}
