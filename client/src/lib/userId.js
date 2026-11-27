// Anonymous citizen ID, kept in localStorage so history survives reloads on this device.
const KEY = 'arzi.userId';

export function getUserId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID?.() ?? `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

const LANG_KEY = 'arzi.language';
export const getSavedLanguage = () => localStorage.getItem(LANG_KEY);
export const saveLanguage = (code) => localStorage.setItem(LANG_KEY, code);
