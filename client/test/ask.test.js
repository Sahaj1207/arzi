import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ask } from '../src/voice/ask.js';
import { parseAmount } from '@arzi/shared';

// A fake speech provider that returns scripted results, and a speak() that records what Arzi said.
function setup(results) {
  const queue = [...results];
  const spoken = [];
  const states = [];
  return {
    spoken,
    states,
    opts: {
      prompt: 'How much deposit?',
      lang: 'en',
      provider: { listen: async () => queue.shift() ?? { status: 'silence', text: '' } },
      speak: async (text) => spoken.push(text),
      onState: (s) => states.push(s.phase),
    },
  };
}

test('a clear answer is returned with its parsed value', async () => {
  const { opts, spoken } = setup([{ status: 'ok', text: 'bees hazaar' }]);
  const r = await ask({ ...opts, parse: (x) => parseAmount(x)?.value ?? null });
  assert.deepEqual(r, { status: 'answer', text: 'bees hazaar', value: 20000 });
  assert.deepEqual(spoken, ['How much deposit?']);
});

test('noise once, then a clear answer: asks again with the noise message', async () => {
  const { opts, spoken } = setup([{ status: 'unclear', text: 'a' }, { status: 'ok', text: '20000' }]);
  const r = await ask(opts);
  assert.equal(r.status, 'answer');
  assert.match(spoken[1], /could not hear you clearly.*How much deposit\?/);
});

test('two failed attempts → keyboard fallback', async () => {
  const { opts } = setup([{ status: 'unclear', text: '' }, { status: 'unclear', text: '' }]);
  const r = await ask(opts);
  assert.deepEqual(r, { status: 'keyboard', reason: 'couldNotHear' });
});

test('heard but not understood counts as a failed attempt (never guess)', async () => {
  const { opts, spoken } = setup([
    { status: 'ok', text: 'pata nahi' },
    { status: 'ok', text: 'kuch bhi' },
  ]);
  const r = await ask({ ...opts, parse: (x) => parseAmount(x)?.value ?? null });
  assert.equal(r.status, 'keyboard');
  assert.match(spoken[1], /did not understand/);
});

test('silence: repeat the question once, then pause', async () => {
  const { opts, spoken } = setup([{ status: 'silence' }, { status: 'silence' }]);
  const r = await ask(opts);
  assert.deepEqual(r, { status: 'paused' });
  assert.equal(spoken.length, 2);
  assert.match(spoken[1], /did not hear anything.*How much deposit\?/);
});

test('silence once, then an answer, still works', async () => {
  const { opts } = setup([{ status: 'silence' }, { status: 'ok', text: 'yes' }]);
  assert.equal((await ask(opts)).status, 'answer');
});

test('mic blocked or no internet → keyboard immediately', async () => {
  for (const [status, reason] of [['denied', 'micDenied'], ['network', 'speechNetwork'], ['unsupported', 'langUnsupported']]) {
    const { opts } = setup([{ status }]);
    assert.deepEqual(await ask(opts), { status: 'keyboard', reason });
  }
});

test('replies in the chosen language', async () => {
  const { opts, spoken } = setup([{ status: 'silence' }, { status: 'ok', text: 'हाँ' }]);
  await ask({ ...opts, lang: 'hi', prompt: 'कितना डिपॉज़िट?' });
  assert.match(spoken[1], /मुझे कुछ सुनाई नहीं दिया/);
});

test('cancelling stops the loop', async () => {
  const ac = new AbortController();
  ac.abort();
  const { opts } = setup([{ status: 'ok', text: 'x' }]);
  assert.deepEqual(await ask({ ...opts, signal: ac.signal }), { status: 'aborted' });
});
