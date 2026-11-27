// Speech-to-text fallback order Sarvam → Groq → browser, against FAKE Sarvam and
// Groq servers (no real keys, no credits; the real .env is never read).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

function fakeServer(handler) {
  const calls = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      calls.push({ path: req.url, headers: req.headers, body });
      handler(req, res, body);
    });
  });
  return { server, calls };
}
const json = (res, status, data, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(data));
};

const sarvam = fakeServer((req, res) =>
  json(res, 429, { error: { code: 'insufficient_quota_error', message: 'no credits' } }),
);
const groqState = { mode: 'ok' };
const groq = fakeServer((req, res) => {
  if (groqState.mode === '429') return json(res, 429, { error: { message: 'Rate limit reached', type: 'requests' } }, { 'retry-after': '30' });
  if (groqState.mode === '500') return json(res, 500, { error: { message: 'down' } });
  json(res, 200, { text: ' मेरा डिपॉजिट बीस हज़ार था ' });
});
await Promise.all([sarvam, groq].map((f) => new Promise((r) => f.server.listen(0, r))));
after(() => [sarvam, groq].forEach((f) => f.server.close()));

const { setupServer } = await import('./helpers.js');
const s = setupServer({
  SARVAM_API_KEY: 'sk_test_sarvam',
  SARVAM_BASE_URL: `http://127.0.0.1:${sarvam.server.address().port}`,
  GROQ_API_KEY: 'gsk_test_fake',
  GROQ_BASE_URL: `http://127.0.0.1:${groq.server.address().port}`,
  GROQ_REQUESTS_PER_MINUTE: '3',
});
const { resetGroqLimiter } = await import('../src/providers/groq.js');
const { resetSttCooldowns } = await import('../src/providers/speech.js');
const reset = () => {
  resetGroqLimiter();
  resetSttCooldowns();
  groqState.mode = 'ok';
};

const stt = (userId, consent = 'yes') =>
  fetch(`${s.base}/ai/stt?userId=${userId}&lang=hi&aiConsent=${consent}`, {
    method: 'POST',
    headers: { 'Content-Type': 'audio/webm' },
    body: Buffer.from('webm-audio'),
  });

test('config lists the speech order and both services for the consent question, never the keys', async () => {
  const cfg = await fetch(`${s.base}/config`).then((r) => r.json());
  assert.equal(cfg.speech, 'sarvam');
  assert.deepEqual(cfg.speechChain, ['sarvam', 'groq']);
  assert.deepEqual(cfg.aiProviders, ['Sarvam AI', 'Groq']);
  const raw = JSON.stringify(cfg);
  assert.ok(!raw.includes('gsk_test_fake') && !raw.includes('sk_test_sarvam'));
});

test('no consent → nothing is sent to Sarvam or Groq', async () => {
  reset();
  const before = sarvam.calls.length + groq.calls.length;
  const r = await stt('groq-user-0001', 'no');
  assert.equal(r.status, 403);
  assert.deepEqual(await r.json(), { error: 'no_consent', fallback: 'browser' });
  assert.equal(sarvam.calls.length + groq.calls.length, before);
});

test('Sarvam out of credits → the same recording goes to Groq whisper-large-v3', async () => {
  reset();
  const r = await stt('groq-user-0002');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { text: 'मेरा डिपॉजिट बीस हज़ार था', provider: 'groq' });
  const call = groq.calls.at(-1);
  assert.equal(call.path, '/openai/v1/audio/transcriptions');
  assert.equal(call.headers.authorization, 'Bearer gsk_test_fake');
  assert.match(call.body, /name="model"\r\n\r\nwhisper-large-v3\r\n/);
  assert.match(call.body, /name="language"\r\n\r\nhi\r\n/);
  assert.match(call.body, /filename="answer.webm"/);
});

test('after Sarvam runs out, it is skipped for a while (no wasted wait on every answer)', async () => {
  // no reset(): keep the Sarvam cool-down from the previous test
  resetGroqLimiter();
  const sarvamBefore = sarvam.calls.length;
  const r = await stt('groq-user-0003');
  assert.equal((await r.json()).provider, 'groq');
  assert.equal(sarvam.calls.length, sarvamBefore);
});

test('our own Groq limit (here 3/minute) stops before Groq does → browser fallback', async () => {
  reset();
  for (let i = 0; i < 3; i++) assert.equal((await stt('groq-user-0004')).status, 200);
  const groqBefore = groq.calls.length;
  const r = await stt('groq-user-0004');
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: 'quota', fallback: 'browser' });
  assert.equal(groq.calls.length, groqBefore, 'the 4th request never reaches Groq');
});

test('Groq rate limit (429 + retry-after) → browser fallback, and Groq is left alone meanwhile', async () => {
  reset();
  groqState.mode = '429';
  const r = await stt('groq-user-0005');
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: 'quota', fallback: 'browser' });
  groqState.mode = 'ok';
  const groqBefore = groq.calls.length;
  const again = await stt('groq-user-0005');
  assert.equal(again.status, 503);
  assert.equal(groq.calls.length, groqBefore, 'retry-after is respected');
});

test('Groq down (500) → browser fallback, server keeps running', async () => {
  reset();
  groqState.mode = '500';
  const r = await stt('groq-user-0006');
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: 'unavailable', fallback: 'browser' });
  assert.equal((await fetch(`${s.base}/health`)).status, 200);
});
