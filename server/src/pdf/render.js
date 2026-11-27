// Turns an HTML page into a PDF with headless Chromium.
// Chromium does proper Devanagari shaping, so Hindi/Marathi conjuncts render correctly.
// If Chromium is missing, disabled (PDF_ENGINE=print) or crashes, renderPdf() throws
// PdfUnavailableError and the caller sends the printable page instead.
// The server never goes down.
//
// Low-memory hosts (Render free tier, 512 MB): one PDF at a time, low-memory
// Chromium flags, and Chromium is closed after 60 s idle so it does not hold RAM.
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

const IDLE_CLOSE_MS = 60_000;

export function findChromium() {
  if (config.pdfEngine === 'print') return null;
  if (config.chromiumPath) return fs.existsSync(config.chromiumPath) ? config.chromiumPath : null;
  return CANDIDATE_PATHS.find((p) => fs.existsSync(p)) ?? null;
}

// For logs and /api/config: 'chromium' or 'print'.
export const pdfEngine = () => (findChromium() ? 'chromium' : 'print');

let browserPromise = null;
let idleTimer = null;
let queue = Promise.resolve(); // one PDF at a time

async function getBrowser() {
  const executablePath = findChromium();
  if (!executablePath) throw new PdfUnavailableError('Chromium not available');
  if (!browserPromise) {
    const { default: puppeteer } = await import('puppeteer-core');
    browserPromise = puppeteer
      .launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--no-zygote',
          '--renderer-process-limit=1',
          '--js-flags=--max-old-space-size=128',
          '--font-render-hinting=none',
        ],
      })
      .then((browser) => {
        browser.on('disconnected', () => (browserPromise = null)); // launch a fresh one next time
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

async function renderOne(html, timeoutMs) {
  clearTimeout(idleTimer);
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: timeoutMs });
    await page.evaluateHandle('document.fonts.ready');
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, timeout: timeoutMs });
  } catch (err) {
    if (err instanceof PdfUnavailableError) throw err;
    throw new PdfUnavailableError(`PDF rendering failed: ${err.message}`);
  } finally {
    await page?.close().catch(() => {});
    idleTimer = setTimeout(() => closePdfBrowser(), IDLE_CLOSE_MS);
    idleTimer.unref?.();
  }
}

export function renderPdf(html, { timeoutMs = 20000 } = {}) {
  const job = queue.then(() => renderOne(html, timeoutMs));
  queue = job.catch(() => {}); // a failed PDF must not block the next one
  return job;
}

export async function closePdfBrowser() {
  clearTimeout(idleTimer);
  const p = browserPromise;
  browserPromise = null;
  if (p) await (await p.catch(() => null))?.close().catch(() => {});
}
