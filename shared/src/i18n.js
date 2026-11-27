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
    listening: 'Listening… speak now',
    youSaid: 'You said',
    couldNotHear:
      'I could not hear you clearly. Please move to a quieter place or hold the phone closer, and try again.',
    notUnderstood: 'Sorry, I did not understand that. Please say it again.',
    silenceRepeat: 'I did not hear anything. Let me ask again.',
    pausedPrompt: 'I have paused. Tap the button when you are ready.',
    tapToContinue: 'Tap to continue',
    typeInstead: 'Type your answer here',
    keyboardHelp: 'Voice is not working well. You can type your answer instead.',
    send: 'Send',
    micDenied: 'Arzi cannot use the microphone. Please allow microphone access in your browser settings, or type your answer.',
    speechNetwork: 'Voice needs an internet connection. Please check your internet, or type your answer.',
    langUnsupported: 'This browser cannot understand this language by voice. Please type your answer, or choose another language.',
    stop: 'Stop',
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
    listening: 'सुन रही हूँ… अब बोलिए',
    youSaid: 'आपने कहा',
    couldNotHear:
      'मुझे आपकी आवाज़ साफ़ नहीं सुनाई दी। कृपया किसी शांत जगह पर जाइए या फ़ोन को पास रखिए, और फिर से बोलिए।',
    notUnderstood: 'माफ़ कीजिए, मैं समझ नहीं पाई। कृपया फिर से बोलिए।',
    silenceRepeat: 'मुझे कुछ सुनाई नहीं दिया। मैं फिर से पूछती हूँ।',
    pausedPrompt: 'मैं रुक गई हूँ। जब आप तैयार हों, बटन दबाइए।',
    tapToContinue: 'आगे बढ़ने के लिए दबाइए',
    typeInstead: 'अपना जवाब यहाँ लिखिए',
    keyboardHelp: 'आवाज़ ठीक से काम नहीं कर रही। आप अपना जवाब लिख भी सकते हैं।',
    send: 'भेजिए',
    micDenied: 'अर्ज़ी माइक्रोफ़ोन का उपयोग नहीं कर पा रही। कृपया ब्राउज़र सेटिंग में माइक्रोफ़ोन की अनुमति दीजिए, या अपना जवाब लिखिए।',
    speechNetwork: 'आवाज़ के लिए इंटरनेट चाहिए। कृपया इंटरनेट जाँचिए, या अपना जवाब लिखिए।',
    langUnsupported: 'यह ब्राउज़र इस भाषा में आवाज़ नहीं समझ पाता। कृपया अपना जवाब लिखिए, या दूसरी भाषा चुनिए।',
    stop: 'रोकिए',
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
    listening: 'ऐकत आहे… आता बोला',
    youSaid: 'तुम्ही म्हणालात',
    couldNotHear:
      'मला तुमचा आवाज स्पष्ट ऐकू आला नाही. कृपया शांत जागी जा किंवा फोन जवळ धरा, आणि पुन्हा बोला.',
    notUnderstood: 'माफ करा, मला समजले नाही. कृपया पुन्हा सांगा.',
    silenceRepeat: 'मला काहीच ऐकू आले नाही. मी पुन्हा विचारते.',
    pausedPrompt: 'मी थांबले आहे. तुम्ही तयार असाल तेव्हा बटण दाबा.',
    tapToContinue: 'पुढे जाण्यासाठी दाबा',
    typeInstead: 'तुमचे उत्तर इथे लिहा',
    keyboardHelp: 'आवाज नीट काम करत नाही. तुम्ही तुमचे उत्तर लिहूही शकता.',
    send: 'पाठवा',
    micDenied: 'अर्ज़ी मायक्रोफोन वापरू शकत नाही. कृपया ब्राउझर सेटिंगमध्ये मायक्रोफोनची परवानगी द्या, किंवा तुमचे उत्तर लिहा.',
    speechNetwork: 'आवाजासाठी इंटरनेट लागते. कृपया इंटरनेट तपासा, किंवा तुमचे उत्तर लिहा.',
    langUnsupported: 'हा ब्राउझर या भाषेतील आवाज समजू शकत नाही. कृपया तुमचे उत्तर लिहा, किंवा दुसरी भाषा निवडा.',
    stop: 'थांबा',
  },
};

export function t(lang, key) {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}
