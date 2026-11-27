// Telugu understanding. The phrases here are our best guesses at what Chrome's
// te-IN speech recognition returns; the Telugu-speaking tester should add real ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmount, parseDate, parsePending, parseYesNo, parseConsent, detectIntent, detectLanguageSwitch,
  detectFieldToChange, extractName, extractAddress, spellDigits, formatDate, formatDuration, t, stringKeys, FIELDS,
  LANGUAGES,
} from '../src/index.js';
import { TE } from '../src/i18n-te.js';

const today = new Date(2026, 10, 27);

test('Telugu is a fully supported language, shown to everyone', () => {
  const te = LANGUAGES.find((l) => l.code === 'te');
  assert.deepEqual([te.speechTag, te.review], ['te-IN', undefined]);
});

test('every screen and spoken line has a Telugu version (except English-only footer lines)', () => {
  const ENGLISH_ONLY = new Set(['statusLine', 'modeDemo', 'modeAi', 'speechBrowser']);
  const missing = stringKeys('en').filter((k) => !ENGLISH_ONLY.has(k) && !(k in TE));
  assert.deepEqual(missing, []);
  for (const key of Object.keys(TE)) assert.notEqual(t('te', key), t('en', key), `te.${key} is still English`);
  for (const f of FIELDS) assert.ok(f.label.te && f.question.te, `field ${f.id} has Telugu label and question`);
});

test('amounts in Telugu words and digits', () => {
  const v = (s) => parseAmount(s)?.value ?? null;
  assert.equal(v('ఇరవై వేలు'), 20000);
  assert.equal(v('ఇరవై వేల రూపాయలు'), 20000);
  assert.equal(v('ఇరవై ఐదు వేల రూపాయలు'), 25000);
  assert.equal(v('పదిహేను వేలు'), 15000);
  assert.equal(v('ఒక లక్ష'), 100000);
  assert.equal(v('రెండు లక్షల యాభై వేలు'), 250000);
  assert.equal(v('ఒకటిన్నర లక్ష'), 150000);
  assert.equal(v('25000 రూపాయలు'), 25000);
  assert.equal(v('౨౫౦౦౦'), 25000); // Telugu digits
  assert.equal(v('తెలియదు'), null);
});

test('dates and periods in Telugu', () => {
  assert.deepEqual(parseDate('15 సెప్టెంబర్ 2026', { today }), { iso: '2026-09-15', precision: 'day' });
  assert.deepEqual(parseDate('సెప్టెంబర్ 15న', { today }), { iso: '2026-09-15', precision: 'day' });
  assert.deepEqual(parseDate('పదిహేను మార్చి', { today }), { iso: '2026-03-15', precision: 'day' });
  assert.deepEqual(parseDate('మార్చిలో', { today }), { iso: '2026-03-01', precision: 'month' });
  assert.deepEqual(parseDate('రెండు నెలల క్రితం', { today }), { iso: '2026-09-27', precision: 'month' });
  assert.deepEqual(parseDate('గత నెల', { today }), { iso: '2026-10-27', precision: 'month' });
  assert.deepEqual(parseDate('నిన్న', { today }), { iso: '2026-11-26', precision: 'day' });
  const p = parsePending('మూడు నెలలుగా', { today });
  assert.deepEqual([p.kind, p.value, p.unit], ['duration', 3, 'month']);
});

test('yes / no, consent, intent and corrections in Telugu', () => {
  for (const y of ['అవును', 'అవునండి', 'సరే', 'అవును, అన్నీ సరిగ్గా ఉన్నాయి']) assert.equal(parseYesNo(y), 'yes', y);
  for (const n of ['కాదు', 'లేదు', 'వద్దు', 'సరి కాదు', 'తప్పు']) assert.equal(parseYesNo(n), 'no', n);
  assert.equal(parseConsent('అవును, నాకు అర్థమైంది, నేను అంగీకరిస్తున్నాను'), 'agree');
  assert.equal(parseConsent('నాకు అర్థం కాలేదు'), 'no');
  assert.equal(parseConsent('ఇంగ్లీషులో చదవండి'), 'english');
  assert.equal(parseConsent('మళ్ళీ చదవండి'), 'repeat');
  assert.equal(detectIntent('యజమాని నా సెక్యూరిటీ డిపాజిట్ తిరిగి ఇవ్వలేదు').intent, 'deposit');
  assert.equal(detectIntent('ఓనర్ నా డబ్బులు తిరిగి ఇవ్వడం లేదు').intent, 'deposit');
  assert.equal(detectIntent('యజమాని నన్ను కొట్టాడు').intent, 'emergency');
  assert.equal(detectIntent('నా జీతం రాలేదు').intent, 'other');
  assert.equal(detectLanguageSwitch('తెలుగులో మాట్లాడండి'), 'te');
  assert.equal(detectLanguageSwitch('Speak in Telugu'), 'te');
  assert.equal(detectFieldToChange('మొత్తం మార్చండి'), 'depositAmount');
  assert.equal(detectFieldToChange('యజమాని పేరు తప్పు'), 'landlordName');
});

test('names, addresses and read-back in Telugu', () => {
  assert.equal(extractName('నా పేరు ప్రియా శర్మ'), 'ప్రియా శర్మ');
  assert.equal(extractName('ఇంటి యజమాని పేరు రాజేష్ గుప్తా అండి'), 'రాజేష్ గుప్తా');
  assert.equal(extractAddress('నా చిరునామా రూమ్ 12, అమీర్‌పేట్, హైదరాబాద్'), 'రూమ్ 12, అమీర్‌పేట్, హైదరాబాద్');
  assert.equal(spellDigits(25000, 'te'), 'రెండు ఐదు సున్నా సున్నా సున్నా');
  assert.equal(formatDate('2026-09-15', 'te'), '15 సెప్టెంబర్ 2026');
  assert.equal(formatDuration({ value: 2, unit: 'month' }, 'te'), '2 నెలలు');
});
