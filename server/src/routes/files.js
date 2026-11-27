// The final document as PDF, plus sharing.
//
//   GET  /api/documents/:id/pdf?userId=     PDF of an approved document (owner)
//   GET  /api/documents/:id/print?userId=   printable page (browser print-to-PDF)
//   POST /api/documents/:id/share?userId=   make a share link for WhatsApp
//   GET  /api/shared/:token                 the shared PDF (anyone with the link)
//
// If Chromium cannot make the PDF, every PDF route answers with the printable
// page instead, which opens the browser's print dialog ("Save as PDF").
// Nothing here can bring the server down.
import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { db } from '../db.js';
import { serializeDocument, getDocumentRow } from './documents.js';
import { renderPdf } from '../pdf/render.js';
import { documentHtml } from '../pdf/noticeHtml.js';

export const filesRouter = Router();
export const sharedRouter = Router();

const FINAL = new Set(['approved', 'consented']);
const byToken = db.prepare('SELECT * FROM documents WHERE share_token = ?');
const setToken = db.prepare('UPDATE documents SET share_token = ? WHERE id = ? AND share_token IS NULL');

const bad = (res, error, status = 400) => res.status(status).json({ error });

function ownedFinal(req, res) {
  const row = getDocumentRow(req.params.id);
  if (!row || row.user_id !== req.query.userId) return void bad(res, 'not_found', 404);
  if (!FINAL.has(row.status)) return void bad(res, 'not_approved', 409);
  return row;
}

async function sendPdfOrPrintable(res, row) {
  const doc = serializeDocument(row);
  try {
    const pdf = await renderPdf(documentHtml(doc));
    const name = `arzi-legal-notice-${row.id.slice(0, 8)}-v${doc.version.no}.pdf`;
    res.type('application/pdf').set('Content-Disposition', `inline; filename="${name}"`).send(pdf);
  } catch (err) {
    console.warn('[pdf] falling back to printable page:', err.message);
    res.set('X-Arzi-Fallback', 'print').type('html').send(documentHtml(doc, { print: true }));
  }
}

filesRouter.get('/:id/pdf', async (req, res, next) => {
  try {
    const row = ownedFinal(req, res);
    if (row) await sendPdfOrPrintable(res, row);
  } catch (err) {
    next(err);
  }
});

filesRouter.get('/:id/print', (req, res) => {
  const row = ownedFinal(req, res);
  if (row) res.type('html').send(documentHtml(serializeDocument(row), { print: true }));
});

filesRouter.post('/:id/share', (req, res) => {
  const row = ownedFinal(req, res);
  if (!row) return;
  if (!row.share_token) setToken.run(randomBytes(18).toString('base64url'), row.id);
  const { share_token: token } = getDocumentRow(row.id);
  res.json({ path: `/api/shared/${token}` });
});

sharedRouter.get('/:token', async (req, res, next) => {
  try {
    const row = /^[A-Za-z0-9_-]{20,40}$/.test(req.params.token) ? byToken.get(req.params.token) : null;
    if (!row || !FINAL.has(row.status)) return bad(res, 'not_found', 404);
    await sendPdfOrPrintable(res, row);
  } catch (err) {
    next(err);
  }
});
