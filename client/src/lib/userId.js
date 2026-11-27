// Anonymous citizen ID, kept in localStorage so history survives reloads on this device.
// Some in-app browsers and private modes throw on localStorage: then the ID lives in
// memory for this visit, so buttons keep working (history just does not persist).
const KEY = 'arzi.userId';
const memory = new Map();

const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return memory.get(k) ?? null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      memory.set(k, v);
    }
  },
};

function newId() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch {
    /* insecure context or old browser */
  }
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getUserId() {
  let id = store.get(KEY);
  if (!id) {
    id = newId();
    store.set(KEY, id);
  }
  return id;
}

const LANG_KEY = 'arzi.language';
export const getSavedLanguage = () => store.get(LANG_KEY);

// First visit: Hindi or Marathi if the browser prefers it, otherwise English.
// A saved choice always wins (see App.jsx).
export function detectLanguage() {
  const prefs = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of prefs) {
    const base = String(tag ?? '').toLowerCase().split('-')[0];
    if (base === 'hi' || base === 'mr' || base === 'te') return base; // te only if visible (App.jsx)
    if (base === 'en') return 'en';
  }
  return 'en';
}
export const saveLanguage = (code) => store.set(LANG_KEY, code);
