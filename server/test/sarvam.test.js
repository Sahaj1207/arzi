// AI mode against a FAKE Sarvam server (no real key, no credits used):
// consent gate, speech in/out, LLM extraction, transliteration in the notice,
// and every failure turning into "fall back to the browser".
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { FIELDS_OK } from './fixtures.js';

// ---- fake Sarvam ----
const fake = { quota: false, calls: [] };
const sarvamServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    fake.calls.push({ path: req.url, key: req.headers['api-subscription-key'], body });
    const send = (status, json) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(json));
    };
    if (fake.quota) return send(429, { error: { code: 'insufficient_quota_error', message: 'no credits' } });
    if (req.url === '/speech-to-text') return send(200, { transcript: 'बीस हज़ार रुपये', language_code: 'hi-IN' });
    if (req.url === '/text-to-speech') return send(200, { audios: [Buffer.from('RIFFfakewav').toString('base64')] });
    if (req.url === '/transliterate') {
      const { input } = JSON.parse(body);
      const map = { 'प्रिया शर्मा': 'priya sharma', 'राजेश गुप्ता': 'rajesh gupta' };
      return send(200, { transliterated_text: map[input] ?? 'kamra 12, pune', source_language_code: 'hi-IN' });
    }
    if (req.url === '/v1/chat/completions') {
      const ask = JSON.parse(body).messages.at(-1).content;
      const system = JSON.parse(body).messages[0].content;
      if (/story of an Indian tenant/.test(system)) {
        // One good name, one amount as words-turned-number, one FUTURE date (must be dropped),
        // one garbage field, two facts (one too short to keep).
        const story = {
          fields: {
            tenantName: { text: 'प्रिया शर्मा' },
            depositAmount: { amount: '18500' },
            movedOutDate: { iso: '2099-01-01', precision: 'day' },
            landlordName: { text: '' },
            landlordAddress: { text: 'same' }, // a placeholder, not an address → must be asked
            dueDate: { kind: 'duration', value: 2, unit: 'month' },
          },
          facts: [
            { en: 'The owner says he will cut ₹3,000 for cleaning.', local: 'मालिक कहते हैं सफ़ाई के ₹3,000 काटेंगे।' },
            { en: 'ok', local: 'ok' },
          ],
        };
        return send(200, { choices: [{ message: { role: 'assistant', content: '```json\n' + JSON.stringify(story) + '\n```' } }] });
      }
      const content = /Classify/.test(system)
        ? '{"intent": "deposit"}'
        : /ek lakh se thoda kam/.test(ask)
          ? 'Sure! ```json\n{"value": null}\n```'
          : '```json\n{"amount": 18500}\n```';
      return send(200, { choices: [{ message: { role: 'assistant', content } }] });
    }
    send(404, { error: { code: 'not_found_error' } });
  });
});
await new Promise((r) => sarvamServer.listen(0, r));

const { setupServer } = await import('./helpers.js');
const s = setupServer({
  SARVAM_API_KEY: 'sk_test_fake',
  SARVAM_BASE_URL: `http://127.0.0.1:${sarvamServer.address().port}`,
  PAID_CALLS_PER_USER_PER_DAY: '8',
});
after(() => sarvamServer.close());
before(() => (fake.quota = false));

const post = (path, body, headers = { 'Content-Type': 'application/json' }) =>
  fetch(s.base + path, { method: 'POST', headers, body: typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body) });
const U = (n) => `ai-user-000${n}`;

test('config says AI mode with Sarvam (names only, never the key)', async () => {
  const cfg = await fetch(`${s.base}/config`).then((r) => r.json());
  assert.deepEqual([cfg.speech, cfg.tts, cfg.mode, cfg.aiProviders], ['sarvam', 'sarvam', 'ai', ['Sarvam AI']]);
  assert.ok(!JSON.stringify(cfg).includes('sk_test_fake'));
});

test('nothing is sent to Sarvam without the citizen’s consent', async () => {
  const before = fake.calls.length;
  const r = await post('/ai/tts', { userId: U(1), lang: 'hi', text: 'नमस्ते' });
  assert.equal(r.status, 403);
  assert.deepEqual(await r.json(), { error: 'no_consent', fallback: 'browser' });
  assert.equal(fake.calls.length, before);
});

test('speech-to-text and text-to-speech go through Sarvam with the key on the server', async () => {
  const stt = await post(`/ai/stt?userId=${U(2)}&lang=hi&aiConsent=yes`, Buffer.from('webm-audio'), { 'Content-Type': 'audio/webm' });
  assert.equal(stt.status, 200);
  assert.equal((await stt.json()).text, 'बीस हज़ार रुपये');
  const sttCall = fake.calls.find((c) => c.path === '/speech-to-text');
  assert.equal(sttCall.key, 'sk_test_fake');
  assert.match(sttCall.body, /saaras:v4/);
  assert.match(sttCall.body, /hi-IN/);

  const tts = await post('/ai/tts', { userId: U(2), lang: 'te', text: 'నమస్కారం', aiConsent: 'yes' });
  assert.equal(tts.status, 200);
  const data = await tts.json();
  assert.equal(data.format, 'wav');
  assert.equal(Buffer.from(data.audios[0], 'base64').toString(), 'RIFFfakewav');
  assert.match(fake.calls.find((c) => c.path === '/text-to-speech').body, /"language_code":"te-IN".*"model":"bulbul:v3"/);
});

