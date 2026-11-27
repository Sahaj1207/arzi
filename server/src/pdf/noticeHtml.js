// The final document as one HTML page. Chromium turns it into the PDF; the
// same page (with an auto-print script) is the browser print-to-PDF fallback.
// Contents: the approved English notice, the plain-language summary in the
// citizen's language, and the consent record.
import { LANGUAGES } from '@arzi/shared';
import { fontFaceCss } from './fonts.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const HEADINGS = {
  en: { summary: 'In simple words', consent: 'Consent' },
  hi: { summary: 'आसान शब्दों में', consent: 'सहमति' },
  mr: { summary: 'सोप्या शब्दांत', consent: 'संमती' },
  te: { summary: 'సులభమైన మాటల్లో', consent: 'అంగీకారం' },
};

// Toolbar on the printable page (screen only, never printed).
const SAVE = {
  en: { button: 'Save as PDF', hint: 'In the print window, choose “Save as PDF” as the printer.' },
  hi: { button: 'PDF सेव करें', hint: 'प्रिंट विंडो में प्रिंटर की जगह “Save as PDF” चुनें।' },
  mr: { button: 'PDF सेव्ह करा', hint: 'प्रिंट विंडोमध्ये प्रिंटर म्हणून “Save as PDF” निवडा.' },
  te: { button: 'PDF గా సేవ్ చేయండి', hint: 'ప్రింట్ విండోలో ప్రింటర్‌గా “Save as PDF” ఎంచుకోండి.' },
};

const CONSENT_TEXT = {
  voice: (d) => `Consent given by voice on ${d}.`,
  button: (d, audio) => `Consent given by tapping “I understood and I agree” on ${d}${audio ? '; voice recorded' : ''}.`,
};

const fmtDate = (sql) =>
  new Date(`${sql.replace(' ', 'T')}Z`).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) + ' IST';

// Notice text → paragraphs; the title lines are emphasised.
function noticeHtml(text) {
  const blocks = text.split(/\n{2,}/);
  return blocks
    .map((b, i) => {
      if (i === 0) {
        const [title, ...rest] = b.split('\n').map(esc);
        return `<h1>${title}</h1>${rest.length ? `<p class="sub">${rest.join('<br>')}</p>` : ''}`;
      }
      const lines = b.split('\n').map(esc).join('<br>');
      if (/^Subject:/.test(b)) return `<p class="subject">${lines}</p>`;
      if (/^Reviewed by Advocate/.test(b)) return `<p class="reviewed">${lines}</p>`;
      return `<p>${lines}</p>`;
    })
    .join('\n');
}

