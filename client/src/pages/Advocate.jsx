// /advocate — the demo advocate's review desk (English UI, laptop or phone).
//   PIN gate (default 1234) → list of drafts by status → open one to see what the
//   citizen said, the 7 details, every version, and edit the notice. Then
//   Approve, or Request changes with a short note (the citizen fixes by voice).
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FIELDS, LANGUAGES, displayFieldValue, formatINR } from '@arzi/shared';
import { advocateApi, clearPin, getPin, setPin } from '../lib/advocateApi.js';

const STATUS_LABEL = {
  pending_review: 'Waiting for review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  consented: 'Approved + consent',
};
const TABS = [
  ['pending_review', 'To review'],
  ['changes_requested', 'Changes requested'],
  ['approved', 'Approved'],
  ['', 'All'],
  ['notes', 'Other problems'],
];
const langName = (code) => LANGUAGES.find((l) => l.code === code)?.englishLabel ?? code;
const when = (sqlTime) => new Date(`${sqlTime.replace(' ', 'T')}Z`).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function Advocate() {
  const [authed, setAuthed] = useState(Boolean(getPin()));
  const { id } = useParams();

  const logout = useCallback(() => {
    clearPin();
    setAuthed(false);
  }, []);

  if (!authed) return <PinGate onOk={() => setAuthed(true)} />;
  return (
    <main className="adv">
      <div className="adv-top">
        <h1>Advocate review</h1>
        <button type="button" className="btn btn-link" onClick={logout}>
          Lock
        </button>
      </div>
      {id ? <Review id={id} onAuthFail={logout} /> : <DraftList onAuthFail={logout} />}
    </main>
  );
}

function PinGate({ onOk }) {
  const [pin, setPinValue] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const r = await advocateApi('/login', { method: 'POST' }, pin);
    if (r.ok) {
      setPin(pin);
      onOk();
    } else {
      setError(r.status === 429 ? 'Too many wrong PINs. Try again in 10 minutes.' : 'Wrong PIN.');
    }
  };

  return (
    <main className="adv adv-gate">
      <h1>Advocate review</h1>
      <form onSubmit={submit} className="pin-form">
        <label htmlFor="pin">Demo PIN</label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPinValue(e.target.value)}
          autoFocus
        />
        {error && <p className="keyboard-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-big" disabled={!pin}>
          Open
        </button>
        <p className="muted">Prototype: one demo advocate. The default PIN is in the README.</p>
      </form>
    </main>
  );
}

