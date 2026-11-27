// One small status line for the footer: which speech service and mode are on.
// Technical information for judges and testers, so it is always in English.
import { t } from '@arzi/shared';

const SPEECH_LABEL = { browser: 'browser speech', sarvam: 'Sarvam', wispr: 'Wispr Flow' };

export default function ModeBadges({ config }) {
  if (!config) return null;
  return (
    <p className="status-line" lang="en">
      <span className={`status-dot-small ${config.mode === 'ai' ? 'is-ai' : ''}`} aria-hidden="true" />
      {t('en', 'statusLine', {
        speech: SPEECH_LABEL[config.speech] ?? config.speech,
        mode: config.mode === 'ai' ? t('en', 'modeAi') : t('en', 'modeDemo'),
      })}
    </p>
  );
}
