// The speech-to-text provider for this session. One "auto" provider that the rest
// of the app talks to; it uses Sarvam only when the server has a key AND the
// citizen agreed to AI this session, and otherwise the free browser engine.
// If Sarvam fails (out of credits, timeout, down), the session switches to
// browser speech for good and the interview simply asks the question again.
import { createBrowserStt } from './browserStt.js';
import { createServerStt } from './serverStt.js';
import { getRuntimeConfig, aiServiceUp, markAiFailed } from '../lib/ai.js';

const browser = createBrowserStt();
const sarvam = createServerStt();

const useSarvam = () => getRuntimeConfig()?.speech === 'sarvam' && aiServiceUp('stt') && sarvam.isSupported();

const auto = {
  get name() {
    return useSarvam() ? 'sarvam' : 'browser';
  },
  isSupported: () => useSarvam() || browser.isSupported(),
  async listen(options) {
    if (!useSarvam()) return browser.listen(options);
    const result = await sarvam.listen(options);
    if (result.status === 'provider_failed') {
      fallBackToBrowser(result.reason);
      return { status: 'switched', text: '' }; // ask() repeats the question with browser speech
    }
    return result;
  },
};

export function getSpeechProvider() {
  return auto;
}

export function fallBackToBrowser(reason) {
  markAiFailed('stt', reason);
}

