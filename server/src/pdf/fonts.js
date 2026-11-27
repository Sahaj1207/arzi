// Embeds the bundled Noto Sans Devanagari font as @font-face CSS (base64),
// so PDF pages render Hindi/Marathi with the same font on every machine.
// The font is split into a Devanagari and a Latin subset (from @fontsource),
// each limited by unicode-range, in regular (400) and bold (700).
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../config.js';

const FONT_DIR = path.join(REPO_ROOT, 'server', 'assets', 'fonts');

const RANGES = {
  devanagari: 'U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+20F0,U+25CC,U+A830-A839,U+A8E0-A8FF,U+11B00-11B09',
  latin:
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
};

let cached = null;

export function fontFaceCss() {
  if (cached !== null) return cached;
  const faces = [];
  for (const subset of Object.keys(RANGES)) {
    for (const weight of [400, 700]) {
      const file = path.join(FONT_DIR, `noto-sans-devanagari-${subset}-${weight}.woff2`);
      if (!fs.existsSync(file)) continue;
      const b64 = fs.readFileSync(file).toString('base64');
      faces.push(
        `@font-face{font-family:'Noto Sans Devanagari';font-style:normal;font-weight:${weight};` +
          `src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${RANGES[subset]};}`,
      );
    }
  }
  cached = faces.join('\n');
  return cached;
}
