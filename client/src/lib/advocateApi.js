// API calls for the advocate page. The demo PIN is kept for this browser tab
// only (sessionStorage) and sent in a header on every request.
import { api } from './api.js';

const KEY = 'arzi.advocatePin';

export const getPin = () => sessionStorage.getItem(KEY);
export const setPin = (pin) => sessionStorage.setItem(KEY, pin);
export const clearPin = () => sessionStorage.removeItem(KEY);

export function advocateApi(path, options = {}, pin = getPin()) {
  return api(`/advocate${path}`, {
    ...options,
    headers: { 'X-Advocate-Pin': pin ?? '', ...(options.headers ?? {}) },
  });
}
