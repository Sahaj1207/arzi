// Chooses the active speech-to-text provider for this session.
// Today only the browser provider exists. Step 9 adds Sarvam / Wispr Flow
// (server-side, keys stay on the server) and the automatic fallback: if a paid
// provider fails, `fallBackToBrowser()` switches this session to browser speech.
import { createBrowserStt } from './browserStt.js';

const browser = createBrowserStt();
let active = browser;

export function getSpeechProvider() {
  return active;
}

export function fallBackToBrowser(reason) {
  if (active !== browser) {
    console.warn(`[speech] ${active.name} failed (${reason}); using browser speech for this session`);
    active = browser;
  }
  return active;
}

// Display name for the badge in the header.
export const PROVIDER_LABEL = { browser: 'Browser speech', sarvam: 'Sarvam', wispr: 'Wispr Flow' };
