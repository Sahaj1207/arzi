// "My documents": every notice made on this phone, newest first, with status,
// date, PDF, WhatsApp, the consent recording and earlier versions.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { t, formatINR } from '@arzi/shared';
import { api } from '../lib/api.js';
import { getUserId } from '../lib/userId.js';
import DocumentActions from '../components/DocumentActions.jsx';
import ConsentRecord from '../components/ConsentRecord.jsx';

const day = (sql, lang) =>
  new Date(`${sql.replace(' ', 'T')}Z`).toLocaleDateString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { dateStyle: 'long' });

export default function History({ lang }) {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api(`/documents?userId=${encodeURIComponent(getUserId())}`).then((r) => (r.ok ? setDocs(r.data) : setError(true)));
  }, []);

  return (
    <main className="doc">
      <h1 className="page-title">{t(lang, 'history')}</h1>
      {error && <p className="warning">{t(lang, 'offline')}</p>}
      {docs?.length === 0 && <p>{t(lang, 'noDocuments')}</p>}

      <ul className="history">
        {docs?.map((d) => {
          const dl = d.language;
          const older = d.versions.slice(0, -1).reverse();
          return (
            <li key={d.id} className="history-item" lang={dl}>
              <div className="history-head">
                <strong>
                  {d.fields.tenantName?.text} → {d.fields.landlordName?.text}
                </strong>
                <span className="history-amount">{formatINR(d.fields.depositAmount?.amount ?? 0)}</span>
              </div>
              <p className="muted">
                <span className={`chip chip-${d.status}`}>{t(dl, `status_${d.status}`)}</span>{' '}
                {t(dl, 'madeOn', { date: day(d.createdAt, dl) })}
              </p>

              <Link className="btn" to={`/documents/${d.id}`}>
                {t(dl, 'openDocument')}
              </Link>
              <DocumentActions doc={d} />
              <ConsentRecord doc={d} />

              {older.length > 0 && (
                <details className="versions-log">
                  <summary>
                    {t(dl, 'earlierVersions')} ({older.length})
                  </summary>
                  {older.map((v) => (
                    <details key={v.no} className="version-item">
                      <summary>
                        {t(dl, 'version', { n: v.no })} · {t(dl, `author_${v.author}`)} · {day(v.createdAt, dl)}
                      </summary>
                      <pre className="notice-text" lang="en">{v.notice}</pre>
                    </details>
                  ))}
                </details>
              )}
            </li>
          );
        })}
      </ul>

      <Link className="btn btn-primary btn-big" to="/">
        {t(lang, 'newNotice')}
      </Link>
    </main>
  );
}
