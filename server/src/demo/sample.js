// Demo data, because the Render free tier wipes the database on every restart.
//
//   seedDemoData()   on every startup: puts sample cases on the advocate desk
//                    (one waiting for review, one approved, one "other problem"),
//                    only if they are not there yet.
//   /api/demo/sample          "Skip to approved document": a sample notice in the
//                             visitor's own history, already approved.
//   /api/documents/:id/demo-approve   the demo advocate approves a sample case
//                             (used by "Try a sample case" after the scripted interview).
// The demo advocate itself needs no data: it is the PIN + name in config.js.
import { Router } from 'express';
import { LANGUAGES } from '@arzi/shared';
import { db } from '../db.js';
import { createDocument, serializeDocument, getDocumentRow } from '../routes/documents.js';

// The same story in each language. Dates are fixed and in the past.
const COMMON = {
  depositAmount: { amount: 25000 },
  movedOutDate: { iso: '2026-09-15', precision: 'day' },
  dueDate: { kind: 'date', iso: '2026-09-30', precision: 'day' },
};
export const SAMPLE = {
  en: {
    problem: 'I left my PG two months ago but the owner has not returned my security deposit.',
    fields: {
      tenantName: { text: 'Priya Sharma' },
      tenantAddress: { text: 'Room 12, Shanti PG, Kothrud, Pune 411038' },
      landlordName: { text: 'Rajesh Gupta' },
      landlordAddress: { text: '8 Paud Road, Kothrud, Pune 411038' },
      ...COMMON,
    },
  },
  hi: {
    problem: 'मैंने दो महीने पहले पीजी छोड़ दिया लेकिन मालिक ने मेरा सिक्योरिटी डिपॉज़िट वापस नहीं किया।',
    fields: {
      tenantName: { text: 'प्रिया शर्मा' },
      tenantAddress: { text: 'कमरा 12, शांति पीजी, कोथरूड, पुणे 411038' },
      landlordName: { text: 'राजेश गुप्ता' },
      landlordAddress: { text: '8 पौड रोड, कोथरूड, पुणे 411038' },
      ...COMMON,
    },
  },
  mr: {
    problem: 'मी दोन महिन्यांपूर्वी पीजी सोडली पण मालकाने माझी अनामत रक्कम परत दिली नाही.',
    fields: {
      tenantName: { text: 'प्रिया शर्मा' },
      tenantAddress: { text: 'खोली 12, शांती पीजी, कोथरूड, पुणे 411038' },
      landlordName: { text: 'राजेश गुप्ता' },
      landlordAddress: { text: '8 पौड रोड, कोथरूड, पुणे 411038' },
      ...COMMON,
    },
  },
};

const SEED_USER = 'sample-citizen-seed';
const DEMO_NOTE = 'Sample case: approved automatically by the demo advocate.';

const insertReview = db.prepare('INSERT INTO reviews (document_id, action, note) VALUES (?, ?, ?)');
const approve = db.prepare("UPDATE documents SET status = 'approved', updated_at = datetime('now') WHERE id = ?");
const insertNote = db.prepare(`
  INSERT INTO documents (id, user_id, kind, language, status, transcript, fields_json, is_sample)
  VALUES (?, ?, 'advocate_note', ?, 'noted', ?, '{}', 1)`);

function approveAsDemoAdvocate(id) {
  db.transaction(() => {
    insertReview.run(id, 'approve', DEMO_NOTE);
    approve.run(id);
  })();
}

export async function seedDemoData() {
  let added = 0;
  if (!getDocumentRow('sample-seed-pending-hi')) {
    await createDocument({ id: 'sample-seed-pending-hi', userId: SEED_USER, lang: 'hi', isSample: true, ...SAMPLE.hi });
    added++;
  }
  if (!getDocumentRow('sample-seed-approved-mr')) {
    await createDocument({ id: 'sample-seed-approved-mr', userId: SEED_USER, lang: 'mr', isSample: true, ...SAMPLE.mr });
    approveAsDemoAdvocate('sample-seed-approved-mr');
    added++;
  }
  if (!getDocumentRow('sample-seed-note-en')) {
    insertNote.run(
      'sample-seed-note-en',
      SEED_USER,
      'en',
      JSON.stringify({ problem: 'My employer has not paid my salary for two months.', entries: [] }),
    );
    added++;
  }
  return added;
}

// ---------- routes ----------
export const demoRouter = Router();
const USER_ID = /^[A-Za-z0-9-]{8,64}$/;
const LANG_CODES = new Set(LANGUAGES.map((l) => l.code));

// "Skip to approved document": a sample notice, already approved, in the visitor's history.
demoRouter.post('/sample', async (req, res, next) => {
  try {
    const { userId, lang } = req.body ?? {};
    if (!USER_ID.test(userId ?? '')) return res.status(400).json({ error: 'invalid_user' });
    const l = LANG_CODES.has(lang) && SAMPLE[lang] ? lang : 'en';
    const row = await createDocument({ userId, lang: l, isSample: true, ...SAMPLE[l] });
    approveAsDemoAdvocate(row.id);
    res.status(201).json(serializeDocument(getDocumentRow(row.id), { versions: true }));
  } catch (err) {
    next(err);
  }
});

// After the scripted sample interview: the demo advocate approves it (sample cases only).
export function demoApproveHandler(req, res) {
  const row = getDocumentRow(req.params.id);
  if (!row || row.user_id !== req.query.userId) return res.status(404).json({ error: 'not_found' });
  if (row.is_sample !== 1) return res.status(403).json({ error: 'not_a_sample' });
  if (row.status !== 'pending_review') return res.status(409).json({ error: 'not_pending' });
  approveAsDemoAdvocate(row.id);
  res.json(serializeDocument(getDocumentRow(row.id), { versions: true }));
}
