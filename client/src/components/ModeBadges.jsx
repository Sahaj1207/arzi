// One small status line for the footer: which speech service and mode are on,
// updated live if a paid service fails and the session falls back.
// Technical information for judges and testers, so it is always in English.
import { useEffect, useState } from 'react';
import { getAiConsent } from '../lib/prefs.js';
import { aiServiceFailed } from '../lib/ai.js';
import { lastSpeechService } from '../voice/speechProvider.js';

const NAME = { sarvam: 'Sarvam', groq: 'Groq' };

export default function ModeBadges({ config }) {
  const [, refresh] = useState(0);
  useEffect(() => {
    const bump = () => refresh((n) => n + 1);
    window.addEventListener('arzi:ai-fallback', bump);
    window.addEventListener('arzi:stt-provider', bump);
    window.addEventListener('arzi:ai-consent', bump);
    const timer = setInterval(bump, 3000);
    return () => {
      window.removeEventListener('arzi:ai-fallback', bump);
      window.removeEventListener('arzi:stt-provider', bump);
      window.removeEventListener('arzi:ai-consent', bump);
      clearInterval(timer);
    };
  }, []);
  if (!config) return null;

  // Speech order: Sarvam → Groq → browser (only the services with a key on the server).
  const chain = config.speechChain ?? [];
  const names = chain.map((p) => NAME[p] ?? p);
  const order = [...names, 'browser'].join(' → ');
  let voice = 'browser speech';
  if (chain.length) {
    const consent = getAiConsent();
    const current = lastSpeechService();
    if (aiServiceFailed('stt')) voice = `browser speech (${names.join(' and ')} unavailable, switched automatically)`;
    else if (consent !== 'yes') voice = `browser speech (tick the consent box to use ${names.join(' and ')})`;
    else if (current && current !== chain[0]) voice = `${NAME[current]} (backup; ${names[0]} unavailable), then browser`;
    else voice = order;
  }
  const ticked = getAiConsent() === 'yes';
  const mode = config.mode === 'ai' ? (ticked ? 'AI' : 'demo (consent box not ticked)') : chain.length ? 'demo drafting' : 'demo (no AI keys)';

  return (
    <p className="status-line" lang="en">
      <span className={`status-dot-small ${config.mode === 'ai' && ticked ? 'is-ai' : ''}`} aria-hidden="true" />
      Voice: {voice}. Mode: {mode}.
    </p>
  );
}
