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

export function documentHtml(doc, { print = false } = {}) {
  const lang = doc.language;
  const h = HEADINGS[lang] ?? HEADINGS.en;
  const langLabel = LANGUAGES.find((l) => l.code === lang)?.englishLabel ?? lang;
  const points = doc.version.summary
    .split('\n')
    .filter(Boolean)
    .map((p) => `<li>${esc(p)}</li>`)
    .join('');
  const c = doc.consent;
  const consent = c
    ? `<section class="consent"><h2>${esc(h.consent)} / Consent</h2><p>${esc(
        (CONSENT_TEXT[c.method] ?? CONSENT_TEXT.voice)(fmtDate(c.createdAt), c.hasAudio),
      )}${c.transcript ? ` Words heard: “${esc(c.transcript)}”.` : ''} (Version ${c.versionNo})</p></section>`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Legal notice – ${esc(doc.fields.tenantName?.text)} – Arzi</title>
<style>
  ${fontFaceCss()}
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: #111; font-size: 11.5pt; line-height: 1.55;
    font-family: 'Noto Serif', Georgia, 'Times New Roman', 'Noto Sans Devanagari', serif;
  }
  .page { max-width: 180mm; margin: 0 auto; }
  h1 { font-size: 17pt; letter-spacing: 0.08em; text-align: center; margin: 0; }
  .sub { text-align: center; margin: 2pt 0 16pt; font-style: italic; }
  p { margin: 0 0 9pt; }
  .subject { font-weight: 700; }
  .reviewed { margin-top: 14pt; padding-top: 6pt; border-top: 1px solid #999; font-weight: 700; }
  .summary, .consent {
    margin-top: 18pt; padding: 10pt 12pt; border: 1px solid #bbb; border-radius: 6pt;
    font-family: 'Noto Sans Devanagari', 'Noto Sans', Arial, sans-serif; break-inside: avoid;
  }
  .summary h2, .consent h2 { font-size: 12pt; margin: 0 0 6pt; }
  .summary ol { margin: 0; padding-left: 16pt; }
  .summary li { margin-bottom: 5pt; }
  footer { margin-top: 16pt; font-size: 8.5pt; color: #555; font-family: 'Noto Sans', Arial, sans-serif; }
  @media screen { body { background: #eee; } .page { background: #fff; padding: 20mm 18mm; margin: 10mm auto; box-shadow: 0 2px 12px #0002; } }
  @media print { .no-print { display: none; } }
</style></head>
<body><div class="page">
${noticeHtml(doc.version.notice)}
<section class="summary" lang="${esc(lang)}">
  <h2>${esc(h.summary)} (${esc(langLabel)})</h2>
  <ol>${points}</ol>
</section>
${consent}
<footer>Document ${esc(doc.id)} · Version ${doc.version.no} · Made with Arzi (prototype — not legal advice).</footer>
</div>
${print ? '<script>window.addEventListener("load", () => document.fonts.ready.then(() => window.print()));</script>' : ''}
</body></html>`;
}
