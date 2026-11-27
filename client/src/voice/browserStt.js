// Speech-to-text with the browser's Web Speech API (Chrome / Edge). No key needed.
//
// Every speech provider has the same shape, so the rest of the app does not
// care which one is active (browser now; Sarvam / Wispr Flow in step 9):
//
//   provider.name                 'browser' | 'sarvam' | 'wispr'
//   provider.isSupported()        can it run in this browser?
//   provider.listen(options)      → Promise<ListenResult>
//
//   options:  { lang: 'hi', onInterim(text), signal: AbortSignal, silenceMs: 8000 }
//   ListenResult.status:
//     'ok'           text heard (result.text)
//     'silence'      nobody spoke for silenceMs
//     'unclear'      something was heard but too short / too unsure to use
//     'denied'       microphone permission refused
//     'network'      speech service unreachable (Chrome sends audio to Google)
//     'unsupported'  this browser cannot recognise this language
//     'error'        anything else
//     'aborted'      cancelled by the app
import { getLanguage } from '@arzi/shared';
import { hasSpeechRecognition } from './support.js';

// Chrome rarely reports a real confidence (often 0), so only a clearly low
// non-zero score counts as unsure.
const LOW_CONFIDENCE = 0.3;
const MIN_CHARS = 2;

export function createBrowserStt() {
  return {
    name: 'browser',
    isSupported: hasSpeechRecognition,
    listen,
  };
}

function listen({ lang, onInterim = () => {}, signal, silenceMs = 8000, maxMs = 45000 } = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return Promise.resolve({ status: 'unsupported', text: '' });

  return new Promise((resolve) => {
    const started = Date.now();
    let finalText = '';
    let lastConfidence = 0;
    let heardAnything = false;
    let done = false;
    let rec = null;
    let silenceTimer = null;
    let maxTimer = null;

    const finish = (status) => {
      if (done) return;
      done = true;
      clearTimeout(silenceTimer);
      clearTimeout(maxTimer);
      signal?.removeEventListener('abort', onAbort);
      try {
        rec?.abort();
      } catch {
        /* already stopped */
      }
      const text = finalText.trim();
      if (status === 'ok') {
        if (text.length < MIN_CHARS) status = heardAnything ? 'unclear' : 'silence';
        else if (lastConfidence > 0 && lastConfidence < LOW_CONFIDENCE) status = 'unclear';
      }
      resolve({ status, text, confidence: lastConfidence });
    };

    // Our own 8-second silence clock, independent of Chrome's shorter "no-speech" timeout.
    silenceTimer = setTimeout(() => !heardAnything && finish('silence'), silenceMs);
    maxTimer = setTimeout(() => finish('ok'), maxMs);
    const onAbort = () => finish('aborted');
    signal?.addEventListener('abort', onAbort);
    if (signal?.aborted) return finish('aborted');

    const start = () => {
      rec = new SR();
      rec.lang = getLanguage(lang).speechTag;
      rec.interimResults = true;
      rec.continuous = false; // ends after a natural pause; continuous mode duplicates text on Android
      rec.maxAlternatives = 1;

      rec.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) {
            finalText += `${r[0].transcript} `;
            lastConfidence = r[0].confidence ?? 0;
          } else {
            interim += r[0].transcript;
          }
        }
        if ((finalText + interim).trim()) heardAnything = true;
        onInterim((finalText + interim).trim());
      };

      rec.onerror = (event) => {
        switch (event.error) {
          case 'no-speech':
            break; // handled in onend: keep listening until our 8 s clock runs out
          case 'aborted':
            break;
          case 'not-allowed':
          case 'service-not-allowed':
            finish('denied');
            break;
          case 'network':
            finish('network');
            break;
          case 'language-not-supported':
            finish('unsupported');
            break;
          case 'audio-capture':
            finish('denied'); // no microphone found
            break;
          default:
            finish('error');
        }
      };

      rec.onend = () => {
        if (done) return;
        if (finalText.trim()) return finish('ok');
        if (heardAnything) return finish('unclear'); // sounds, but no usable words
        // Chrome gave up early ("no-speech" after ~5 s): keep listening until our 8 s clock.
        if (Date.now() - started < silenceMs) {
          try {
            start();
          } catch {
            finish('error');
          }
        } else {
          finish('silence');
        }
      };

      rec.start();
    };

    try {
      start();
    } catch {
      finish('error');
    }
  });
}
