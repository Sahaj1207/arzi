// React hook around ask(): runs one voice question and exposes what the screen shows.
//   state.phase: 'idle' | 'speaking' | 'listening' | 'thinking' | 'paused' | 'keyboard'
//   state.text:      what Arzi is saying (always shown on screen too)
//   state.interim:   live transcript while the user speaks
//   state.messageKey: i18n key for the keyboard / pause message
//   state.voiceless: true when no TTS voice exists → highlight the text instead
import { useCallback, useEffect, useRef, useState } from 'react';
import { ask } from './ask.js';
import { getSpeechProvider } from './speechProvider.js';
import { speak, stopSpeaking } from './tts.js';

export function useVoice(lang) {
  const [state, setState] = useState({ phase: 'idle' });
  const abortRef = useRef(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopSpeaking();
    setState((s) => ({ ...s, phase: 'idle', interim: '' }));
  }, []);

  useEffect(() => cancel, [cancel]); // stop everything when the screen closes

  const run = useCallback(
    async ({ prompt, parse, skipFirstPrompt } = {}) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const provider = getSpeechProvider();
      if (!provider.isSupported()) {
        setState({ phase: 'keyboard', text: prompt, messageKey: 'unsupportedBrowser' });
        const { spoken } = await speak(prompt, lang);
        setState((s) => ({ ...s, voiceless: !spoken }));
        return { status: 'keyboard', reason: 'unsupportedBrowser' };
      }

      const speakAndTrack = async (text, l) => {
        const { spoken } = await speak(text, l);
        if (!ac.signal.aborted) setState((s) => ({ ...s, voiceless: !spoken }));
      };

      const result = await ask({
        prompt,
        lang,
        parse,
        provider,
        speak: speakAndTrack,
        signal: ac.signal,
        skipFirstPrompt,
        onState: (s) => !ac.signal.aborted && setState((prev) => ({ ...prev, ...s })),
      });

      if (result.status === 'answer') setState((s) => ({ ...s, phase: 'idle', interim: '' }));
      return result;
    },
    [lang],
  );

  return { state, run, cancel };
}
