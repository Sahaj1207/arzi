// Builds docs/telugu-review-short.md: just the 7 interview questions and the 5
// summary points, English next to Telugu, for a quick check by a Telugu speaker.
// Run: npm run review:telugu-short   (re-run after any change so it matches the app)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIELDS } from '../shared/src/index.js';
import { summaryPairs, cell } from './telugu-sample.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rows = [
  ...FIELDS.map((f, i) => [`Q${i + 1}. ${f.question.en}`, f.question.te]),
  ...summaryPairs().map(({ en, te }, i) => [`Summary ${i + 1}. ${en}`, te]),
];
const out = [
  'Fix anything wrong or unnatural. Screenshot any other odd line while using the app.',
  '',
  '| English | Telugu | Correction |',
  '|---|---|---|',
  ...rows.map(([en, te]) => `| ${cell(en)} | ${cell(te)} | |`),
];
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'telugu-review-short.md'), out.join('\n') + '\n');
console.log(`docs/telugu-review-short.md: ${out.length} lines (${FIELDS.length} questions, ${rows.length - FIELDS.length} summary points)`);
