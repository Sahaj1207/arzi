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

// The small mic is always live (except in the sample case):
//   Arzi speaking  → tap = stop talking and listen now
//   listening      → tap = "I'm done", use what was heard
//   paused / keyboard → tap = listen again
export default function InterviewView({ lang, view, respond, interrupt, finishListening, sample = false, showAnswers = true }) {
  const fieldIndex = FIELDS.findIndex((f) => f.id === view.current);
  const filled = Object.keys(view.fields ?? {}).length;
  const step = fieldIndex === -1 ? filled : fieldIndex;

  let micState = view.phase === 'speaking' ? 'speaking' : view.phase === 'listening' ? 'listening' : 'idle';
  if (sample && view.running) micState = 'sample';
  const longAnswer = view.current === 'describe';
  const micLabel = sample
    ? t(lang, 'playingSample')
    : t(
        lang,
        view.phase === 'paused'
          ? 'tapToContinue'
          : view.phase === 'listening'
            ? finishListening && longAnswer
              ? 'tapWhenDone'
              : 'listening'
            : view.phase === 'speaking' && interrupt
              ? 'tapToAnswer'
              : 'tapToSpeak',
      );
  const onMic = () => {
    if (view.phase === 'speaking' && interrupt) return interrupt();
    if (view.phase === 'listening' && finishListening) return finishListening();
    respond({ voice: true });
  };
  const micEnabled =
    !sample &&
    (['paused', 'keyboard'].includes(view.phase) ||
      (view.phase === 'speaking' && !!interrupt) ||
      (view.phase === 'listening' && !!finishListening));

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
            onClick={onMic}
            disabled={!micEnabled}
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
