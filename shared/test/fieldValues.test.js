import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractName, extractAddress, parseFieldAnswer, displayFieldValue, speakFieldValue, getField } from '../src/index.js';

test('names: strips "my name is" style phrases in three languages', () => {
  assert.equal(extractName('Ramesh Kumar'), 'Ramesh Kumar');
  assert.equal(extractName('my name is ramesh kumar'), 'Ramesh Kumar');
  assert.equal(extractName('mera naam Ramesh Kumar hai'), 'Ramesh Kumar');
  assert.equal(extractName('मेरा नाम रमेश कुमार है।'), 'रमेश कुमार');
  assert.equal(extractName('माझे नाव सुनीता पाटील आहे'), 'सुनीता पाटील');
  assert.equal(extractName('मकान मालिक का नाम सुरेश शर्मा है'), 'सुरेश शर्मा');
  assert.equal(extractName("the landlord's name is Mr. Iyer"), 'Mr. Iyer');
});

test('names: rejects things that are not names', () => {
  assert.equal(extractName(''), null);
  assert.equal(extractName('20000'), null);
  assert.equal(extractName('a'), null);
});

test('addresses', () => {
  assert.equal(extractAddress('my address is 12 MG Road, Pune'), '12 MG Road, Pune');
  assert.equal(extractAddress('मेरा पता 45 शिवाजी नगर पुणे है'), '45 शिवाजी नगर पुणे');
  assert.equal(extractAddress('माझा पत्ता फ्लॅट 3, कोथरूड, पुणे'), 'फ्लॅट 3, कोथरूड, पुणे');
  assert.equal(extractAddress('room'), null);
});

test('landlord address "same" copies the tenant address', () => {
  const fields = { tenantAddress: { text: '12 MG Road, Pune' } };
  const f = getField('landlordAddress');
  assert.deepEqual(parseFieldAnswer(f, 'same', { fields }), { text: '12 MG Road, Pune', same: true });
  assert.deepEqual(parseFieldAnswer(f, 'वही', { fields }), { text: '12 MG Road, Pune', same: true });
});

test('values are parsed, displayed and spoken per type', () => {
  const today = new Date(2026, 10, 27);
  const amount = getField('depositAmount');
  const v = parseFieldAnswer(amount, 'bees hazaar');
  assert.deepEqual(v, { amount: 20000 });
  assert.equal(displayFieldValue(amount, v, 'en'), '₹20,000');
  assert.match(speakFieldValue(amount, v, 'en'), /two zero zero zero zero/);

  const moved = getField('movedOutDate');
  const d = parseFieldAnswer(moved, '15 March', { today });
  assert.equal(displayFieldValue(moved, d, 'hi'), '15 मार्च 2026');

  const due = getField('dueDate');
  const p = parseFieldAnswer(due, 'teen mahine se', { today });
  assert.equal(displayFieldValue(due, p, 'en'), '3 months (27 August 2026)');
  assert.equal(parseFieldAnswer(due, 'pata nahi', { today }), null);
});
