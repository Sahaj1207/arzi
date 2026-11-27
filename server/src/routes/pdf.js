// PDF routes. Step 1 only has a self-test that proves Chromium + Devanagari
// work inside Docker. Step 8 adds the real notice PDF.
import { Router } from 'express';
import { renderPdf, PdfUnavailableError } from '../pdf/render.js';
import { fontFaceCss } from '../pdf/fonts.js';

export const pdfRouter = Router();

function selfTestHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${fontFaceCss()}
    body { font-family: 'Noto Sans Devanagari', sans-serif; font-size: 14pt; line-height: 1.6; color: #111; }
    h1 { font-size: 20pt; }
  </style></head><body>
    <h1>Arzi PDF self-test</h1>
    <p>English: The landlord must return the security deposit within 15 days.</p>
    <p>हिन्दी: मकान मालिक को 15 दिनों के भीतर सिक्योरिटी डिपॉज़िट लौटाना होगा। क्षत्रिय, श्रद्धा, द्वितीय।</p>
    <p>मराठी: घरमालकाने १५ दिवसांच्या आत अनामत रक्कम परत करावी. क्ष, ज्ञ, श्र, त्र.</p>
  </body></html>`;
}

pdfRouter.get('/selftest', async (_req, res) => {
  try {
    const pdf = await renderPdf(selfTestHtml());
    res.type('application/pdf').set('Content-Disposition', 'inline; filename="arzi-selftest.pdf"').send(pdf);
  } catch (err) {
    const reason = err instanceof PdfUnavailableError ? err.message : 'unknown error';
    console.warn('[pdf] self-test failed:', reason);
    // The client reads `fallback: "print"` and offers browser print-to-PDF instead.
    res.status(503).json({ error: 'pdf_unavailable', fallback: 'print', reason });
  }
});
