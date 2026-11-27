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
    assert.deepEqual(r.facts, []); // demo mode: no story facts
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

// ---- AI mode: the whole story first, then only what is missing ----
const STORY_FIELDS = {
  tenantName: { text: 'Priya Sharma' },
  depositAmount: { amount: 25000 },
  landlordName: { text: 'Rajesh Gupta' },
};
const STORY_FACTS = [{ en: 'The landlord says he will deduct ₹5,000 for painting.', local: 'The landlord says he will deduct ₹5,000 for painting.' }];

test('story: the problem is heard as one long answer; demo mode asks all 7 questions', async () => {
  const io = scriptedIo('en', SAMPLE_SCRIPT.en);
  const longs = [];
  const ask = io.ask;
  io.ask = (o) => (longs.push(Boolean(o.long)), ask(o));
  await runInterview(io, { today });
  assert.equal(longs[0], true, 'the first question (describe the problem) listens long');
  assert.ok(longs.slice(1).every((x) => !x), 'other answers are short');
  assert.equal(io.asked.filter((q) => /What is your full name/.test(q)).length, 1);
});

test('story (AI): details from the story are confirmed in one summary; only missing ones are asked', async () => {
  const [problem, , ...answers] = SAMPLE_SCRIPT.en; // drop "yes" (deposit) — re-added below
  const byQuestion = {
    address: 'Room 12, Shanti PG, Kothrud, Pune 411038',
    landlordAddress: 'same',
    movedOut: '15 September 2026',
    due: '30 September 2026',
  };
  // problem → yes (deposit) → yes (story summary) → missing fields with yes after each → yes (final summary)
  const script = [problem, 'yes', 'yes', byQuestion.address, 'yes', byQuestion.landlordAddress, 'yes', byQuestion.movedOut, 'yes', byQuestion.due, 'yes', 'yes'];
  const io = scriptedIo('en', script);
  let storyText = null;
  const r = await runInterview(io, {
    today,
    aiStory: async (text) => ((storyText = text), { fields: STORY_FIELDS, facts: STORY_FACTS }),
  });
  assert.equal(io.rejected, 0);
  assert.equal(r.outcome, 'ready');
  assert.equal(storyText, problem);
  assert.ok(io.said.some((x) => /From what you told me, I noted:.*Priya Sharma.*Rajesh Gupta.*₹25,000.*I also noted: The landlord says he will deduct ₹5,000 for painting/.test(x)));
  assert.ok(io.asked.includes('Is that right? Say yes, or say what to change.'));
  // Never asked again for what the story already said:
  assert.ok(!io.asked.some((q) => /What is your full name|How much security deposit|full name of your landlord/.test(q)));
  assert.equal(r.fields.tenantName.text, 'Priya Sharma');
  assert.equal(r.fields.depositAmount.amount, 25000);
  assert.deepEqual(r.fields.movedOutDate, { iso: '2026-09-15', precision: 'day' });
  assert.deepEqual(r.facts, STORY_FACTS);
  void answers;
});

test('story (AI): "change the amount" in the story summary asks just that again', async () => {
  const all = {
    ...STORY_FIELDS,
    tenantAddress: { text: 'Room 12, Pune' },
    landlordAddress: { text: 'Room 12, Pune', same: true },
    movedOutDate: { iso: '2026-09-15', precision: 'day' },
    dueDate: { kind: 'date', iso: '2026-09-30', precision: 'day' },
  };
  const io = scriptedIo('en', [SAMPLE_SCRIPT.en[0], 'yes', 'change the amount', '20000', 'yes', 'yes']);
  const r = await runInterview(io, { today, aiStory: async () => ({ fields: all, facts: [] }) });
  assert.equal(r.outcome, 'ready');
  assert.equal(r.fields.depositAmount.amount, 20000);
  // Everything came from the story: no separate final summary.
  assert.equal(io.asked.filter((q) => /Is everything correct/.test(q)).length, 0);
});

test('story (AI) found nothing usable → the normal questions, nothing lost', async () => {
  const io = scriptedIo('en', SAMPLE_SCRIPT.en);
  const r = await runInterview(io, { today, aiStory: async () => null });
  assert.equal(r.outcome, 'ready');
  assert.equal(io.rejected, 0);
});
