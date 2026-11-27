// Connects the interview script (interview.js) to real voice and the screen.
// Implements the `io` object: ask() uses the voice loop from step 3 and, when
// that ends in "paused" or "keyboard", waits for the user to tap or type.
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@arzi/shared';
import { runInterview } from './interview.js';
import { ask as voiceAsk } from '../voice/ask.js';
import { getSpeechProvider } from '../voice/speechProvider.js';
import { speak, stopSpeaking } from '../voice/tts.js';

const INITIAL = {
  running: false,
  current: null, // 'describe' | field id | 'summary' | 'done' | 'other'
  phase: 'idle', // 'speaking' | 'listening' | 'thinking' | 'paused' | 'keyboard' | 'idle'
  text: '', // what Arzi is saying
  interim: '',
  voiceless: false,
  problem: '',
  fields: {},
  pending: null, // { fieldId, value } being confirmed
  emergency: false,
  outcome: null, // result of runInterview
  messageKey: null,
  kbError: null,
};

export function useInterview({ lang, setLang }) {
  const [view, setView] = useState(INITIAL);
  const langRef = useRef(lang);
  const abortRef = useRef(null);
  const waiterRef = useRef(null); // resolves when the user taps "continue" / types / taps mic

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const patch = useCallback((p) => setView((v) => ({ ...v, ...p })), []);

  const waitForUser = () =>
    new Promise((resolve) => {
      waiterRef.current = resolve;
    });

  // Called by the screen: "Tap to continue", mic tap, or a typed answer.
  const respond = useCallback((input) => {
    const resolve = waiterRef.current;
    waiterRef.current = null;
    resolve?.(input);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopSpeaking();
    respond({ aborted: true });
  }, [respond]);

  useEffect(() => stop, [stop]);

  // runner: which flow to run (the full interview, or runCorrection for fixes).
  const start = useCallback(async (runner = runInterview) => {
    stop();
    const ac = new AbortController();
    abortRef.current = ac;
    const { signal } = ac;
    setView({ ...INITIAL, running: true });

    const speakTracked = async (text, l) => {
      if (signal.aborted) return;
      const { spoken } = await speak(text, l);
      if (!signal.aborted) patch({ voiceless: !spoken });
    };

    const io = {
      getLang: () => langRef.current,
      setLang: (code) => {
        langRef.current = code;
        setLang(code);
      },
      update: (p) => !signal.aborted && patch(p),
      say: async (text) => {
        if (signal.aborted) return;
        patch({ text, phase: 'speaking', interim: '' });
        await speakTracked(text, langRef.current);
        if (!signal.aborted) patch({ phase: 'idle' });
      },
      ask: async ({ prompt, parse, keyboard }) => {
        let useKeyboard = keyboard || !getSpeechProvider().isSupported();
        let reason = keyboard ? null : 'unsupportedBrowser';
        let promptSpoken = false;

        for (;;) {
          if (signal.aborted) return { status: 'aborted' };

          if (!useKeyboard) {
            const r = await voiceAsk({
              prompt,
              lang: langRef.current,
              parse,
              provider: getSpeechProvider(),
              speak: speakTracked,
              signal,
              onState: (s) => !signal.aborted && patch(s),
            });
            if (r.status === 'answer') {
              patch({ phase: 'idle', interim: '' });
              return { ...r, via: 'voice' };
            }
            if (r.status === 'aborted') return r;
            if (r.status === 'paused') {
              patch({ phase: 'paused', messageKey: 'pausedPrompt' });
              const input = await waitForUser();
              if (input.aborted) return { status: 'aborted' };
              continue; // ask the question again from the start
            }
            useKeyboard = true;
            reason = r.reason;
            promptSpoken = true;
          }

          // Keyboard: show the question and a text box; the mic stays available.
          if (!promptSpoken) {
            patch({ text: prompt, phase: 'speaking' });
            await speakTracked(prompt, langRef.current);
            promptSpoken = true;
          }
          patch({ phase: 'keyboard', messageKey: reason, kbError: null, text: prompt });
          for (;;) {
            const input = await waitForUser();
            if (input.aborted) return { status: 'aborted' };
            if (input.voice) {
              useKeyboard = false;
              break;
            }
            const value = parse(input.typed);
            if (value !== null && value !== undefined) {
              patch({ phase: 'idle', kbError: null });
              return { status: 'answer', text: input.typed, value, via: 'keyboard' };
            }
            patch({ kbError: t(langRef.current, 'notUnderstood') });
          }
        }
      },
    };

    const outcome = await runner(io);
    if (!signal.aborted) patch({ running: false, outcome, phase: 'idle' });
    return outcome;
  }, [patch, setLang, stop]);

  const reset = useCallback(() => {
    stop();
    setView(INITIAL);
  }, [stop]);

  return { view, start, respond, reset };
}