function DraftList({ onAuthFail }) {
  const [tab, setTab] = useState('pending_review');
  const [items, setItems] = useState(null);

  useEffect(() => {
    let stopped = false;
    let timer;
    const load = async () => {
      const r = await advocateApi(tab === 'notes' ? '/notes' : `/documents${tab ? `?status=${tab}` : ''}`);
      if (stopped) return;
      if (r.status === 401 || r.status === 429) return onAuthFail();
      if (r.ok) setItems(r.data);
      timer = setTimeout(load, 10000); // new drafts appear without reloading
    };
    setItems(null);
    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [tab, onAuthFail]);

  return (
    <>
      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key || 'all'}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`tab ${tab === key ? 'tab-on' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {items === null && <p className="muted">Loading…</p>}
      {items?.length === 0 && <p className="muted">Nothing here.</p>}

      {tab === 'notes' ? (
        <ul className="adv-list">
          {items?.map((n) => (
            <li key={n.id} className="adv-item">
              <span className="adv-item-main">{n.problem}</span>
              <span className="muted">
                {langName(n.language)} · {when(n.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="adv-list">
          {items?.map((d) => (
            <li key={d.id}>
              <Link className="adv-item" to={`/advocate/${d.id}`}>
                <span className="adv-item-main">
                  {d.tenant} → {d.landlord}
                </span>
                <span className="adv-item-amount">{d.amount ? formatINR(d.amount) : ''}</span>
                <span className="muted">
                  <span className={`chip chip-${d.status}`}>{STATUS_LABEL[d.status] ?? d.status}</span> v{d.version} ·{' '}
                  {langName(d.language)} · {when(d.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Review({ id, onAuthFail }) {
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [notice, setNotice] = useState('');
  const [summary, setSummary] = useState('');
  const [note, setNote] = useState('');
  const [viewNo, setViewNo] = useState(null); // older version being viewed
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const r = await advocateApi(`/documents/${id}`);
    if (r.status === 401 || r.status === 429) return onAuthFail();
    if (!r.ok) return setMessage('Document not found.');
    setDoc(r.data);
    setNotice(r.data.version.notice);
    setSummary(r.data.version.summary);
    setViewNo(null);
  }, [id, onAuthFail]);

  useEffect(() => {
    load();
  }, [load]);

  if (!doc) return <p className="muted">{message || 'Loading…'}</p>;

  const pending = doc.status === 'pending_review';
  const edited = notice !== doc.version.notice || summary !== doc.version.summary;
  const older = viewNo !== null ? doc.versions.find((v) => v.no === viewNo) : null;

  const decide = async (action) => {
    if (action === 'request-changes' && !note.trim()) return setMessage('Write a short note for the citizen first.');
    setBusy(true);
    setMessage('');
    const body = { note: note.trim() };
    if (edited) Object.assign(body, { notice, summary });
    const r = await advocateApi(`/documents/${id}/${action}`, { method: 'POST', body });
    setBusy(false);
    if (r.status === 401) return onAuthFail();
    if (!r.ok) return setMessage(r.error === 'not_pending' ? 'This draft was already decided.' : `Could not save (${r.error}).`);
    navigate('/advocate');
  };

  return (
    <article className="review">
      <Link to="/advocate" className="btn btn-link">
        ← All drafts
      </Link>
      <header>
        <h2>
          {doc.fields.tenantName?.text} → {doc.fields.landlordName?.text}
        </h2>
        <p className="muted">
          <span className={`chip chip-${doc.status}`}>{STATUS_LABEL[doc.status]}</span> Version {doc.version.no} ·
          Citizen language: {langName(doc.language)} · Received {when(doc.createdAt)}
        </p>
      </header>

      <section>
        <h3>What the citizen said</h3>
        <blockquote lang={doc.language}>{doc.problem || '—'}</blockquote>
      </section>

      <section>
        <h3>Details (confirmed by the citizen)</h3>
        <dl className="facts">
          {FIELDS.map((f) => (
            <div key={f.id}>
              <dt>{f.label.en}</dt>
              <dd lang={doc.language}>{displayFieldValue(f, doc.fields[f.id], 'en') || '—'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <details className="transcript-log">
        <summary>Full conversation ({doc.transcript.length} answers)</summary>
        <ol>
          {doc.transcript.map((e, i) => (
            <li key={i}>
              <span className="muted">Arzi: {e.q}</span>
              <br />
              <strong lang={doc.language}>{e.a}</strong>
              {e.via === 'keyboard' && <span className="chip">typed</span>}
            </li>
          ))}
        </ol>
      </details>

      {doc.reviews.length > 0 && (
        <section>
          <h3>Earlier decisions</h3>
          <ul>
            {doc.reviews.map((r, i) => (
              <li key={i}>
                {r.action === 'approve' ? 'Approved' : 'Changes requested'} · {when(r.createdAt)}
                {r.note && <>: “{r.note}”</>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3>Versions</h3>
        <div className="versions">
          {doc.versions.map((v) => (
            <button
              key={v.no}
              type="button"
              className={`tab ${(viewNo ?? doc.version.no) === v.no ? 'tab-on' : ''}`}
              onClick={() => setViewNo(v.no === doc.version.no ? null : v.no)}
            >
              v{v.no} · {v.author}
            </button>
          ))}
        </div>
      </section>

      {older ? (
        <section>
          <h3>Version {older.no} (read only)</h3>
          <pre className="notice-text">{older.notice}</pre>
          <pre className="notice-text" lang={doc.language}>{older.summary}</pre>
        </section>
      ) : (
        <>
          <section>
            <h3>Legal notice {pending ? '(you can edit)' : ''}</h3>
            <textarea
              className="editor"
              value={notice}
              onChange={(e) => setNotice(e.target.value)}
              readOnly={!pending}
              rows={24}
              spellCheck
            />
            <p className="muted">“Reviewed by Advocate {doc.advocateName}” is added automatically when you approve.</p>
          </section>
          <section>
            <h3>Plain-language summary for the citizen ({langName(doc.language)})</h3>
            <textarea
              className="editor"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              readOnly={!pending}
              rows={7}
              lang={doc.language}
            />
          </section>
        </>
      )}

      {pending && (
        <section className="decide">
          <label htmlFor="note">Note for the citizen (needed for “Request changes”)</label>
          <textarea
            id="note"
            className="editor"
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Please confirm the exact date you moved out."
          />
          {message && <p className="keyboard-error" role="alert">{message}</p>}
          <div className="decide-buttons">
            <button type="button" className="btn btn-primary btn-big" disabled={busy} onClick={() => decide('approve')}>
              {edited ? 'Save edits and approve' : 'Approve'}
            </button>
            <button type="button" className="btn btn-big btn-warn" disabled={busy} onClick={() => decide('request-changes')}>
              Request changes
            </button>
          </div>
        </section>
      )}
      {!pending && message && <p className="keyboard-error">{message}</p>}
    </article>
  );
}
