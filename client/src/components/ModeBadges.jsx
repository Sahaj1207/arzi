// One small status line for the footer: which speech service and mode are on,
// updated live if a paid service fails and the session falls back.
// Technical information for judges and testers, so it is always in English.
import { useEffect, useState } from 'react';
import { getAiConsent } from '../lib/prefs.js';
import { aiServiceFailed } from '../lib/ai.js';

export default function ModeBadges({ config }) {
  const [, refresh] = useState(0);
  useEffect(() => {
    const bump = () => refresh((n) => n + 1);
    window.addEventListener('arzi:ai-fallback', bump);
    const timer = setInterval(bump, 3000); // consent is given inside the interview
    return () => {
      window.removeEventListener('arzi:ai-fallback', bump);
      clearInterval(timer);
    };
  }, []);
  if (!config) return null;

  let voice = 'browser speech';
  if (config.speech === 'sarvam') {
    const consent = getAiConsent();
    if (aiServiceFailed('stt')) voice = 'browser speech (Sarvam unavailable, switched automatically)';
    else if (consent === 'yes') voice = 'Sarvam';
    else if (consent === 'no') voice = 'browser speech (AI declined)';
    else voice = 'Sarvam, after you agree';
  }
  const mode = config.mode === 'ai' ? 'AI' : 'demo (no AI keys)';

  return (
    <p className="status-line" lang="en">
      <span className={`status-dot-small ${config.mode === 'ai' ? 'is-ai' : ''}`} aria-hidden="true" />
      Voice: {voice}. Mode: {mode}.
    </p>
  );
}
