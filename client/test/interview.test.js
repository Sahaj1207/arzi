import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInterview } from '../src/conversation/interview.js';

const today = new Date(2026, 10, 27);

// A fake user: answers come from a script, in order. Records what Arzi said.
function fakeIo(answers, lang = 'en') {
  const queue = [...answers];
  const io = {
    lang,
    said: [],
    asked: [],
    updates: [],
    getLang: () => io.lang,
    setLang: (l) => (io.lang = l),
    say: async (text) => io.said.push(text),
    update: (patch) => io.updates.push(patch),
    ask: async ({ prompt, parse, keyboard }) => {
      io.asked.push({ prompt, keyboard });
      // Like the real UI: keep "asking" until the parse succeeds.
      for (;;) {
        if (queue.length === 0) return { status: 'aborted' };
        const text = queue.shift();
        const value = parse(text);
        if (value !== null) return { status: 'answer', text, value, via: keyboard ? 'keyboard' : 'voice' };
      }
    },
  };
  return io;
}

const HAPPY_EN = [
  'My landlord has not returned my security deposit',
  'yes',
  'my name is Ramesh Kumar', 'yes',
  '12 MG Road, Kothrud, Pune', 'yes',
  'Suresh Sharma', 'yes',
  'same', 'yes',
  'twenty thousand', 'yes',
  '15 March 2026', 'yes',
  'three months', 'yes',
  'yes', // everything correct
];

test('happy path in English collects all 7 fields', async () => {
  const io = fakeIo(HAPPY_EN);
  const r = await runInterview(io, { today });
  assert.equal(r.outcome, 'ready');
  assert.equal(r.lang, 'en');
  assert.deepEqual(r.fields.tenantName, { text: 'Ramesh Kumar' });
  assert.deepEqual(r.fields.landlordAddress, { text: '12 MG Road, Kothrud, Pune', same: true });
  assert.deepEqual(r.fields.depositAmount, { amount: 20000 });
  assert.deepEqual(r.fields.movedOutDate, { iso: '2026-03-15', precision: 'day' });
  assert.equal(r.fields.dueDate.kind, 'duration');
  assert.equal(r.transcript[0].a, HAPPY_EN[0]);
  // The amount was read back digit by digit.
  assert.ok(io.asked.some((a) => /two zero zero zero zero/.test(a.prompt)));
});

test('happy path in Hindi', async () => {
  const io = fakeIo(
    [
      'मकान मालिक ने मेरा डिपॉज़िट वापस नहीं किया', 'हाँ',
      'मेरा नाम रमेश कुमार है', 'हाँ',
      '45 शिवाजी नगर पुणे', 'हाँ',
      'सुरेश शर्मा', 'हाँ',
      'वही', 'हाँ',
      'बीस हज़ार', 'हाँ',
      '15 मार्च', 'हाँ',
      'तीन महीने से', 'हाँ',
      'हाँ सब सही है',
    ],
    'hi',
  );
  const r = await runInterview(io, { today });
  assert.equal(r.outcome, 'ready');
  assert.equal(r.fields.tenantName.text, 'रमेश कुमार');
  assert.equal(r.fields.depositAmount.amount, 20000);
  assert.match(io.asked[1].prompt, /डिपॉज़िट वापस नहीं किया/);
});

test('"no" to a read-back asks again; after 2 no’s it asks to type', async () => {
  const answers = [...HAPPY_EN];
  // amount: misheard twice, then typed
  const i = answers.indexOf('twenty thousand');
  answers.splice(i, 2, 'twenty thousand', 'no', 'thirty thousand', 'no', '25000', 'yes');
  const io = fakeIo(answers);
  const r = await runInterview(io, { today });
  assert.equal(r.fields.depositAmount.amount, 25000);
  const amountAsks = io.asked.filter((a) => /How much security deposit/.test(a.prompt));
  assert.equal(amountAsks.length, 3);
  assert.match(amountAsks[1].prompt, /^Okay, please say it again/);
  assert.equal(amountAsks[2].keyboard, true);
  assert.match(amountAsks[2].prompt, /^Please type it/);
});

test('correct one field from the summary by voice', async () => {
  const answers = [...HAPPY_EN];
  answers.splice(answers.length - 1, 1, 'no, change the amount', '25000', 'yes', 'yes');
  const r = await runInterview(fakeIo(answers), { today });
  assert.equal(r.outcome, 'ready');
  assert.equal(r.fields.depositAmount.amount, 25000);
  assert.equal(r.fields.tenantName.text, 'Ramesh Kumar'); // others unchanged
});

test('"no" in the summary without a field asks which one', async () => {
  const answers = [...HAPPY_EN];
  answers.splice(answers.length - 1, 1, 'no', 'landlord name', 'Mahesh Sharma', 'yes', 'yes');
  const io = fakeIo(answers);
  const r = await runInterview(io, { today });
  assert.equal(r.fields.landlordName.text, 'Mahesh Sharma');
  assert.ok(io.asked.some((a) => /Which detail should I change/.test(a.prompt)));
});

test('emergency words stop the interview at any point', async () => {
  const answers = HAPPY_EN.slice(0, 4).concat(['he hit me when I asked']);
  const io = fakeIo(answers);
  const r = await runInterview(io, { today });
  assert.equal(r.outcome, 'emergency');
  assert.ok(io.updates.some((u) => u.emergency));
  assert.match(io.said.at(-1), /112/);
});

test('emergency in the first description', async () => {
  const r = await runInterview(fakeIo(['मालिक ने मुझे मारा']), { today });
  assert.equal(r.outcome, 'emergency');
});

test('not a deposit problem: offers to note it for an advocate', async () => {
  const io = fakeIo(['My employer has not paid my salary', 'yes']);
  const r = await runInterview(io, { today });
  assert.equal(r.outcome, 'other');
  assert.equal(r.noted, true);
  assert.match(io.said[0], /only make a legal notice for a security deposit/);
});

test('"no" to the deposit confirmation lets the user describe again', async () => {
  const answers = ['my deposit', 'no', 'landlord kept my security deposit', 'yes', ...HAPPY_EN.slice(2)];
  const r = await runInterview(fakeIo(answers), { today });
  assert.equal(r.outcome, 'ready');
  assert.match(r.problem, /kept my security deposit/);
});

test('"Speak in Marathi" switches language and repeats the question', async () => {
  const answers = [...HAPPY_EN];
  answers.splice(2, 0, 'Speak in Marathi');
  answers[answers.indexOf('my name is Ramesh Kumar')] = 'माझे नाव रमेश कुमार आहे';
  const io = fakeIo(answers);
  const r = await runInterview(io, { today });
  assert.equal(r.lang, 'mr');
  assert.equal(r.fields.tenantName.text, 'रमेश कुमार');
  assert.ok(io.said.includes('ठीक आहे, आता मी मराठीत बोलते.'));
  assert.ok(io.asked.some((a) => a.prompt === 'तुमचे पूर्ण नाव काय आहे?'));
});

test('unparseable answers are retried, never guessed', async () => {
  const answers = [...HAPPY_EN];
  const i = answers.indexOf('twenty thousand');
  answers.splice(i, 0, 'pata nahi', 'kuch kuch');
  const r = await runInterview(fakeIo(answers), { today });
  assert.equal(r.fields.depositAmount.amount, 20000);
});
