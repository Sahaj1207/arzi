// A citizen's document: status, plain-language summary, the English notice and
// their details. Polls the server every 5 s so the status changes by itself
// when the advocate approves or asks for changes, and says the news aloud.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { t } from '@arzi/shared';
import { api } from '../lib/api.js';
import { getUserId } from '../lib/userId.js';
import { speak } from '../voice/tts.js';
import FieldCards from '../components/FieldCards.jsx';
import FixDetails from '../components/FixDetails.jsx';

const POLL_MS = 5000;
const SPOKEN = { pending_review: 'sentSpoken', approved: 'approvedSpoken', changes_requested: 'changesSpoken' };

export default function DocumentStatus({ lang }) {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null); // 'notFound' | 'offline'
  const [fixing, setFixing] = useState(false);
  const lastStatus = useRef(null);

  useEffect(() => {
    let stopped = false;
    let timer;
    const load = async () => {
      const r = await api(`/documents/${id}?userId=${encodeURIComponent(getUserId())}`);
      if (stopped) return;
      if (r.ok) {
        setDoc(r.data);
        setError(null);
        // Announce the status when it first loads and whenever it changes.
        if (r.data.status !== lastStatus.current) {
          lastStatus.current = r.data.status;
          const key = SPOKEN[r.data.status];
          if (key) speak(t(r.data.language, key), r.data.language);
        }
      } else {
        setError(r.status === 404 ? 'notFound' : 'offline');
      }
      // Keep polling until the advocate has decided (and on network errors).
      if (!r.ok ? r.status !== 404 : r.data.status === 'pending_review' || r.data.status === 'changes_requested') {
        timer = setTimeout(load, POLL_MS);
      }
    };
    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (error === 'notFound') {
    return (
      <main className="doc">
        <p className="warning">{t(lang, 'notFound')}</p>
        <Link className="btn btn-primary btn-big" to="/">{t(lang, 'newNotice')}</Link>
      </main>
    );
  }
  if (!doc) return <main className="doc"><p>{t(lang, error === 'offline' ? 'offline' : 'saving')}</p></main>;

  const dl = doc.language;
  const lastNote = [...doc.reviews].reverse().find((r) => r.action === 'request_changes' && r.note);

  return (
    <main className="doc">
      <div className={`status status-${doc.status}`} role="status" aria-live="polite">
        <span className="status-dot" aria-hidden="true" />
        <span>{t(dl, `status_${doc.status}`)}</span>
      </div>
      {doc.status === 'pending_review' && <p className="muted">{t(dl, 'autoUpdate')}</p>}
      {error === 'offline' && <p className="muted">{t(dl, 'offline')}</p>}

      {doc.status === 'changes_requested' && lastNote && (
        <section className="note">
          <h2>{t(dl, 'advocateNote')}</h2>
          <p>{lastNote.note}</p>
        </section>
      )}

      {doc.status === 'changes_requested' && !fixing && (
        <button type="button" className="btn btn-primary btn-big" onClick={() => setFixing(true)}>
          {t(dl, 'fixDetails')}
        </button>
      )}

      {fixing && (
        <FixDetails
          doc={doc}
          note={lastNote?.note ?? ''}
          onCancel={() => setFixing(false)}
          onDone={(updated) => {
            lastStatus.current = updated.status; // Arzi already said "sent back"
            setDoc(updated);
            setFixing(false);
          }}
        />
      )}

      {doc.version && !fixing && (
        <>
          <section className="summary" lang={dl}>
            <h2>{t(dl, 'summaryHeading')}</h2>
            <ol>
              {doc.version.summary.split('\n').map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </section>

          <section className="notice">
            <h2>
              {t(dl, 'noticeHeading')} <small className="muted">· {t(dl, 'version', { n: doc.version.no })}</small>
            </h2>
            <pre className="notice-text" lang="en">{doc.version.notice}</pre>
          </section>
        </>
      )}

      {!fixing && (
        <section>
          <h2>{t(dl, 'detailsHeading')}</h2>
          <FieldCards lang={dl} fields={doc.fields} current={null} />
        </section>
      )}

      <Link className="btn btn-big" to="/">{t(dl, 'newNotice')}</Link>
    </main>
  );
}
