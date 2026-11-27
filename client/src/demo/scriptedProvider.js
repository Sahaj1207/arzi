// A speech provider that "hears" pre-typed answers instead of the microphone.
// Used by "Try a sample case": the real interview runs (Arzi really speaks,
// parses, reads back and confirms), but each answer appears word by word on
// screen as if spoken. Needs no microphone, no permission and no key.
export function createScriptedProvider(answers, { wordMs = 140, thinkMs = 700 } = {}) {
  const queue = [...answers];
  return {
    name: 'sample',
    isSupported: () => true,
    listen: ({ onInterim = () => {}, signal } = {}) =>
      new Promise((resolve) => {
        const text = queue.shift();
        if (text === undefined) return resolve({ status: 'silence', text: '' });
        const words = text.split(' ');
        let shown = 0;
        let timer;
        const finish = (result) => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          resolve(result);
        };
        const onAbort = () => finish({ status: 'aborted', text: '' });
        signal?.addEventListener('abort', onAbort, { once: true });
        if (signal?.aborted) return onAbort();

        const tick = () => {
          shown += 1;
          onInterim(words.slice(0, shown).join(' '));
          timer = shown < words.length ? setTimeout(tick, wordMs) : setTimeout(() => finish({ status: 'ok', text, confidence: 1 }), thinkMs);
        };
        timer = setTimeout(tick, thinkMs);
      }),
  };
}
