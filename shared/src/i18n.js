// Every sentence Arzi shows or speaks, per language.
// Step 1 holds the home screen lines; later steps add the interview lines here.
const STRINGS = {
  en: {
    tagline: 'Speak your problem. Get a lawyer-checked legal notice.',
    chooseLanguage: 'Choose your language',
    tapToSpeak: 'Tap and speak',
    greeting:
      'Namaste, I am Arzi. I help you make a legal notice by speaking. Please tell me your problem in your own words.',
    notLegalAdvice: 'Prototype — not legal advice',
    unsupportedBrowser:
      'Voice input does not work in this browser. Please open Arzi in Google Chrome or Microsoft Edge.',
    history: 'My documents',
  },
  hi: {
    tagline: 'अपनी समस्या बोलिए। वकील से जाँचा हुआ लीगल नोटिस पाइए।',
    chooseLanguage: 'अपनी भाषा चुनिए',
    tapToSpeak: 'दबाइए और बोलिए',
    greeting:
      'नमस्ते, मैं अर्ज़ी हूँ। मैं बोलकर लीगल नोटिस बनाने में आपकी मदद करती हूँ। कृपया अपनी समस्या अपने शब्दों में बताइए।',
    notLegalAdvice: 'प्रोटोटाइप — यह कानूनी सलाह नहीं है',
    unsupportedBrowser:
      'इस ब्राउज़र में आवाज़ से बोलना काम नहीं करता। कृपया अर्ज़ी को Google Chrome या Microsoft Edge में खोलिए।',
    history: 'मेरे दस्तावेज़',
  },
  mr: {
    tagline: 'तुमची अडचण बोला. वकिलाने तपासलेली कायदेशीर नोटीस मिळवा.',
    chooseLanguage: 'तुमची भाषा निवडा',
    tapToSpeak: 'दाबा आणि बोला',
    greeting:
      'नमस्कार, मी अर्ज़ी आहे. मी बोलून कायदेशीर नोटीस तयार करायला मदत करते. कृपया तुमची अडचण तुमच्या शब्दांत सांगा.',
    notLegalAdvice: 'प्रोटोटाइप — हा कायदेशीर सल्ला नाही',
    unsupportedBrowser:
      'या ब्राउझरमध्ये आवाजाने बोलणे चालत नाही. कृपया अर्ज़ी Google Chrome किंवा Microsoft Edge मध्ये उघडा.',
    history: 'माझी कागदपत्रे',
  },
};

export function t(lang, key) {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}
