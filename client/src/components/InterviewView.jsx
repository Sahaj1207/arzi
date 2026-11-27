// Everything shown while Arzi is talking with the citizen: progress, mic status,
// what Arzi says, the value being confirmed, live transcript, the pause and
// keyboard fallbacks, and the answer cards. Used by the interview and by "Fix my details".
import { FIELDS, t } from '@arzi/shared';
import MicButton from './MicButton.jsx';
import ArziSays from './ArziSays.jsx';
import LiveTranscript from './LiveTranscript.jsx';
import KeyboardFallback from './KeyboardFallback.jsx';
import FieldCards from './FieldCards.jsx';
import ConfirmValue from './ConfirmValue.jsx';

export default function InterviewView({ lang, view, respond, showCards }) {
  const micState = view.phase === 'speaking' ? 'speaking' : view.phase === 'listening' ? 'listening' : 'idle';
  const fieldIndex = FIELDS.findIndex((f) => f.id === view.current);

  return (
    <>
      {fieldIndex !== -1 && view.running && (
        <p className="progress">{t(lang, 'step', { n: fieldIndex + 1, total: FIELDS.length })}</p>
      )}

      {view.running && (
        <MicButton
          state={micState}
          size="small"
          label={t(lang, view.phase === 'paused' ? 'tapToContinue' : 'tapToSpeak')}
          onClick={() => respond({ voice: true })}
          disabled={!['paused', 'keyboard'].includes(view.phase)}
        />
      )}

      <ArziSays text={view.text} speaking={view.phase === 'speaking'} voiceless={view.voiceless} />

      <ConfirmValue lang={lang} pending={view.pending} />

      {view.phase === 'listening' && <LiveTranscript lang={lang} text={view.interim} listening />}

      {view.phase === 'paused' && (
        <>
          <p className="paused-note">{t(lang, 'pausedPrompt')}</p>
          <button type="button" className="btn btn-primary btn-big" onClick={() => respond({ tap: true })}>
            {t(lang, 'tapToContinue')}
          </button>
        </>
      )}

      {view.phase === 'keyboard' && (
        <KeyboardFallback
          key={`${view.current}-${view.text}`}
          lang={lang}
          messageKey={view.messageKey}
          error={view.kbError}
          onSubmit={(typed) => respond({ typed })}
        />
      )}

      {showCards && <FieldCards lang={lang} fields={view.fields} current={view.current} />}
    </>
  );
}
