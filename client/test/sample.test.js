import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInterview } from '../src/conversation/interview.js';
import { SAMPLE_SCRIPT } from '../src/demo/sampleScript.js';
import { createScriptedProvider } from '../src/demo/scriptedProvider.js';

const today = new Date(2026, 10, 27);

// Drives the interview the way the UI does for the sample case: every answer
// comes from the scripted provider and must parse on the first try.
function scriptedIo(lang, answers) {
  const provider = createScriptedProvider(answers, { wordMs: 0, thinkMs: 0 });
  const io = {
    lang,
    said: [],
    asked: [],
    rejected: 0,
    getLang: () => io.lang,
    setLang: (l) => (io.lang = l),
    say: async (t) => io.said.push(t),
    update: () => {},
    ask: async ({ prompt, parse }) => {
      io.asked.push(prompt);
      const heard = await provider.listen({});
      if (heard.status !== 'ok') return { status: 'aborted' };
      const value = await parse(heard.text);
      if (value === null) {
        io.rejected++;
        return { status: 'aborted' };
      }
      return { status: 'answer', text: heard.text, value };
    },
  };
  return io;
}

for (const lang of ['en', 'hi', 'mr', 'te']) {
  test(`sample case script completes the whole interview in ${lang}`, async () => {
    const io = scriptedIo(lang, SAMPLE_SCRIPT[lang]);
    const r = await runInterview(io, { today });
    assert.equal(io.rejected, 0, 'every scripted answer is understood first time');
    assert.equal(r.outcome, 'ready');
    assert.equal(r.fields.depositAmount.amount, 25000);
    assert.deepEqual(r.fields.movedOutDate, { iso: '2026-09-15', precision: 'day' });
    assert.deepEqual(r.fields.dueDate, { kind: 'date', iso: '2026-09-30', precision: 'day' });
    assert.ok(/Priya Sharma|प्रिया शर्मा|ప్రియా శర్మ/.test(r.fields.tenantName.text));
    assert.ok(/Rajesh Gupta|राजेश गुप्ता|రాజేష్ గుప్తా/.test(r.fields.landlordName.text));
    assert.equal(r.aiConsent, null); // never asked in the sample
  });
}

test('scripted provider shows words one by one and can be cancelled', async () => {
  const p = createScriptedProvider(['one two three'], { wordMs: 1, thinkMs: 1 });
  const seen = [];
  const r = await p.listen({ onInterim: (x) => seen.push(x) });
  assert.deepEqual(seen, ['one', 'one two', 'one two three']);
  assert.deepEqual(r, { status: 'ok', text: 'one two three', confidence: 1 });

  const ac = new AbortController();
  const p2 = createScriptedProvider(['never heard'], { wordMs: 50, thinkMs: 50 });
  const pending = p2.listen({ signal: ac.signal });
  ac.abort();
  assert.equal((await pending).status, 'aborted');
});

test('AI consent: asked first when an AI service is configured; "no" is respected', async () => {
  const answers = ['no', ...SAMPLE_SCRIPT.en];
  const io = scriptedIo('en', answers);
  let stored = null;
  io.onAiConsent = (v) => (stored = v);
  const r = await runInterview(io, { today, askAiConsent: true, aiProviders: 'Sarvam AI' });
  assert.match(io.asked[0], /send your voice and words to Sarvam AI/);
  assert.equal(r.aiConsent, false);
  assert.equal(stored, false);
  assert.ok(io.said.includes('Okay. I will not use any outside AI service.'));
  assert.equal(r.outcome, 'ready');
});

test('AI consent: "yes" is recorded; not asked when no AI service', async () => {
  const io = scriptedIo('hi', ['हाँ', ...SAMPLE_SCRIPT.hi]);
  const r = await runInterview(io, { today, askAiConsent: true, aiProviders: 'Sarvam AI' });
  assert.equal(r.aiConsent, true);
  const plain = scriptedIo('hi', SAMPLE_SCRIPT.hi);
  await runInterview(plain, { today });
  assert.doesNotMatch(plain.asked[0], /AI/);
});
