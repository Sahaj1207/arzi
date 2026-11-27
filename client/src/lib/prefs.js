// Small settings remembered in the browser.

// Reading speed for Arzi's voice (read-back "slower / faster"), kept on this device.
const RATE_KEY = 'arzi.speechRate';
export const RATE_MIN = 0.6;
export const RATE_MAX = 1.3;
export const RATE_DEFAULT = 0.92;
export function getRate() {
  const r = Number.parseFloat(localStorage.getItem(RATE_KEY));
  return Number.isFinite(r) ? Math.min(RATE_MAX, Math.max(RATE_MIN, r)) : RATE_DEFAULT;
}
export function setRate(r) {
  const v = Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, r)) * 100) / 100;
  localStorage.setItem(RATE_KEY, String(v));
  return v;
}

// Did the citizen allow outside AI services (Sarvam / Anthropic) in this session?
// 'yes' | 'no' | null (not asked yet). Session only: asked again next visit.
const AI_KEY = 'arzi.aiConsent';
export const getAiConsent = () => sessionStorage.getItem(AI_KEY);
export const setAiConsent = (yes) => sessionStorage.setItem(AI_KEY, yes ? 'yes' : 'no');
