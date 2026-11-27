// The speech-to-text provider for this session. One "auto" provider that the rest
// of the app talks to. Order: Sarvam → Groq → browser. The server handles the
// first two (it retries the same recording with Groq if Sarvam fails), and is
// used only when it has a speech key AND the citizen agreed to AI this session.
// If every server service fails (out of credits, rate limit, down), the session
// switches to browser speech for good and the interview asks the question again.
import { createBrowserStt } from './browserStt.js';
import { createServerStt, prepareMic, releaseMic } from './serverStt.js';
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

// Called on the first mic tap (a user gesture), while Arzi is still greeting:
// the browser asks for mic permission now instead of after the greeting, and the
// server path keeps the stream open so recording starts instantly.
export function warmUpMic() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
  if (useServer()) {
    prepareMic().catch(() => {}); // a refusal shows up at the first listen
    return;
  }
  // Browser speech opens the mic itself; we only need the permission early.
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((s) => s.getTracks().forEach((t) => t.stop()))
    .catch(() => {});
}

// End of the interview: let go of the microphone (the phone's mic indicator turns off).
export function coolDownMic() {
  releaseMic();
}
