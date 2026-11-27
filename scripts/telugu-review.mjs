// Builds docs/telugu-review.md: every Telugu line Arzi shows or speaks, next to the
// English, plus the Telugu words Arzi listens for — for a Telugu speaker to check.
// Run: npm run review:telugu   (re-run after any change so the sheet stays in sync)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { t, FIELDS } from '../shared/src/index.js';
import { TE } from '../shared/src/i18n-te.js';
import { SAMPLE_SCRIPT } from '../client/src/demo/sampleScript.js';
import { summaryPairs, cell } from './telugu-sample.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = [];
const w = (s = '') => out.push(s);

w('# Telugu review sheet');
w();
w('Generated from the code by `npm run review:telugu`. Please do not edit the Telugu here — write corrections in the last column (or in a comment), and they will be copied into the code.');
w();
w('**What to check in every line:** Is it natural, polite everyday Telugu (the way a tenant or student in Hyderabad would speak)? Is the meaning the same as the English? Are there words a person with little schooling would not understand? `{value}`, `{n}`, `{date}` and similar are filled in by the app — keep them.');
w();
w('**Try it live:** open <https://arzi-2p1d.onrender.com/> in Chrome on your Android phone and choose **తెలుగు**. Telugu is available to everyone.');
w();

w('## 1. Screen and spoken text');
w();
w('| # | Key | English | Telugu (draft) | OK? / correction |');
w('|---|---|---|---|---|');
Object.keys(TE).forEach((key, i) => w(`| ${i + 1} | \`${key}\` | ${cell(t('en', key))} | ${cell(TE[key])} | |`));
w();

w('## 2. The seven questions');
w();
w('| Field | English label | Telugu label | English question | Telugu question | OK? / correction |');
w('|---|---|---|---|---|---|');
for (const f of FIELDS) {
  w(`| ${f.advocateLabel} | ${cell(f.label.en)} | ${cell(f.label.te)} | ${cell(f.question.en)} | ${cell(f.question.te)} | |`);
}
w();

w('## 3. Plain-language summary of the notice (read aloud before consent)');
w();
w('Shown with the sample case values. This is the most important part: the citizen agrees to the notice based on this.');
w();
w('| Point | English | Telugu (draft) | OK? / correction |');
w('|---|---|---|---|');
summaryPairs().forEach(({ en, te }, i) => w(`| ${i + 1} | ${cell(en)} | ${cell(te)} | |`));
w();

w('## 4. Words Arzi listens for in Telugu');
w();
w('Arzi understands Telugu answers by looking for these words. Please add words people commonly say that are missing, and remove any that could mean something else in normal speech.');
w();
const SOURCES = [
  ['shared/src/parse/yesno.js', 'Yes / no'],
  ['shared/src/intent.js', 'Problem type, emergency, language switch, consent, corrections'],
  ['shared/src/parse/numberWords.js', 'Numbers'],
  ['shared/src/parse/date.js', 'Months and "ago / last month / yesterday"'],
  ['shared/src/parse/units.js', 'Days, weeks, months, years (word starts)'],
  ['shared/src/parse/name.js', '"My name is…", "my address is…"'],
  ['shared/src/fields.js', '"Same address"'],
];
const TELUGU_WORD = /'([^'\n]*[ఀ-౿][^'\n]*)'/g;
w('| Where | List | Telugu words | Missing / wrong? |');
w('|---|---|---|---|');
for (const [file, what] of SOURCES) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  let current = 'list';
  const groups = new Map();
  for (const line of src.split('\n')) {
    const name = line.match(/^\s*(?:const|export const)\s+(\w+)/)?.[1] ?? line.match(/^\s{2}(\w+):\s*\[/)?.[1];
    if (name) current = name;
    const words = [...line.matchAll(TELUGU_WORD)].map((m) => m[1]);
    if (words.length) groups.set(current, [...(groups.get(current) ?? []), ...words]);
  }
  for (const [name, words] of groups) w(`| ${what} | \`${name}\` | ${cell(words.join(', '))} | |`);
}
w();

w('## 5. Sample case (what "Try a sample case" types in Telugu)');
w();
SAMPLE_SCRIPT.te.forEach((line, i) => w(`${i + 1}. ${line}`));
w();

w('## 6. What to test on the phone');
w();
w(`1. Open <https://arzi-2p1d.onrender.com/> in **Chrome on Android**. Choose **తెలుగు**.
2. **Voice output:** tap the mic. Do you *hear* Arzi in Telugu? Many phones have no Telugu voice: then the text is shown highlighted instead. Note which phone/Android version and what happened. (Phone settings → Text-to-speech → Google → install Telugu voice data improves this.)
3. **Full interview by voice:** say a real deposit problem in your own words, then answer all 7 questions. For each answer note: what you said, what Arzi heard (shown on screen), and whether it understood first time. Try names, a Hyderabad address, an amount in words ("ఇరవై ఐదు వేలు"), a date ("సెప్టెంబర్ 15"), and "రెండు నెలలుగా".
4. **Read-back:** is every number and date read correctly, digit by digit?
5. **Corrections:** at the summary say "మొత్తం మార్చండి" and fix the amount.
6. **Mixed speech:** answer some questions in Telugu-English mix ("deposit ఇవ్వలేదు").
7. **Errors:** stay silent for 8 s; speak with TV noise; say "తెలుగులో మాట్లాడండి" while in English; say something about violence (it must show 112).
8. **Consent:** after approval (use the advocate desk with PIN 1234, or "Skip to an approved document"), listen to the 5 points and say "అవును, నాకు అర్థమైంది, నేను అంగీకరిస్తున్నాను". Check the recording plays in My documents.
9. **PDF:** download it. Is the Telugu summary readable (no boxes, no broken letters)?
10. Send back: this sheet with corrections, plus a short list of exact phrases Arzi failed to understand.`);
w();

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'telugu-review.md'), out.join('\n'));
console.log(`docs/telugu-review.md: ${Object.keys(TE).length} lines, ${FIELDS.length} questions, 5 summary points`);