// print: add the "Save as PDF" toolbar (browser print-to-PDF fallback).
// autoPrint: also open the print dialog by itself, but only on a computer;
// phones often block print() without a tap, so there the big button does it.
export function documentHtml(doc, { print = false, autoPrint = print } = {}) {
  const lang = doc.language;
  const h = HEADINGS[lang] ?? HEADINGS.en;
  const langLabel = LANGUAGES.find((l) => l.code === lang)?.englishLabel ?? lang;
  const points = doc.version.summary
    .split('\n')
    .filter(Boolean)
    .map((p) => `<li>${esc(p)}</li>`)
    .join('');
  const save = SAVE[lang] ?? SAVE.en;
  const toolbar = print
    ? `<div class="toolbar no-print" lang="${esc(lang)}">
  <button type="button" onclick="window.print()">${esc(save.button)}</button>
  <p>${esc(save.hint)}${lang === 'en' ? '' : `<br><span lang="en">${esc(SAVE.en.hint)}</span>`}</p>
</div>`
    : '';
  const c = doc.consent;
  const consent = c
    ? `<section class="consent"><h2>${esc(h.consent)} / Consent</h2><p>${esc(
        (CONSENT_TEXT[c.method] ?? CONSENT_TEXT.voice)(fmtDate(c.createdAt), c.hasAudio),
      )}${c.transcript ? ` Words heard: “${esc(c.transcript)}”.` : ''} (Version ${c.versionNo})</p></section>`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>arzi-legal-notice-${esc(doc.id.slice(0, 8))}-v${doc.version.no}</title>
<style>
  ${fontFaceCss()}
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: #111; font-size: 11.5pt; line-height: 1.55;
    font-family: 'Noto Serif', Georgia, 'Times New Roman', 'Noto Sans Devanagari', 'Noto Sans Telugu', serif;
  }
  .page { max-width: 180mm; margin: 0 auto; }
  h1 { font-size: 17pt; letter-spacing: 0.08em; text-align: center; margin: 0; }
  .sub { text-align: center; margin: 2pt 0 16pt; font-style: italic; }
  p { margin: 0 0 9pt; }
  .subject { font-weight: 700; }
  .reviewed { margin-top: 14pt; padding-top: 6pt; border-top: 1px solid #999; font-weight: 700; }
  .summary, .consent {
    margin-top: 18pt; padding: 10pt 12pt; border: 1px solid #bbb; border-radius: 6pt;
    font-family: 'Noto Sans Devanagari', 'Noto Sans Telugu', 'Noto Sans', Arial, sans-serif; break-inside: avoid;
  }
  .summary h2, .consent h2 { font-size: 12pt; margin: 0 0 6pt; }
  .summary ol { margin: 0; padding-left: 16pt; }
  .summary li { margin-bottom: 5pt; }
  footer { margin-top: 16pt; font-size: 8.5pt; color: #555; font-family: 'Noto Sans', Arial, sans-serif; }
  @media screen {
    body { background: #f2ece1; }
    .page { background: #fff; padding: 20mm 18mm; margin: 10mm auto; box-shadow: 0 2px 12px #0002; }
    .toolbar {
      position: sticky; top: 0; z-index: 1; display: flex; gap: 14px; align-items: center; justify-content: center;
      padding: 12px 16px; background: #f8f4ec; border-bottom: 1px solid #e8e0d3;
      font-family: 'Noto Sans Devanagari', 'Noto Sans Telugu', 'Noto Sans', Arial, sans-serif;
    }
    .toolbar button {
      flex: none; min-height: 52px; padding: 0 26px; border: 0; border-radius: 999px;
      background: #5b3fa8; color: #fff; font: inherit; font-size: 17px; font-weight: 700; cursor: pointer;
    }
    .toolbar button:focus-visible { outline: 3px solid #d9962b; outline-offset: 3px; }
    .toolbar p { margin: 0; font-size: 13px; line-height: 1.4; color: #6a6258; max-width: 40ch; }
  }
  @media screen and (max-width: 720px) {
    body { background: #fff; font-size: 15px; }
    .page { max-width: none; margin: 0; padding: 20px 18px 32px; box-shadow: none; }
    h1 { font-size: 20px; }
    .toolbar { flex-direction: column; gap: 8px; text-align: center; }
    .toolbar button { width: 100%; }
  }
  @media print { .no-print { display: none !important; } }
</style></head>
<body>
${toolbar}
<div class="page">
${noticeHtml(doc.version.notice)}
<section class="summary" lang="${esc(lang)}">
  <h2>${esc(h.summary)} (${esc(langLabel)})</h2>
  <ol>${points}</ol>
</section>
${consent}
<footer>Document ${esc(doc.id)} · Version ${doc.version.no} · Made with Arzi (prototype — not legal advice).</footer>
</div>
${
  autoPrint
    ? `<script>
  // Computers: open the print dialog by itself once fonts are ready.
  // Touch phones: wait for a tap on "Save as PDF" (auto print is often blocked).
  if (!matchMedia('(pointer: coarse)').matches) {
    window.addEventListener('load', () => document.fonts.ready.then(() => setTimeout(() => window.print(), 300)));
  }
</script>`
    : ''
}
</body></html>`;
}
