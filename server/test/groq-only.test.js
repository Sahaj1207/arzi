// Only GROQ_API_KEY set (no Sarvam): Groq does speech-to-text, everything else
// stays in demo mode (browser voice, built-in parsers). Fake Groq server.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const calls = [];
const groq = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    calls.push(req.url);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ text: 'twenty thousand rupees' }));
  });
});
await new Promise((r) => groq.listen(0, r));
after(() => groq.close());

const { setupServer } = await import('./helpers.js');
const s = setupServer({ GROQ_API_KEY: 'gsk_test_only', GROQ_BASE_URL: `http://127.0.0.1:${groq.address().port}` });

test('Groq-only: speech is Groq, mode stays demo, consent still names Groq', async () => {
  const cfg = await fetch(`${s.base}/config`).then((r) => r.json());
  assert.deepEqual([cfg.speech, cfg.speechChain, cfg.tts, cfg.mode, cfg.aiProviders], ['groq', ['groq'], 'browser', 'demo', ['Groq']]);
});

test('Groq-only: speech-to-text works; voice and AI understanding say "not configured" → browser', async () => {
  const r = await fetch(`${s.base}/ai/stt?userId=groq-only-0001&lang=en&aiConsent=yes`, {
    method: 'POST',
    headers: { 'Content-Type': 'audio/webm' },
    body: Buffer.from('webm-audio'),
  });
  assert.deepEqual(await r.json(), { text: 'twenty thousand rupees', provider: 'groq' });
  assert.equal(calls.length, 1);

  const tts = await fetch(`${s.base}/ai/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'groq-only-0001', lang: 'te', text: 'నమస్కారం', aiConsent: 'yes' }),
  });
  assert.equal(tts.status, 503);
  assert.deepEqual(await tts.json(), { error: 'not_configured', fallback: 'browser' });
});
