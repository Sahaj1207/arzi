// Demo data for the free hosting tier: startup seed, sample case, demo approval.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupServer } from './helpers.js';
import { FIELDS_OK } from './fixtures.js';

const s = setupServer();
const PIN = { 'X-Advocate-Pin': '1234' };
const USER = 'demo-visitor-0001';

test('startup seed puts sample cases on the advocate desk, only once', async () => {
  const { seedDemoData } = await import('../src/demo/sample.js');
  assert.equal(await seedDemoData(), 3);
  assert.equal(await seedDemoData(), 0); // already there: nothing added

  const pending = await fetch(`${s.base}/advocate/documents?status=pending_review`, { headers: PIN }).then((r) => r.json());
  assert.ok(pending.some((d) => d.id === 'sample-seed-pending-hi' && d.tenant === 'प्रिया शर्मा'));
  const approved = await fetch(`${s.base}/advocate/documents?status=approved`, { headers: PIN }).then((r) => r.json());
  assert.ok(approved.some((d) => d.id === 'sample-seed-approved-mr'));
  const notes = await fetch(`${s.base}/advocate/notes`, { headers: PIN }).then((r) => r.json());
  assert.ok(notes.some((n) => /salary/.test(n.problem)));
});

test('"Skip to an approved document" makes an approved sample in the visitor’s history', async () => {
  const doc = await fetch(`${s.base}/demo/sample`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: USER, lang: 'mr' }),
  }).then((r) => r.json());
  assert.equal(doc.status, 'approved');
  assert.equal(doc.isSample, true);
  assert.equal(doc.language, 'mr');
  assert.match(doc.version.notice, /Reviewed by Advocate/);
  const mine = await fetch(`${s.base}/documents?userId=${USER}`).then((r) => r.json());
  assert.ok(mine.some((d) => d.id === doc.id));
});

test('demo advocate approves sample cases only', async () => {
  const post = (body) =>
    fetch(`${s.base}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER, lang: 'en', fields: FIELDS_OK, ...body }),
    }).then((r) => r.json());
  const approveDemo = (id) => fetch(`${s.base}/documents/${id}/demo-approve?userId=${USER}`, { method: 'POST' });

  const real = await post({});
  assert.equal((await approveDemo(real.id)).status, 403); // a real case needs a real review

  const sample = await post({ sample: true });
  const r = await approveDemo(sample.id);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, 'approved');
  assert.equal((await approveDemo(sample.id)).status, 409);
});

test('AI consent answer is stored with the document; no AI services without keys', async () => {
  const cfg = await fetch(`${s.base}/config`).then((r) => r.json());
  assert.deepEqual(cfg.aiProviders, []);
  const res = await fetch(`${s.base}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: USER, lang: 'en', fields: FIELDS_OK, aiConsent: false }),
  });
  assert.equal(res.status, 201);
});
