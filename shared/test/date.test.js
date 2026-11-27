import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, parseDuration, parsePending } from '../src/index.js';

const today = new Date(2026, 10, 27); // 27 Nov 2026 (local time)
const d = (text, opts = {}) => parseDate(text, { today, ...opts });

test('numeric dates are day-first (Indian style)', () => {
  assert.deepEqual(d('15/03/2026'), { iso: '2026-03-15', precision: 'day' });
  assert.deepEqual(d('15-3-26'), { iso: '2026-03-15', precision: 'day' });
  assert.deepEqual(d('१५/०३/२०२६'), { iso: '2026-03-15', precision: 'day' });
  assert.deepEqual(d('2026-03-15'), { iso: '2026-03-15', precision: 'day' });
});

test('month names in three languages', () => {
  assert.deepEqual(d('15 March 2026'), { iso: '2026-03-15', precision: 'day' });
  assert.deepEqual(d('15th march 2026'), { iso: '2026-03-15', precision: 'day' });
  assert.deepEqual(d('March 15, 2026'), { iso: '2026-03-15', precision: 'day' });
  assert.deepEqual(d('15 मार्च 2026'), { iso: '2026-03-15', precision: 'day' });
  assert.deepEqual(d('पंद्रह मार्च'), { iso: '2026-03-15', precision: 'day' });
  assert.deepEqual(d('पंधरा मार्च'), { iso: '2026-03-15', precision: 'day' });
  assert.deepEqual(d('5 ऑक्टोबरला'), { iso: '2026-10-05', precision: 'day' }); // Marathi case ending
  assert.deepEqual(d('10 सितंबर को'), { iso: '2026-09-10', precision: 'day' });
});

test('missing year means the most recent past date', () => {
  assert.deepEqual(d('15 March'), { iso: '2026-03-15', precision: 'day' });
  assert.deepEqual(d('15 December'), { iso: '2025-12-15', precision: 'day' }); // Dec 2026 is in the future
});

test('month only gives month precision', () => {
  assert.deepEqual(d('March 2026'), { iso: '2026-03-01', precision: 'month' });
  assert.deepEqual(d('अगस्त में'), { iso: '2026-08-01', precision: 'month' });
});

test('relative dates', () => {
  assert.deepEqual(d('do mahine pehle'), { iso: '2026-09-27', precision: 'month' });
  assert.deepEqual(d('3 महीने पहले'), { iso: '2026-08-27', precision: 'month' });
  assert.deepEqual(d('10 days ago'), { iso: '2026-11-17', precision: 'day' });
  assert.deepEqual(d('last month'), { iso: '2026-10-27', precision: 'month' });
  assert.deepEqual(d('पिछले महीने'), { iso: '2026-10-27', precision: 'month' });
  assert.deepEqual(d('yesterday'), { iso: '2026-11-26', precision: 'day' });
});

test('rejects impossible, future or unclear dates', () => {
  assert.equal(d('30/02/2026'), null);
  assert.equal(d('15/12/2026'), null); // future
  assert.equal(d('pata nahi'), null);
  assert.equal(d('I may go'), null); // "may" alone is not a month
  assert.equal(d('kai mahine pehle'), null); // "many months ago" is too vague
});

test('future dates allowed when asked', () => {
  assert.deepEqual(d('15/12/2026', { allowFuture: true }), { iso: '2026-12-15', precision: 'day' });
});

test('durations', () => {
  assert.deepEqual(parseDuration('teen mahine se'), { value: 3, unit: 'month', days: 90 });
  assert.deepEqual(parseDuration('2 months'), { value: 2, unit: 'month', days: 60 });
  assert.deepEqual(parseDuration('डेढ़ साल'), { value: 1.5, unit: 'year', days: 548 });
  assert.deepEqual(parseDuration('तीन महिन्यांपासून'), { value: 3, unit: 'month', days: 90 });
  assert.deepEqual(parseDuration('a week'), { value: 1, unit: 'week', days: 7 });
  assert.deepEqual(parseDuration('do hafte'), { value: 2, unit: 'week', days: 14 });
  assert.equal(parseDuration('kai mahine'), null);
});

test('pending: a period OR a date', () => {
  assert.deepEqual(parsePending('teen mahine se', { today }), {
    kind: 'duration', value: 3, unit: 'month', days: 90, sinceIso: '2026-08-27',
  });
  assert.deepEqual(parsePending('15 March 2026', { today }), { kind: 'date', iso: '2026-03-15', precision: 'day' });
  assert.deepEqual(parsePending('2 mahine pehle', { today }), { kind: 'date', iso: '2026-09-27', precision: 'month' });
  assert.equal(parsePending('pata nahi', { today }), null);
});
