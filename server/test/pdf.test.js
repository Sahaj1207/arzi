// PDF, printable page and WhatsApp share links.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupServer } from './helpers.js';
import { findChromium } from '../src/pdf/render.js';
import { documentHtml } from '../src/pdf/noticeHtml.js';

const s = setupServer();

test('the document page has the notice, the summary in Hindi and the consent', async () => {
  const doc = await s.approvedDocument({ consent: true });
  const full = await fetch(`${s.base}/documents/${doc.id}?userId=${doc.userId}`).then((r) => r.json());
  const html = documentHtml(full);
  assert.match(html, /<h1>LEGAL NOTICE<\/h1>/);
  assert.match(html, /Reviewed by Advocate R\. Mehta \(demo\)/);
  assert.match(html, /आसान शब्दों में \(Hindi\)/);
  assert.match(html, /Consent given by voice on .* IST\. Words heard: “haan”/);
  assert.match(html, /@font-face\{font-family:'Noto Sans Devanagari'/); // bundled font embedded
  assert.doesNotMatch(html, /window\.print/);
  assert.match(documentHtml(full, { print: true }), /window\.print\(\)/);
});

test('owner downloads the PDF (or the printable page if Chromium is missing)', async () => {
  const doc = await s.approvedDocument();
  const res = await fetch(`${s.base}/documents/${doc.id}/pdf?userId=${doc.userId}`);
  assert.equal(res.status, 200);
  if (findChromium()) {
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.ok(bytes.includes('NotoSansDevanagari'), 'Devanagari font embedded in the PDF');
  } else {
    assert.equal(res.headers.get('x-arzi-fallback'), 'print');
  }
});

test('PDF only for approved documents, only for the owner', async () => {
  const pending = await fetch(`${s.base}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'files-user-0001', lang: 'en', fields: (await import('./fixtures.js')).FIELDS_OK }),
  }).then((r) => r.json());
  assert.equal((await fetch(`${s.base}/documents/${pending.id}/pdf?userId=files-user-0001`)).status, 409);
  const doc = await s.approvedDocument();
  assert.equal((await fetch(`${s.base}/documents/${doc.id}/pdf?userId=someone-else-1`)).status, 404);
});

test('share link works without the private user ID and stays the same', async () => {
  const doc = await s.approvedDocument();
  const share = (userId) =>
    fetch(`${s.base}/documents/${doc.id}/share?userId=${userId}`, { method: 'POST' }).then((r) => r.json());
  const a = await share(doc.userId);
  const b = await share(doc.userId);
  assert.match(a.path, /^\/api\/shared\/[A-Za-z0-9_-]{24}$/);
  assert.equal(a.path, b.path);
  assert.ok(!a.path.includes(doc.userId));
  assert.equal((await share('someone-else-1')).error, 'not_found');

  const res = await fetch(s.base.replace('/api', '') + a.path);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/pdf|text\/html/);
  assert.equal((await fetch(`${s.base}/shared/not-a-real-token-123456789`)).status, 404);
});