test('LLM extraction: a valid value, or null (never a guess)', async () => {
  const ok = await post('/ai/extract', { userId: U(3), lang: 'hi', field: 'depositAmount', text: 'saadhe atharah hazaar', aiConsent: 'yes' });
  assert.deepEqual(await ok.json(), { value: { amount: 18500 } });
  const unsure = await post('/ai/extract', { userId: U(3), lang: 'hi', field: 'depositAmount', text: 'ek lakh se thoda kam', aiConsent: 'yes' });
  assert.deepEqual(await unsure.json(), { value: null });
  const intent = await post('/ai/intent', { userId: U(3), lang: 'en', text: 'owner kept my advance', aiConsent: 'yes' });
  assert.deepEqual(await intent.json(), { intent: 'deposit' });
});

test('out of Sarvam credits → error with fallback to browser, server keeps running', async () => {
  fake.quota = true;
  const r = await post('/ai/tts', { userId: U(4), lang: 'hi', text: 'नमस्ते', aiConsent: 'yes' });
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: 'quota', fallback: 'browser' });
  fake.quota = false;
  assert.equal((await fetch(`${s.base}/health`)).status, 200);
});

test('daily per-user cap on paid calls', async () => {
  let last;
  for (let i = 0; i < 9; i++) last = await post('/ai/tts', { userId: U(5), lang: 'hi', text: 'नमस्ते', aiConsent: 'yes' });
  assert.equal(last.status, 429);
  assert.deepEqual(await last.json(), { error: 'limit', fallback: 'browser' });
});

test('with consent, names and addresses are transliterated for the English notice; summary keeps the script', async () => {
  const fields = {
    ...FIELDS_OK,
    tenantName: { text: 'प्रिया शर्मा' },
    landlordName: { text: 'राजेश गुप्ता' },
    tenantAddress: { text: 'कमरा 12, पुणे' },
    landlordAddress: { text: 'कमरा 12, पुणे', same: true },
  };
  const doc = await post('/documents', { userId: U(6), lang: 'hi', fields, aiConsent: true }).then((r) => r.json());
  assert.match(doc.version.notice, /From:\nPriya Sharma\nKamra 12, Pune/);
  assert.match(doc.version.notice, /To:\nRajesh Gupta/);
  assert.match(doc.version.summary, /प्रिया शर्मा/);

  // Without consent: no Sarvam call, original script in the notice.
  const plain = await post('/documents', { userId: U(7), lang: 'hi', fields, aiConsent: false }).then((r) => r.json());
  assert.match(plain.version.notice, /From:\nप्रिया शर्मा/);
});

test('story (AI): every clear detail + extra facts from the whole story; bad values dropped', async () => {
  const r = await post('/ai/story', { userId: U(8), lang: 'hi', text: 'मेरा नाम प्रिया शर्मा है, साढ़े अठारह हज़ार डिपॉज़िट था…', aiConsent: 'yes' });
  assert.equal(r.status, 200);
  const { fields, facts } = await r.json();
  assert.deepEqual(Object.keys(fields).sort(), ['depositAmount', 'dueDate', 'tenantName']);
  assert.deepEqual(fields.depositAmount, { amount: 18500 });
  assert.equal(fields.dueDate.kind, 'duration');
  assert.equal(fields.dueDate.days, 60);
  assert.deepEqual(facts, [{ en: 'The owner says he will cut ₹3,000 for cleaning.', local: 'मालिक कहते हैं सफ़ाई के ₹3,000 काटेंगे।' }]);

  const denied = await post('/ai/story', { userId: U(8), lang: 'hi', text: 'x', aiConsent: 'no' });
  assert.equal(denied.status, 403);
});

test('story facts reach the notice with consent, survive a redraft, and are ignored without consent', async () => {
  const facts = [{ en: 'The owner says he will cut ₹3,000 for cleaning.', local: 'मालिक कहते हैं सफ़ाई के ₹3,000 काटेंगे।' }];
  const doc = await post('/documents', { userId: U(9), lang: 'hi', fields: FIELDS_OK, facts, aiConsent: true }).then((x) => x.json());
  assert.match(doc.version.notice, /4\. I further state that: The owner says he will cut ₹3,000 for cleaning\./);
  assert.match(doc.version.summary, /सफ़ाई के ₹3,000/);

  // Advocate asks for changes → citizen fixes the amount → version 2 keeps the facts.
  const pin = { 'Content-Type': 'application/json', 'X-Advocate-Pin': '1234' };
  await fetch(`${s.base}/advocate/documents/${doc.id}/request-changes`, { method: 'POST', headers: pin, body: JSON.stringify({ note: 'Check the amount' }) });
  const v2 = await post(`/documents/${doc.id}/revise`, { userId: U(9), fields: { ...FIELDS_OK, depositAmount: { amount: 20000 } } }).then((x) => x.json());
  assert.equal(v2.version.no, 2);
  assert.match(v2.version.notice, /I further state that: The owner says he will cut ₹3,000/);

  const plain = await post('/documents', { userId: U(10), lang: 'hi', fields: FIELDS_OK, facts, aiConsent: false }).then((x) => x.json());
  assert.doesNotMatch(plain.version.notice, /further state/);
});
