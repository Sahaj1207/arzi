// What the citizen sees while Arzi talks with them:
//   progress bar → one large card with the current question → mic status →
//   live words → the value being confirmed (very large) → fallbacks → answers so far.
// `sample` = the scripted "Try a sample case": never shows a red mic or
// "speak now", because nobody is expected to speak.
import { FIELDS, t } from '@arzi/shared';
import MicButton from './MicButton.jsx';
import LiveTranscript from './LiveTranscript.jsx';
import KeyboardFallback from './KeyboardFallback.jsx';
import ConfirmValue from './ConfirmValue.jsx';
import AnswerList from './AnswerList.jsx';

export default function InterviewView({ lang, view, respond, sample = false, showAnswers = true }) {
  const fieldIndex = FIELDS.findIndex((f) => f.id === view.current);
  const filled = Object.keys(view.fields ?? {}).length;
  const step = fieldIndex === -1 ? filled : fieldIndex;

  let micState = view.phase === 'speaking' ? 'speaking' : view.phase === 'listening' ? 'listening' : 'idle';
  if (sample && view.running) micState = 'sample';
  const micLabel = sample
    ? t(lang, 'playingSample')
    : t(lang, view.phase === 'paused' ? 'tapToContinue' : view.phase === 'listening' ? 'listening' : 'tapToSpeak');

  return (
    <div className="interview">
      {(fieldIndex !== -1 || filled > 0) && (
        <div className="progress" aria-label={t(lang, 'step', { n: step + 1, total: FIELDS.length })}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${(Math.min(filled, FIELDS.length) / FIELDS.length) * 100}%` }} />
          </div>
          <span className="progress-text">
            {Math.min(step + 1, FIELDS.length)} / {FIELDS.length}
          </span>
        </div>
      )}

      {view.text && (
        <div
          className={`question ${view.phase === 'speaking' ? 'is-speaking' : ''} ${view.voiceless ? 'is-voiceless' : ''}`}
          aria-live="polite"
        >
          <p>{view.text}</p>
        </div>
      )}

      <ConfirmValue lang={lang} pending={view.pending} />

      <div className="interview-status">
        {view.running && (
          <MicButton
            state={micState}
            size="small"
            label={micLabel}
            onClick={() => respond({ voice: true })}
            disabled={sample || !['paused', 'keyboard'].includes(view.phase)}
          />
        )}
        {view.phase === 'listening' && (
          <LiveTranscript lang={lang} text={view.interim} listening label={sample ? t(lang, 'sampleAnswer') : null} />
        )}
      </div>

      {view.phase === 'paused' && !sample && (
        <>
          <p className="paused-note">{t(lang, 'pausedPrompt')}</p>
          <button type="button" className="btn btn-primary btn-big" onClick={() => respond({ tap: true })}>
            {t(lang, 'tapToContinue')}
          </button>
        </>
      )}

      {view.phase === 'keyboard' && !sample && (
        <KeyboardFallback
          key={`${view.current}-${view.text}`}
          lang={lang}
          messageKey={view.messageKey}
          error={view.kbError}
          onSubmit={(typed) => respond({ typed })}
        />
      )}

      {showAnswers && filled > 0 && <AnswerList lang={lang} fields={view.fields} current={view.current} onlyFilled />}
    </div>
  );
}
