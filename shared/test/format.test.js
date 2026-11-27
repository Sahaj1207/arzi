import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatINR, spellDigits, speakAmount, formatDate, speakDate, formatDuration, FIELDS } from '../src/index.js';

test('Indian digit grouping', () => {
  assert.equal(formatINR(20000), '₹20,000');
  assert.equal(formatINR(150000), '₹1,50,000');
});

test('digit-by-digit read-back', () => {
  assert.equal(spellDigits(20000, 'en'), 'two zero zero zero zero');
  assert.equal(spellDigits(25000, 'hi'), 'दो पांच शून्य शून्य शून्य');
  assert.equal(spellDigits(25000, 'mr'), 'दोन पाच शून्य शून्य शून्य');
  assert.equal(speakAmount(20000, 'en'), '20,000 rupees. That is: two zero zero zero zero.');
});

test('dates shown and spoken per language', () => {
  assert.equal(formatDate('2026-03-15', 'en'), '15 March 2026');
  assert.equal(formatDate('2026-03-15', 'hi'), '15 मार्च 2026');
  assert.equal(formatDate('2026-08-01', 'mr', 'month'), 'ऑगस्ट 2026');
  assert.equal(speakDate('2026-03-15', 'en'), 'one five, March, two zero two six');
});

test('durations', () => {
  assert.equal(formatDuration({ value: 3, unit: 'month' }, 'en'), '3 months');
  assert.equal(formatDuration({ value: 1, unit: 'month' }, 'hi'), '1 महीना');
});

test('every field has a label and question in all three languages', () => {
  assert.equal(FIELDS.length, 7);
  for (const f of FIELDS) {
    for (const lang of ['en', 'hi', 'mr']) {
      assert.ok(f.label[lang], `${f.id} label ${lang}`);
      assert.ok(f.question[lang], `${f.id} question ${lang}`);
    }
  }
});
