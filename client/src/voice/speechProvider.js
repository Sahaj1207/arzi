// The speech-to-text provider for this session. One "auto" provider that the rest
// of the app talks to. Order: Sarvam → Groq → browser. The server handles the
// first two (it retries the same recording with Groq if Sarvam fails), and is
// used only when it has a speech key AND the citizen agreed to AI this session.
// If every server service fails (out of credits, rate limit, down), the session
// switches to browser speech for good and the interview asks the question again.
import { createBrowserStt } from './browserStt.js';
import { createServerStt } from './serverStt.js';
import { getRuntimeConfig, aiServiceUp, markAiFailed } from '../lib/ai.js';

const browser = createBrowserStt();
const server = createServerStt();

const useServer = () => (getRuntimeConfig()?.speechChain?.length ?? 0) > 0 && aiServiceUp('stt') && server.isSupported();

// Which service actually heard the last answer ('sarvam' | 'groq'), for the status line.
let lastServerProvider = null;
export const lastSpeechService = () => lastServerProvider;

const auto = {
  get name() {
    return useServer() ? (lastServerProvider ?? getRuntimeConfig().speechChain[0]) : 'browser';
  },
  isSupported: () => useServer() || browser.isSupported(),
  async listen(options) {
    if (!useServer()) return browser.listen(options);
    const result = await server.listen(options);
    if (result.status === 'provider_failed') {
      fallBackToBrowser(result.reason);
      return { status: 'switched', text: '' }; // ask() repeats the question with browser speech
    }
    if (result.provider && result.provider !== lastServerProvider) {
      lastServerProvider = result.provider;
      window.dispatchEvent(new CustomEvent('arzi:stt-provider', { detail: { provider: result.provider } }));
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

