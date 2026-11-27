// "Fix my details": after the advocate asks for changes, Arzi reads the note
// aloud and the citizen corrects any detail by voice. The corrected details are
// sent back and become the next version for the advocate.
import { useEffect, useState } from 'react';
import { t } from '@arzi/shared';
import { api } from '../lib/api.js';
import { getUserId } from '../lib/userId.js';
import { speak } from '../voice/tts.js';
import { useInterview } from '../conversation/useInterview.js';
import { runCorrection } from '../conversation/interview.js';
import { aiExtract } from '../lib/ai.js';
import InterviewView from './InterviewView.jsx';
import EmergencyPanel from './EmergencyPanel.jsx';

export default function FixDetails({ doc, note, onDone, onCancel }) {
  const [lang, setLang] = useState(doc.language);
  const { view, start, respond, reset, interrupt, finishListening } = useInterview({ lang, setLang });
  const [save, setSave] = useState(null);

  // Started by the "Fix my details" tap, so the browser allows speech.
  useEffect(() => {
    start((io) => runCorrection(io, { fields: doc.fields, note, aiExtract }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    setSave('saving');
    const r = await api(`/documents/${doc.id}/revise`, {
      method: 'POST',
      body: { userId: getUserId(), fields: view.outcome.fields, transcript: view.outcome.transcript },
    });
    if (!r.ok) return setSave('failed');
    speak(t(doc.language, 'fixSent'), doc.language);
    onDone(r.data);
  };

  useEffect(() => {
    if (view.outcome?.outcome === 'ready') send();
    if (view.outcome?.outcome === 'aborted') onCancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.outcome]);

  if (view.emergency) return <EmergencyPanel lang={lang} onClose={onCancel} />;

  return (
    <section className="fix">
      <h2>{t(lang, 'fixTitle')}</h2>
      <InterviewView lang={lang} view={view} respond={respond} interrupt={interrupt} finishListening={finishListening} />
      {save === 'saving' && <p className="muted">{t(lang, 'saving')}</p>}
      {save === 'failed' && (
        <div className="save-failed" role="alert">
          <p className="warning">{t(lang, 'saveFailed')}</p>
          <button type="button" className="btn btn-primary btn-big" onClick={send}>
            {t(lang, 'retry')}
          </button>
        </div>
      )}
      <button
        type="button"
        className="btn btn-link"
        onClick={() => {
          reset();
          onCancel();
        }}
      >
        {t(lang, 'stop')}
      </button>
    </section>
  );
}
