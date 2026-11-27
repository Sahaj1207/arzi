// Advocate API, protected by the demo PIN (default 1234, ADVOCATE_PIN overrides).
// The browser sends the PIN in the X-Advocate-Pin header on every request.
// Wrong PINs are rate-limited per IP so a public live link cannot be brute-forced.
//
//   POST /api/advocate/login                     check the PIN
//   GET  /api/advocate/documents?status=         list (default: everything, newest first)
//   GET  /api/advocate/documents/:id             full document: transcript, fields, all versions
//   POST /api/advocate/documents/:id/approve     { notice?, summary? } edits → new advocate version
//   POST /api/advocate/documents/:id/request-changes   { note, notice?, summary? }
//   GET  /api/advocate/notes                     non-deposit problems citizens asked to note
import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { FIELDS } from '@arzi/shared';
import { db } from '../db.js';
import { config } from '../config.js';
import { serializeDocument, getDocumentRow } from './documents.js';

export const advocateRouter = Router();

// ---------- PIN check with a simple per-IP lockout ----------
const MAX_WRONG = 10;
const WINDOW_MS = 10 * 60 * 1000;
const wrongByIp = new Map(); // ip → { count, since }

function pinMatches(given) {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(config.advocatePin);
  return a.length === b.length && timingSafeEqual(a, b);
}

function requirePin(req, res, next) {
  const ip = req.ip;
  const entry = wrongByIp.get(ip);
  if (entry && Date.now() - entry.since > WINDOW_MS) wrongByIp.delete(ip);
  if ((wrongByIp.get(ip)?.count ?? 0) >= MAX_WRONG) return res.status(429).json({ error: 'too_many_attempts' });

  const pin = req.get('X-Advocate-Pin') ?? req.body?.pin;
  if (pinMatches(pin)) return next();
  const e = wrongByIp.get(ip) ?? { count: 0, since: Date.now() };
  e.count += 1;
  wrongByIp.set(ip, e);
  return res.status(401).json({ error: 'wrong_pin' });
}

export function resetPinLockouts() {
  wrongByIp.clear();
}

advocateRouter.use(requirePin);

// ---------- queries ----------
const listDocs = db.prepare(
  "SELECT * FROM documents WHERE kind = 'deposit_notice' ORDER BY updated_at DESC, rowid DESC LIMIT 200",
);
const listNotes = db.prepare(
  "SELECT * FROM documents WHERE kind = 'advocate_note' ORDER BY created_at DESC, rowid DESC LIMIT 200",
);
const latestVersion = db.prepare(
  'SELECT * FROM versions WHERE document_id = ? ORDER BY version_no DESC LIMIT 1',
);
const insertVersion = db.prepare(
  'INSERT INTO versions (document_id, version_no, notice_text, summary_text, author) VALUES (?, ?, ?, ?, ?)',
);
const insertReview = db.prepare('INSERT INTO reviews (document_id, action, note) VALUES (?, ?, ?)');
const setStatus = db.prepare("UPDATE documents SET status = ?, updated_at = datetime('now') WHERE id = ?");

const bad = (res, error, status = 400) => res.status(status).json({ error });

// One line per document for the list.
function listItem(row) {
  const fields = JSON.parse(row.fields_json || '{}');
  const v = latestVersion.get(row.id);
  return {
    id: row.id,
    status: row.status,
    language: row.language,
    tenant: fields.tenantName?.text ?? '',
    landlord: fields.landlordName?.text ?? '',
    amount: fields.depositAmount?.amount ?? null,
    version: v?.version_no ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// If the advocate edited the text, save it as a new version written by the advocate.
function saveEdits(row, { notice, summary }) {
  const v = latestVersion.get(row.id);
  const newNotice = typeof notice === 'string' ? notice.trim() : v.notice_text;
  const newSummary = typeof summary === 'string' ? summary.trim() : v.summary_text;
  if (!newNotice || newNotice.length > 20000 || newSummary.length > 10000) return 'invalid_text';
  if (newNotice === v.notice_text && newSummary === v.summary_text) return null; // nothing changed
  insertVersion.run(row.id, v.version_no + 1, newNotice, newSummary, 'advocate');
  return null;
}

// ---------- routes ----------
advocateRouter.post('/login', (_req, res) => res.json({ ok: true, advocateName: config.advocateName }));

advocateRouter.get('/documents', (req, res) => {
  const { status } = req.query;
  const rows = listDocs.all().filter((r) => !status || r.status === status);
  res.json(rows.map(listItem));
});

advocateRouter.get('/documents/:id', (req, res) => {
  const row = getDocumentRow(req.params.id);
  if (!row || row.kind !== 'deposit_notice') return bad(res, 'not_found', 404);
  res.json({
    ...serializeDocument(row, { raw: true, versions: true }),
    fieldOrder: FIELDS.map((f) => f.id),
    advocateName: config.advocateName,
  });
});

function decide(action) {
  return (req, res) => {
    const row = getDocumentRow(req.params.id);
    if (!row || row.kind !== 'deposit_notice') return bad(res, 'not_found', 404);
    if (row.status !== 'pending_review') return bad(res, 'not_pending', 409);

    const note = String(req.body?.note ?? '').trim();
    if (action === 'request_changes' && !note) return bad(res, 'note_required');
    if (note.length > 1000) return bad(res, 'note_too_long');

    let error = null;
    db.transaction(() => {
      error = saveEdits(row, req.body ?? {});
      if (error) return;
      insertReview.run(row.id, action, note);
      setStatus.run(action === 'approve' ? 'approved' : 'changes_requested', row.id);
    })();
    if (error) return bad(res, error);
    res.json(serializeDocument(getDocumentRow(row.id), { raw: true, versions: true }));
  };
}

advocateRouter.post('/documents/:id/approve', decide('approve'));
advocateRouter.post('/documents/:id/request-changes', decide('request_changes'));

advocateRouter.get('/notes', (_req, res) => {
  res.json(
    listNotes.all().map((row) => {
      const s = JSON.parse(row.transcript || '{}');
      return { id: row.id, language: row.language, problem: s.problem ?? '', createdAt: row.created_at };
    }),
  );
});
