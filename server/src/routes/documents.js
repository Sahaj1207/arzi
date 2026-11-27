// Citizen-side documents API. No login: each request carries the anonymous
// userId from the browser, and a citizen can only read their own documents.
//
//   POST /api/documents          save a finished interview → draft v1, status pending_review
//   GET  /api/documents?userId=  the citizen's documents (history)
//   GET  /api/documents/:id?userId=   one document: status, fields, latest version, advocate notes
//   POST /api/documents/:id/revise    citizen fixed details after "request changes" → next version
//   POST /api/notes              "not a deposit problem" noted for an advocate
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { FIELDS, LANGUAGES, isValidFieldValue } from '@arzi/shared';
import { db } from '../db.js';
import { config } from '../config.js';
import { draftDocument } from '../drafting/index.js';
import { withReviewLine } from '../drafting/notice.js';

export const documentsRouter = Router();
export const notesRouter = Router();

const LANG_CODES = new Set(LANGUAGES.map((l) => l.code));
const USER_ID = /^[A-Za-z0-9-]{8,64}$/;

const bad = (res, error, status = 400) => res.status(status).json({ error });

function cleanTranscript(transcript) {
  if (!Array.isArray(transcript)) return [];
  return transcript.slice(0, 200).map((e) => ({
    q: String(e?.q ?? '').slice(0, 1000),
    a: String(e?.a ?? '').slice(0, 2000),
    via: e?.via === 'keyboard' ? 'keyboard' : 'voice',
  }));
}

const ensureUser = db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)');

// ---------- queries ----------
const insertDoc = db.prepare(`
  INSERT INTO documents (id, user_id, kind, language, status, transcript, fields_json)
  VALUES (@id, @userId, @kind, @lang, @status, @transcript, @fields)`);
const insertVersion = db.prepare(`
  INSERT INTO versions (document_id, version_no, notice_text, summary_text, author)
  VALUES (?, ?, ?, ?, ?)`);
const getDoc = db.prepare('SELECT * FROM documents WHERE id = ?');
const latestVersion = db.prepare(
  'SELECT * FROM versions WHERE document_id = ? ORDER BY version_no DESC LIMIT 1',
);
const reviewsFor = db.prepare('SELECT action, note, created_at FROM reviews WHERE document_id = ? ORDER BY id');
const docsForUser = db.prepare(
  "SELECT * FROM documents WHERE user_id = ? AND kind = 'deposit_notice' ORDER BY created_at DESC, rowid DESC LIMIT 100",
);
const allVersions = db.prepare(
  'SELECT version_no, notice_text, summary_text, author, created_at FROM versions WHERE document_id = ? ORDER BY version_no',
);
const updateForRevision = db.prepare(`
  UPDATE documents SET status = 'pending_review', fields_json = ?, transcript = ?, updated_at = datetime('now')
  WHERE id = ?`);

const APPROVED = new Set(['approved', 'consented']);
const shapeVersion = (v) => ({
  no: v.version_no,
  notice: v.notice_text,
  summary: v.summary_text,
  author: v.author,
  createdAt: v.created_at,
});

