// Small settings remembered in the browser. Storage can throw in some in-app
// browsers / private modes; then settings simply are not remembered.
const safe = (storage) => ({
  get(k) {
    try {
      return window[storage].getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      window[storage].setItem(k, v);
    } catch {
      /* not remembered */
    }
  },
});
const local = safe('localStorage');
const session = safe('sessionStorage');

// Reading speed for Arzi's voice (read-back "slower / faster"), kept on this device.
const RATE_KEY = 'arzi.speechRate';
export const RATE_MIN = 0.6;
export const RATE_MAX = 1.3;
export const RATE_DEFAULT = 0.92;
export function getRate() {
  const r = Number.parseFloat(local.get(RATE_KEY));
  return Number.isFinite(r) ? Math.min(RATE_MAX, Math.max(RATE_MIN, r)) : RATE_DEFAULT;
}
export function setRate(r) {
  const v = Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, r)) * 100) / 100;
  local.set(RATE_KEY, String(v));
  return v;
}

// Languages still in translation review (Telugu) are hidden unless this device
// opened the tester link once: https://<site>/?telugu=1   (turn off: ?telugu=0)
const REVIEW_KEY = 'arzi.reviewLanguages';
export function readReviewFlagFromUrl() {
  try {
    const v = new URLSearchParams(window.location.search).get('telugu');
    if (v === '1') local.set(REVIEW_KEY, '1');
    if (v === '0') local.set(REVIEW_KEY, '');
  } catch {
    /* no URL */
  }
}
export const reviewLanguagesOn = () => local.get(REVIEW_KEY) === '1';
export const isLanguageVisible = (l) => !l.review || reviewLanguagesOn();

// Did the citizen allow outside AI services (Sarvam / Anthropic) in this session?
// 'yes' | 'no' | null (not asked yet). Session only: asked again next visit.
const AI_KEY = 'arzi.aiConsent';
export const getAiConsent = () => session.get(AI_KEY);
export const setAiConsent = (yes) => session.set(AI_KEY, yes ? 'yes' : 'no');
