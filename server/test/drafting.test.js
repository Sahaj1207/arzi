import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNotice, withReviewLine } from '../src/drafting/notice.js';
import { buildSummary } from '../src/drafting/summary.js';
import { amountInWordsEn } from '@arzi/shared';
import { FIELDS_OK } from './fixtures.js';

const today = new Date('2026-11-27T10:00:00Z');

test('amount in words, Indian system', () => {
  assert.equal(amountInWordsEn(20000), 'Twenty Thousand');
  assert.equal(amountInWordsEn(150000), 'One Lakh Fifty Thousand');
  assert.equal(amountInWordsEn(2500), 'Two Thousand Five Hundred');
  assert.equal(amountInWordsEn(12345678), 'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight');
});

test('notice follows the content rules', () => {
  const n = buildNotice(FIELDS_OK, { today });
  assert.match(n, /^LEGAL NOTICE/);
  assert.match(n, /From:\nRamesh Kumar/); // sent by the tenant in their own name
  assert.match(n, /To:\nSuresh Sharma/);
  assert.match(n, /₹1,50,000 \(Rupees One Lakh Fifty Thousand only\)/);
  assert.match(n, /within 15 \(fifteen\) days from the date of receipt/);
  assert.match(n, /reserve my right to claim interest and the costs of legal proceedings/);
  assert.match(n, /vacated the premises on 15 March 2026/);
  assert.match(n, /unpaid for about 3 months, that is, since about 27 August 2026/);
  assert.match(n, /Date: 27 November 2026/);
  // Deposit only: no interest or damages demanded now.
  assert.doesNotMatch(n, /pay me .* interest/i);
  // An unchecked draft never claims to be reviewed.
  assert.doesNotMatch(n, /Reviewed by Advocate/);
});

test('review line is added once, only on approval', () => {
  const n = withReviewLine(buildNotice(FIELDS_OK, { today }), 'R. Mehta (demo)');
  assert.match(n, /Reviewed by Advocate R\. Mehta \(demo\)$/);
  assert.equal(withReviewLine(n, 'R. Mehta (demo)'), n);
});

test('month-only and date-type due values read naturally', () => {
  const f = {
    ...FIELDS_OK,
    movedOutDate: { iso: '2026-03-01', precision: 'month' },
    dueDate: { kind: 'date', iso: '2026-04-15', precision: 'day' },
  };
  const n = buildNotice(f, { today });
  assert.match(n, /vacated the premises in March 2026/);
  assert.match(n, /was due to be refunded to me on 15 April 2026/);
});

test('summary: 5 points in the user’s language', () => {
  for (const lang of ['en', 'hi', 'mr']) {
    const lines = buildSummary(FIELDS_OK, lang).split('\n');
    assert.equal(lines.length, 5, lang);
    assert.ok(lines[0].includes('Suresh Sharma'), lang);
    assert.ok(lines[2].includes('₹1,50,000'), lang);
    assert.ok(lines[3].includes('15'), lang);
  }
  assert.match(buildSummary(FIELDS_OK, 'hi'), /15 मार्च 2026 को घर छोड़ा/);
  assert.match(buildSummary(FIELDS_OK, 'mr'), /15 मार्च 2026 रोजी घर सोडले/);
});
