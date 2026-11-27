// Turns an HTML page into a PDF with headless Chromium.
// Chromium does proper Devanagari shaping, so Hindi/Marathi conjuncts render correctly.
// If Chromium is missing or crashes, renderPdf() throws PdfUnavailableError and the
// caller tells the browser to fall back to print-to-PDF. The server never goes down.
import fs from 'node:fs';
import { config } from '../config.js';

export class PdfUnavailableError extends Error {}

const CANDIDATE_PATHS = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export function findChromium() {
  if (config.chromiumPath) return fs.existsSync(config.chromiumPath) ? config.chromiumPath : null;
  return CANDIDATE_PATHS.find((p) => fs.existsSync(p)) ?? null;
}

let browserPromise = null;

async function getBrowser() {
  const executablePath = findChromium();
  if (!executablePath) throw new PdfUnavailableError('Chromium not found');
  if (!browserPromise) {
    const { default: puppeteer } = await import('puppeteer-core');
    browserPromise = puppeteer
      .launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
      })
      .then((browser) => {
        // If Chromium dies, launch a fresh one next time.
        browser.on('disconnected', () => (browserPromise = null));
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

export async function renderPdf(html, { timeoutMs = 20000 } = {}) {
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: timeoutMs });
    await page.evaluateHandle('document.fonts.ready');
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
      timeout: timeoutMs,
    });
  } catch (err) {
    if (err instanceof PdfUnavailableError) throw err;
    throw new PdfUnavailableError(`PDF rendering failed: ${err.message}`);
  } finally {
    await page?.close().catch(() => {});
  }
}

export async function closePdfBrowser() {
  const p = browserPromise;
  browserPromise = null;
  if (p) await (await p.catch(() => null))?.close().catch(() => {});
}
