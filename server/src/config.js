// Reads all configuration from environment variables (and an optional .env).
// Nothing here is required: with no .env, Arzi runs in Demo mode with browser speech.
// Keys stay on the server; publicConfig() is the only thing the browser sees.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '..', '..');

// Load .env from the repo root if it exists. Missing file is fine.
try {
  process.loadEnvFile(path.join(REPO_ROOT, '.env'));
} catch {
  /* no .env: demo mode */
}

const env = (name) => {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : null;
};
const int = (name, fallback) => {
  const n = Number.parseInt(env(name) ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  port: int('PORT', 3000),
  dataDir: path.resolve(REPO_ROOT, env('DATA_DIR') ?? 'data'),
  chromiumPath: env('CHROMIUM_PATH'),
  // 'auto' (Chromium if found), 'chromium', or 'print' (always the browser print-to-PDF
  // page; for hosts with too little memory for Chromium).
  pdfEngine: ['auto', 'chromium', 'print'].includes(env('PDF_ENGINE')) ? env('PDF_ENGINE') : 'auto',
  advocatePin: env('ADVOCATE_PIN') ?? '1234',
  // Fictional demo advocate; the notice reads "Reviewed by Advocate R. Mehta (demo)".
  advocateName: env('ADVOCATE_NAME') ?? 'R. Mehta (demo)',
  keys: {
    sarvam: env('SARVAM_API_KEY'),
    wispr: env('WISPR_API_KEY'),
    anthropic: env('ANTHROPIC_API_KEY'),
  },
  limits: {
    perUserPerDay: int('PAID_CALLS_PER_USER_PER_DAY', 40),
    perIpPerDay: int('PAID_CALLS_PER_IP_PER_DAY', 120),
  },
};

// Which provider is active for each job, based only on which keys are present.
export function activeProviders() {
  const { sarvam, wispr, anthropic } = config.keys;
  return {
    speech: wispr ? 'wispr' : sarvam ? 'sarvam' : 'browser',
    tts: sarvam ? 'sarvam' : 'browser',
    drafting: anthropic ? 'anthropic' : sarvam ? 'sarvam' : 'demo',
  };
}

// Safe to send to the browser: names of providers, never keys.
export function publicConfig(extra = {}) {
  const p = activeProviders();
  const NAMES = { sarvam: 'Sarvam AI', wispr: 'Wispr Flow', anthropic: 'Anthropic (Claude)' };
  // Outside services that would receive the citizen's voice or words (for the consent question).
  const aiProviders = [...new Set([p.speech, p.tts, p.drafting].filter((x) => NAMES[x]).map((x) => NAMES[x]))];
  return {
    speech: p.speech,
    tts: p.tts,
    mode: p.drafting === 'demo' ? 'demo' : 'ai',
    aiProviders,
    advocateName: config.advocateName,
    ...extra,
  };
}
