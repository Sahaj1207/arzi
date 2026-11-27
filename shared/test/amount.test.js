import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, extractNumbers } from '../src/index.js';

const amount = (text) => parseAmount(text)?.value ?? null;

test('digits in the forms speech engines produce', () => {
  assert.equal(amount('20000'), 20000);
  assert.equal(amount('20,000'), 20000);
  assert.equal(amount('₹20,000/-'), 20000);
  assert.equal(amount('Rs. 15000'), 15000);
  assert.equal(amount('rs15000'), 15000);
  assert.equal(amount('1,50,000 रुपये'), 150000);
  assert.equal(amount('२०००० रुपये'), 20000); // Devanagari digits
  assert.equal(amount('20k'), 20000);
});

test('English words', () => {
  assert.equal(amount('twenty thousand'), 20000);
  assert.equal(amount('twenty five thousand rupees'), 25000);
  assert.equal(amount('one lakh fifty thousand'), 150000);
  assert.equal(amount('two thousand five hundred'), 2500);
  assert.equal(amount('one hundred and fifty thousand'), 150000);
  assert.equal(amount('a lakh'), 100000);
});

test('Hinglish (romanised Hindi)', () => {
  assert.equal(amount('bees hazaar'), 20000);
  assert.equal(amount('bees hazar rupaye'), 20000);
  assert.equal(amount('pachis hajar'), 25000);
  assert.equal(amount('ek lakh'), 100000);
  assert.equal(amount('dedh lakh'), 150000);
  assert.equal(amount('dhai hazaar'), 2500);
  assert.equal(amount('saade teen hazaar'), 3500);
  assert.equal(amount('sava lakh'), 125000);
  assert.equal(amount('paune do lakh'), 175000);
  assert.equal(amount('20 hazaar'), 20000);
  assert.equal(amount('bees hazaar paanch sau'), 20500);
});

test('Hindi in Devanagari, with and without nukta', () => {
  assert.equal(amount('बीस हज़ार'), 20000);
  assert.equal(amount('बीस हजार रुपये'), 20000);
  assert.equal(amount('पच्चीस हजार'), 25000);
  assert.equal(amount('डेढ़ लाख'), 150000);
  assert.equal(amount('साढ़े तीन हज़ार'), 3500);
  assert.equal(amount('दो लाख पचास हजार'), 250000);
  assert.equal(amount('पैंतालीस हज़ार'), 45000);
  assert.equal(amount('तीन सौ'), 300);
});

test('Marathi', () => {
  assert.equal(amount('वीस हजार'), 20000);
  assert.equal(amount('पंचवीस हजार रुपये'), 25000);
  assert.equal(amount('दीड लाख'), 150000);
  assert.equal(amount('अडीच हजार'), 2500);
  assert.equal(amount('पंचेचाळीस हजार'), 45000);
  assert.equal(amount('तीन शंभर'), 300);
});

test('picks the money when a sentence also mentions a small number', () => {
  assert.equal(amount('20000 deposit tha, 3 mahine ho gaye'), 20000);
  assert.equal(amount('bees hazaar, teen mahine se'), 20000);
});

test('never guesses: unclear answers return null', () => {
  assert.equal(amount(''), null);
  assert.equal(amount('pata nahi'), null);
  assert.equal(amount('I do not know'), null);
  assert.equal(amount('20000 ya 25000'), null); // two possible amounts
  assert.equal(amount('50'), null); // too small to be a deposit: likely misheard
  assert.equal(amount('5 crore'), null); // above ₹1 crore: likely misheard
  assert.equal(amount('hazaar'), 1000); // "a thousand" said alone is still a clear amount
});

test('extractNumbers keeps separate quantities separate', () => {
  assert.deepEqual(extractNumbers('20 hazaar 3 mahine'), [20000, 3]);
  assert.deepEqual(extractNumbers('20000 2'), [20000, 2]);
});
