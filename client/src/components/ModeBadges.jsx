// Small badges showing which speech provider and drafting mode are active.
const SPEECH_LABEL = { browser: 'Browser speech', sarvam: 'Sarvam', wispr: 'Wispr Flow' };

export default function ModeBadges({ config }) {
  if (!config) return null;
  return (
    <div className="badges" aria-label="Active services">
      <span className="badge">{SPEECH_LABEL[config.speech] ?? config.speech}</span>
      <span className={`badge ${config.mode === 'ai' ? 'badge-ai' : ''}`}>
        {config.mode === 'ai' ? 'AI mode' : 'Demo mode'}
      </span>
    </div>
  );
}
