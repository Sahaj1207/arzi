// "Download PDF" and "Share on WhatsApp" for an approved document.
import { useState } from 'react';
import { t } from '@arzi/shared';
import { pdfUrl, shareOnWhatsApp } from '../lib/share.js';

const FINAL = new Set(['approved', 'consented']);

export default function DocumentActions({ doc }) {
  const [error, setError] = useState(false);
  if (!FINAL.has(doc.status)) return null;
  const lang = doc.language;
  return (
    <div className="doc-actions">
      <a className="btn btn-big" href={pdfUrl(doc)} target="_blank" rel="noopener">
        {t(lang, 'downloadPdf')}
      </a>
      <button
        type="button"
        className="btn btn-big btn-whatsapp"
        onClick={async () => setError(!(await shareOnWhatsApp(doc)))}
      >
        {t(lang, 'shareWhatsApp')}
      </button>
      {error && <p className="keyboard-error">{t(lang, 'shareFailed')}</p>}
    </div>
  );
}
