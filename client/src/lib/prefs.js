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

// Did the citizen tick "I agree my voice and details are processed by …" on the
// home screen? Remembered on this device (one-time). 'yes' | 'no' (not ticked).
const AI_KEY = 'arzi.aiConsentBox';
export const getAiConsent = () => (local.get(AI_KEY) === 'yes' ? 'yes' : 'no');
export function setAiConsent(yes) {
  local.set(AI_KEY, yes ? 'yes' : 'no');
  window.dispatchEvent(new CustomEvent('arzi:ai-consent'));
}
