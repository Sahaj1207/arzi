// Starts the real app on a free port with a throwaway data folder.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FIELDS_OK } from './fixtures.js';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arzi-test-'));
process.env.DATA_DIR = dataDir;

let server;
let base;
const USER = 'test-user-0001';

before(async () => {
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server?.close();
  const { db } = await import('../src/db.js');
  db.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const post = (url, body) =>
  fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('config never contains keys', async () => {
  const cfg = await (await fetch(`${base}/config`)).json();
  assert.equal(cfg.mode, 'demo');
  assert.equal(JSON.stringify(cfg).toLowerCase().includes('key'), false);
});

test('saving an interview creates a draft waiting for the advocate', async () => {
  const res = await post('/documents', {
    userId: USER,
    lang: 'hi',
    problem: 'मकान मालिक ने डिपॉज़िट वापस नहीं किया',
    transcript: [{ q: 'नाम?', a: 'रमेश', via: 'voice' }],
    fields: FIELDS_OK,
  });
  assert.equal(res.status, 201);
  const doc = await res.json();
  assert.equal(doc.status, 'pending_review');
  assert.equal(doc.language, 'hi');
  assert.equal(doc.version.no, 1);
  assert.match(doc.version.notice, /LEGAL NOTICE/);
  assert.match(doc.version.summary, /सुरेश शर्मा|Suresh Sharma/);
  assert.equal(doc.transcript.length, 1);

  // The citizen can read it back (this is what the status page polls).
  const again = await (await fetch(`${base}/documents/${doc.id}?userId=${USER}`)).json();
  assert.equal(again.id, doc.id);
  assert.equal(again.status, 'pending_review');

  // It appears in their history.
  const list = await (await fetch(`${base}/documents?userId=${USER}`)).json();
  assert.ok(list.some((d) => d.id === doc.id));

  // Someone else's ID cannot read it.
  const other = await fetch(`${base}/documents/${doc.id}?userId=someone-else-01`);
  assert.equal(other.status, 404);
});

test('invalid submissions are rejected, never crash', async () => {
  assert.equal((await post('/documents', { userId: 'x', lang: 'hi', fields: FIELDS_OK })).status, 400);
  assert.equal((await post('/documents', { userId: USER, lang: 'fr', fields: FIELDS_OK })).status, 400);
  const missing = { ...FIELDS_OK, depositAmount: { amount: 'lots' } };
  const res = await post('/documents', { userId: USER, lang: 'en', fields: missing });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'invalid_field:depositAmount');
  const broken = await fetch(`${base}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  assert.equal(broken.status, 400);
});

test('a non-deposit problem can be noted for an advocate', async () => {
  const res = await post('/notes', { userId: USER, lang: 'en', problem: 'My salary was not paid' });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).status, 'noted');
  // Notes do not show up as notices in history.
  const list = await (await fetch(`${base}/documents?userId=${USER}`)).json();
  assert.ok(list.every((d) => d.kind === 'deposit_notice'));
});
