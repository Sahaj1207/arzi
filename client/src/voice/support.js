// Feature detection for browser voice features.
export const hasSpeechRecognition = () =>
  typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

export const hasSpeechSynthesis = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

// Mic access needs HTTPS or localhost.
export const isSecureForMic = () => typeof window !== 'undefined' && window.isSecureContext;
