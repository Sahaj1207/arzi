// What the server says is available (from /api/config), and whether this
// session may use outside AI services (Sarvam): only after the citizen said yes.
import { api } from './api.js';
import { getUserId } from './userId.js';
import { getAiConsent } from './prefs.js';

let runtime = null;
export const setRuntimeConfig = (c) => (runtime = c);
export const getRuntimeConfig = () => runtime;

export const aiConfigured = () => (runtime?.aiProviders?.length ?? 0) > 0;
export const aiAllowed = () => aiConfigured() && getAiConsent() === 'yes';

// Session-level switch-offs after a paid service failed (out of credits, down, ...).
const failed = new Set();
export function markAiFailed(service, reason) {
  if (failed.has(service)) return;
  failed.add(service);
  console.warn(`[ai] ${service} failed (${reason}); using the free fallback for this session`);
  window.dispatchEvent(new CustomEvent('arzi:ai-fallback', { detail: { service, reason } }));
}
export const aiServiceUp = (service) => aiAllowed() && !failed.has(service);
// Understanding answers (LLM) needs Sarvam; a Groq-only server has speech-to-text only.
const llmUp = () => runtime?.mode === 'ai' && aiServiceUp('llm');
export const aiServiceFailed = (service) => failed.has(service);

// LLM help for an answer the built-in parser could not read. Returns a value
// (still read back to the citizen for a yes/no) or null.
export async function aiExtract(field, text, lang) {
  if (!llmUp()) return null;
  const r = await api('/ai/extract', { method: 'POST', body: { userId: getUserId(), lang, field: field.id, text, aiConsent: 'yes' } });
  if (!r.ok) {
    if (r.status !== 400) markAiFailed('llm', r.error);
    return null;
  }
  return r.data.value ?? null;
}

// LLM help when keywords did not recognise the problem. 'deposit' | 'emergency' | 'other' | null.
export async function aiIntent(text, lang) {
  if (!llmUp()) return null;
  const r = await api('/ai/intent', { method: 'POST', body: { userId: getUserId(), lang, text, aiConsent: 'yes' } });
  if (!r.ok) {
    if (r.status !== 400) markAiFailed('llm', r.error);
    return null;
  }
  return r.data.intent ?? null;
}
