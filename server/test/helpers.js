// Starts the real app on a free port with a throwaway data folder.
// Call setupServer() at the top of a test file (before any app import).
import { before, after } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FIELDS_OK } from './fixtures.js';

export function setupServer(env = {}) {
  const ctx = { base: null };
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arzi-t-'));
  Object.assign(process.env, { DATA_DIR: dataDir, ...env });
  let server;

  before(async () => {
    const { createApp } = await import('../src/app.js');
    server = createApp().listen(0);
    await new Promise((r) => server.once('listening', r));
    ctx.base = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(async () => {
    server?.close();
    const { closePdfBrowser } = await import('../src/pdf/render.js');
    await closePdfBrowser();
    const { db } = await import('../src/db.js');
    db.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // A document that the advocate has approved (and optionally consented).
  ctx.approvedDocument = async ({ userId = 'files-user-0001', lang = 'hi', fields = FIELDS_OK, consent = false } = {}) => {
    const json = { 'Content-Type': 'application/json' };
    const doc = await fetch(`${ctx.base}/documents`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ userId, lang, fields }),
    }).then((r) => r.json());
    await fetch(`${ctx.base}/advocate/documents/${doc.id}/approve`, {
      method: 'POST',
      headers: { ...json, 'X-Advocate-Pin': '1234' },
      body: '{}',
    });
    if (consent) {
      await fetch(`${ctx.base}/documents/${doc.id}/consent?userId=${userId}&method=voice&transcript=haan`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/webm' },
        body: Buffer.from('audio'),
      });
    }
    return { ...doc, userId };
  };
  return ctx;
}