// Shapes a DB row into what the browser gets (shared with the advocate API).
//   raw: true → notice exactly as stored (for the advocate's editor)
//   versions: true → include every version (history, advocate)
export function serializeDocument(row, { withVersion = true, raw = false, versions = false } = {}) {
  const stored = JSON.parse(row.transcript || '{}');
  const out = {
    id: row.id,
    kind: row.kind,
    status: row.status,
    language: row.language,
    problem: stored.problem ?? '',
    transcript: stored.entries ?? [],
    fields: JSON.parse(row.fields_json || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (withVersion) {
    const v = latestVersion.get(row.id);
    out.version = v ? shapeVersion(v) : null;
    // Only an approved notice carries "Reviewed by Advocate …".
    if (out.version && !raw && APPROVED.has(row.status)) {
      out.version.notice = withReviewLine(out.version.notice, config.advocateName);
    }
    out.reviews = reviewsFor.all(row.id).map((r) => ({ action: r.action, note: r.note, createdAt: r.created_at }));
  }
  if (versions) out.versions = allVersions.all(row.id).map(shapeVersion);
  return out;
}

export const getDocumentRow = (id) => getDoc.get(id);

// ---------- routes ----------
documentsRouter.post('/', async (req, res, next) => {
  try {
    const { userId, lang, problem = '', transcript, fields } = req.body ?? {};
    if (!USER_ID.test(userId ?? '')) return bad(res, 'invalid_user');
    if (!LANG_CODES.has(lang)) return bad(res, 'invalid_language');
    if (!fields || typeof fields !== 'object') return bad(res, 'missing_fields');
    for (const f of FIELDS) {
      if (!isValidFieldValue(f, fields[f.id])) return bad(res, `invalid_field:${f.id}`);
    }
    // Keep only known fields.
    const clean = Object.fromEntries(FIELDS.map((f) => [f.id, fields[f.id]]));

    const draft = await draftDocument({ fields: clean, lang });
    const id = randomUUID();
    db.transaction(() => {
      ensureUser.run(userId);
      insertDoc.run({
        id,
        userId,
        kind: 'deposit_notice',
        lang,
        status: 'pending_review',
        transcript: JSON.stringify({ problem: String(problem).slice(0, 4000), entries: cleanTranscript(transcript) }),
        fields: JSON.stringify(clean),
      });
      insertVersion.run(id, 1, draft.notice, draft.summary, 'system');
    })();

    res.status(201).json(serializeDocument(getDoc.get(id)));
  } catch (err) {
    next(err);
  }
});

documentsRouter.get('/', (req, res) => {
  const { userId } = req.query;
  if (!USER_ID.test(userId ?? '')) return bad(res, 'invalid_user');
  res.json(docsForUser.all(userId).map((row) => serializeDocument(row)));
});

documentsRouter.get('/:id', (req, res) => {
  const { userId } = req.query;
  const row = getDoc.get(req.params.id);
  // Same answer for "not found" and "not yours", so IDs cannot be probed.
  if (!row || row.user_id !== userId) return bad(res, 'not_found', 404);
  res.json(serializeDocument(row, { versions: true }));
});

// After the advocate asks for changes, the citizen corrects details by voice.
// The notice is redrafted from the corrected fields and becomes the next version.
documentsRouter.post('/:id/revise', async (req, res, next) => {
  try {
    const { userId, fields, transcript } = req.body ?? {};
    const row = getDoc.get(req.params.id);
    if (!row || row.user_id !== userId) return bad(res, 'not_found', 404);
    if (row.status !== 'changes_requested') return bad(res, 'not_editable', 409);
    if (!fields || typeof fields !== 'object') return bad(res, 'missing_fields');
    for (const f of FIELDS) {
      if (!isValidFieldValue(f, fields[f.id])) return bad(res, `invalid_field:${f.id}`);
    }
    const clean = Object.fromEntries(FIELDS.map((f) => [f.id, fields[f.id]]));
    const draft = await draftDocument({ fields: clean, lang: row.language });

    const stored = JSON.parse(row.transcript || '{}');
    stored.entries = [...(stored.entries ?? []), ...cleanTranscript(transcript)].slice(-400);
    const nextNo = (latestVersion.get(row.id)?.version_no ?? 0) + 1;

    db.transaction(() => {
      insertVersion.run(row.id, nextNo, draft.notice, draft.summary, 'citizen');
      updateForRevision.run(JSON.stringify(clean), JSON.stringify(stored), row.id);
    })();
    res.json(serializeDocument(getDoc.get(row.id), { versions: true }));
  } catch (err) {
    next(err);
  }
});

notesRouter.post('/', (req, res) => {
  const { userId, lang, problem = '', transcript } = req.body ?? {};
  if (!USER_ID.test(userId ?? '')) return bad(res, 'invalid_user');
  if (!LANG_CODES.has(lang)) return bad(res, 'invalid_language');
  if (!String(problem).trim()) return bad(res, 'missing_problem');
  const id = randomUUID();
  db.transaction(() => {
    ensureUser.run(userId);
    insertDoc.run({
      id,
      userId,
      kind: 'advocate_note',
      lang,
      status: 'noted',
      transcript: JSON.stringify({ problem: String(problem).slice(0, 4000), entries: cleanTranscript(transcript) }),
      fields: '{}',
    });
  })();
  res.status(201).json({ id, status: 'noted' });
});
