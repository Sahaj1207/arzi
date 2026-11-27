// With Chromium missing, PDF links must still work: they return the printable page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupServer } from './helpers.js';

const s = setupServer({ CHROMIUM_PATH: '/definitely/not/chromium' });

test('no Chromium → printable page that opens the print dialog, server keeps running', async () => {
  const doc = await s.approvedDocument({ lang: 'mr' });
  const res = await fetch(`${s.base}/documents/${doc.id}/pdf?userId=${doc.userId}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-arzi-fallback'), 'print');
  const html = await res.text();
  assert.match(html, /window\.print\(\)/);
  assert.match(html, /सोप्या शब्दांत \(Marathi\)/);

  const cfg = await fetch(`${s.base}/config`).then((r) => r.json());
  assert.equal(cfg.pdf, 'print');
  assert.equal((await fetch(`${s.base}/health`)).status, 200);
});
