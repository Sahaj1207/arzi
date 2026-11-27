// Advocate review loop: PIN, approve, request changes, citizen revision → version 2.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FIELDS_OK } from './fixtures.js';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arzi-adv-'));
process.env.DATA_DIR = dataDir;
delete process.env.ADVOCATE_PIN; // the built-in default must work

let server;
let base;
let resetPinLockouts;
const USER = 'citizen-adv-0001';
const PIN = { 'X-Advocate-Pin': '1234' };

before(async () => {
  const { createApp } = await import('../src/app.js');
  ({ resetPinLockouts } = await import('../src/routes/advocate.js'));
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
beforeEach(() => resetPinLockouts());
after(async () => {
  server?.close();
  const { db } = await import('../src/db.js');
  db.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const req = (method, url, body, headers = {}) =>
  fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
const json = async (p) => (await p).json();

async function newDocument(lang = 'en') {
  return json(req('POST', '/documents', { userId: USER, lang, problem: 'deposit not returned', fields: FIELDS_OK }));
}

test('the advocate API needs the PIN (default 1234)', async () => {
  assert.equal((await req('GET', '/advocate/documents')).status, 401);
  assert.equal((await req('GET', '/advocate/documents', null, { 'X-Advocate-Pin': '0000' })).status, 401);
  assert.equal((await req('POST', '/advocate/login', null, PIN)).status, 200);
});

test('wrong PINs are rate-limited', async () => {
  for (let i = 0; i < 10; i++) await req('POST', '/advocate/login', null, { 'X-Advocate-Pin': String(i) });
  assert.equal((await req('POST', '/advocate/login', null, PIN)).status, 429);
});

test('approve without edits: status approved, review line only for approved', async () => {
  const doc = await newDocument();
  assert.doesNotMatch(doc.version.notice, /Reviewed by Advocate/);

  const list = await json(req('GET', '/advocate/documents?status=pending_review', null, PIN));
  assert.ok(list.some((d) => d.id === doc.id && d.tenant === 'Ramesh Kumar' && d.amount === 150000));

  const detail = await json(req('GET', `/advocate/documents/${doc.id}`, null, PIN));
  assert.equal(detail.problem, 'deposit not returned');
  assert.equal(detail.versions.length, 1);

  const approved = await json(req('POST', `/advocate/documents/${doc.id}/approve`, {}, PIN));
  assert.equal(approved.status, 'approved');
  assert.equal(approved.versions.length, 1); // no edits → no new version

  const citizen = await json(req('GET', `/documents/${doc.id}?userId=${USER}`));
  assert.equal(citizen.status, 'approved');
  assert.match(citizen.version.notice, /Reviewed by Advocate R\. Mehta \(demo\)$/);

  // Cannot decide twice.
  assert.equal((await req('POST', `/advocate/documents/${doc.id}/approve`, {}, PIN)).status, 409);
});

test('approve with an edit saves an advocate version', async () => {
  const doc = await newDocument();
  const edited = doc.version.notice.replace('Sir/Madam,', 'Dear Sir,');
  const r = await json(req('POST', `/advocate/documents/${doc.id}/approve`, { notice: edited }, PIN));
  assert.equal(r.versions.length, 2);
  assert.equal(r.versions[1].author, 'advocate');
  assert.match(r.version.notice, /Dear Sir,/);
});

test('request changes needs a note; the citizen fixes details → version 2 back to the advocate', async () => {
  const doc = await newDocument('hi');
  assert.equal((await req('POST', `/advocate/documents/${doc.id}/request-changes`, { note: ' ' }, PIN)).status, 400);

  const r = await json(
    req('POST', `/advocate/documents/${doc.id}/request-changes`, { note: 'Please confirm the deposit amount.' }, PIN),
  );
  assert.equal(r.status, 'changes_requested');

  const seen = await json(req('GET', `/documents/${doc.id}?userId=${USER}`));
  assert.equal(seen.reviews.at(-1).note, 'Please confirm the deposit amount.');

  // Someone else cannot revise it.
  const fixedFields = { ...FIELDS_OK, depositAmount: { amount: 120000 } };
  assert.equal((await req('POST', `/documents/${doc.id}/revise`, { userId: 'intruder-000001', fields: fixedFields })).status, 404);

  const revised = await json(
    req('POST', `/documents/${doc.id}/revise`, {
      userId: USER,
      fields: fixedFields,
      transcript: [{ q: 'कौन सी जानकारी?', a: 'रकम बदलो', via: 'voice' }],
    }),
  );
  assert.equal(revised.status, 'pending_review');
  assert.equal(revised.version.no, 2);
  assert.equal(revised.version.author, 'citizen');
  assert.match(revised.version.notice, /₹1,20,000 \(Rupees One Lakh Twenty Thousand only\)/);
  assert.equal(revised.versions.length, 2);
  assert.equal(revised.transcript.at(-1).a, 'रकम बदलो');

  // Revising is only possible while changes are requested.
  assert.equal((await req('POST', `/documents/${doc.id}/revise`, { userId: USER, fields: fixedFields })).status, 409);
});

test('notes for non-deposit problems are listed for the advocate', async () => {
  await req('POST', '/notes', { userId: USER, lang: 'mr', problem: 'पगार मिळाला नाही' });
  const notes = await json(req('GET', '/advocate/notes', null, PIN));
  assert.ok(notes.some((n) => n.problem === 'पगार मिळाला नाही' && n.language === 'mr'));
});
