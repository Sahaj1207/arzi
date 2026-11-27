import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectIntent, detectLanguageSwitch, detectFieldToChange, parseYesNo } from '../src/index.js';

const intent = (text) => detectIntent(text).intent;

test('deposit problems in English, Hinglish, Hindi and Marathi', () => {
  assert.equal(intent('My landlord has not returned my security deposit'), 'deposit');
  assert.equal(intent('PG owner ne mera deposit wapas nahi kiya'), 'deposit');
  assert.equal(intent('मकान मालिक ने मेरा डिपॉज़िट वापस नहीं किया'), 'deposit');
  assert.equal(intent('मकान मालिक मेरे पैसे वापस नहीं दे रहा'), 'deposit');
  assert.equal(intent('घरमालकाने माझी अनामत रक्कम परत दिली नाही'), 'deposit');
  assert.equal(intent('advance paisa nahi mila'), 'deposit');
});

test('other problems are recognised as not deposit', () => {
  assert.equal(intent('My employer has not paid my salary'), 'other');
  assert.equal(intent('मेरा तलाक का केस है'), 'other');
  assert.equal(intent(''), 'empty');
});

test('violence or emergency always wins, even mid-deposit story', () => {
  assert.equal(intent('Landlord hit me when I asked for my deposit'), 'emergency');
  assert.equal(intent('मालिक ने मुझे मारा'), 'emergency');
  assert.equal(intent('jaan se maarne ki dhamki di'), 'emergency');
  assert.equal(intent('घरमालकाने मारहाण केली'), 'emergency');
  assert.equal(intent('bachao'), 'emergency');
  assert.equal(intent('mere pita ne deposit diya tha'), 'deposit'); // "pita" = father, not "beaten"
});

test('yes / no', () => {
  for (const y of ['yes', 'Yes, that is right', 'haan', 'हाँ', 'हां जी', 'ji haan sahi hai', 'होय', 'हो बरोबर', 'ठीक है']) {
    assert.equal(parseYesNo(y), 'yes', y);
  }
  for (const n of ['no', 'nahi', 'नहीं', 'नाही', 'नको', 'not correct', 'sahi nahi hai', 'बरोबर नाही', 'galat hai']) {
    assert.equal(parseYesNo(n), 'no', n);
  }
  assert.equal(parseYesNo('umm'), null);
  assert.equal(parseYesNo(''), null);
});

test('switching language by voice', () => {
  assert.equal(detectLanguageSwitch('Speak in Marathi'), 'mr');
  assert.equal(detectLanguageSwitch('marathi mein bolo'), 'mr');
  assert.equal(detectLanguageSwitch('मराठीत बोला'), 'mr');
  assert.equal(detectLanguageSwitch('हिंदी में बोलिए'), 'hi');
  assert.equal(detectLanguageSwitch('English please'), 'en');
  assert.equal(detectLanguageSwitch('मराठी'), 'mr');
  assert.equal(detectLanguageSwitch('my landlord is from a Marathi family who lives nearby'), null);
  assert.equal(detectLanguageSwitch('Hindi or English'), null);
});

test('which field to correct', () => {
  assert.equal(detectFieldToChange('Change the amount'), 'depositAmount');
  assert.equal(detectFieldToChange('amount galat hai'), 'depositAmount');
  assert.equal(detectFieldToChange('रक्कम बदला'), 'depositAmount');
  assert.equal(detectFieldToChange('my name is wrong'), 'tenantName');
  assert.equal(detectFieldToChange('मालिक का नाम बदलो'), 'landlordName');
  assert.equal(detectFieldToChange('landlord address is wrong'), 'landlordAddress');
  assert.equal(detectFieldToChange('mera pata galat hai'), 'tenantAddress');
  assert.equal(detectFieldToChange('the date I moved out'), 'movedOutDate');
  assert.equal(detectFieldToChange('change the date'), null); // ambiguous: ask which date
});
