// The words the user is saying, shown live while they speak.
import { t } from '@arzi/shared';

export default function LiveTranscript({ lang, text, listening }) {
  if (!listening && !text) return null;
  return (
    <div className={`transcript ${listening ? 'is-live' : ''}`} aria-live="polite">
      <span className="transcript-label">{listening ? t(lang, 'listening') : t(lang, 'youSaid')}</span>
      <p className="transcript-text" lang={lang}>
        {text || '…'}
      </p>
    </div>
  );
}
