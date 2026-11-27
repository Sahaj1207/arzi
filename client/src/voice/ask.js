// ask(): speak a question, listen for the answer, and handle everything that can
// go wrong (section 4 of the brief). Used for every question Arzi asks.
//
//   - Noise / unclear speech → "I could not hear you clearly…" and ask again.
//   - Answer heard but not understood (parse returned null) → "Sorry…" and ask again.
//   - After 2 failed attempts → { status: 'keyboard' } so the screen shows a text box.
//   - 8 s of silence → repeat the question once; second silence → { status: 'paused' }
//     so the screen shows a big "Tap to continue" button.
//   - Mic blocked, no internet, language not supported → straight to keyboard.
//
// The speech provider and the speak() function are passed in, so this file has
// no browser code and is unit-tested in client/test/ask.test.js.
import { t } from '@arzi/shared';

export const MAX_FAILURES = 2;

// Listen statuses that mean voice cannot work right now: go straight to the keyboard.
const HARD_FAILURES = { denied: 'micDenied', network: 'speechNetwork', unsupported: 'langUnsupported' };

/**
 * @param {object} o
 * @param {string} o.prompt               what Arzi says (already in the user's language)
 * @param {string} o.lang                 'hi' | 'mr' | 'en'
 * @param {object} o.provider             speech provider ({ listen })
 * @param {Function} o.speak              (text, lang) => Promise
 * @param {Function} [o.parse]            (text) => value, or null if not understood
 * @param {Function} [o.onState]          UI updates: { phase, text?, interim?, messageKey? }
 * @param {AbortSignal} [o.signal]
 * @param {boolean} [o.skipFirstPrompt]   true when the prompt was already spoken
 * @returns {Promise<{status:'answer',text,value}|{status:'keyboard',reason}|{status:'paused'}|{status:'aborted'}>}
 */
export async function ask({
  prompt,
  lang,
  provider,
  speak,
  parse = (text) => text,
  onState = () => {},
  signal,
  skipFirstPrompt = false,
  silenceMs = 8000,
}) {
  let failures = 0;
  let silences = 0;
  let say = skipFirstPrompt ? null : prompt;

  const fail = (messageKey) => {
    failures += 1;
    if (failures >= MAX_FAILURES) return { status: 'keyboard', reason: messageKey };
    say = `${t(lang, messageKey)} ${prompt}`;
    return null;
  };

  for (;;) {
    if (signal?.aborted) return { status: 'aborted' };

    if (say) {
      onState({ phase: 'speaking', text: say });
      await speak(say, lang);
      if (signal?.aborted) return { status: 'aborted' };
    }

    onState({ phase: 'listening', interim: '' });
    const heard = await provider.listen({
      lang,
      signal,
      silenceMs,
      onInterim: (interim) => onState({ phase: 'listening', interim }),
    });

    if (heard.status === 'aborted') return { status: 'aborted' };

    // The paid speech service failed and the session switched to browser speech:
    // ask the same question again (not counted as a failed attempt).
    if (heard.status === 'switched') {
      say = prompt;
      continue;
    }

    if (HARD_FAILURES[heard.status]) {
      onState({ phase: 'keyboard', messageKey: HARD_FAILURES[heard.status] });
      return { status: 'keyboard', reason: HARD_FAILURES[heard.status] };
    }

    if (heard.status === 'silence') {
      silences += 1;
      if (silences >= 2) {
        onState({ phase: 'paused', messageKey: 'pausedPrompt' });
        return { status: 'paused' };
      }
      say = `${t(lang, 'silenceRepeat')} ${prompt}`;
      continue;
    }

    if (heard.status === 'ok') {
      onState({ phase: 'thinking', interim: heard.text });
      const value = await parse(heard.text); // may ask the AI (async)
      if (value !== null && value !== undefined) return { status: 'answer', text: heard.text, value };
      const out = fail('notUnderstood');
      if (out) {
        onState({ phase: 'keyboard', messageKey: 'keyboardHelp' });
        return out;
      }
      continue;
    }

    // 'unclear' or 'error': treat as noise.
    const out = fail('couldNotHear');
    if (out) {
      onState({ phase: 'keyboard', messageKey: 'keyboardHelp' });
      return out;
    }
  }
}
