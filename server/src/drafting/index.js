// Drafting entry point. Demo mode (templates) always works with no key.
//
// AI mode (SARVAM_API_KEY set AND the citizen agreed to AI this session):
// names and addresses spoken in Devanagari or Telugu script are transliterated
// into English letters for the ENGLISH notice ("प्रिया शर्मा" → "Priya Sharma");
// the plain-language summary keeps the original script. The legal wording itself
// stays the reviewed template: an LLM never rewrites the notice.
// Any AI failure falls back silently to the original script.
import { buildNotice } from './notice.js';
import { buildSummary } from './summary.js';
import { sarvamConfigured, transliterate } from '../providers/sarvam.js';
import { takeQuota } from '../usage.js';

const SCRIPT_FIELDS = ['tenantName', 'tenantAddress', 'landlordName', 'landlordAddress'];
const DEVANAGARI = /[ऀ-ॿ]/;
const TELUGU = /[ఀ-౿]/;

const titleCase = (s) => s.replace(/(^|[\s,(/-])([a-z])/g, (m, p, c) => p + c.toUpperCase());

function sourceLang(text, lang) {
  if (TELUGU.test(text)) return 'te-IN';
  if (DEVANAGARI.test(text)) return lang === 'mr' ? 'mr-IN' : 'hi-IN';
  return null;
}

// Returns fields with Indic-script text replaced by English letters, or null if nothing changed.
async function latinFields(fields, lang, ai) {
  const todo = SCRIPT_FIELDS.filter((id) => fields[id]?.text && sourceLang(fields[id].text, lang));
  if (todo.length === 0) return null;
  takeQuota(ai); // one count per document, not per field
  const out = { ...fields };
  for (const id of todo) {
    const latin = await transliterate(fields[id].text, sourceLang(fields[id].text, lang));
    if (latin && !DEVANAGARI.test(latin) && !TELUGU.test(latin)) out[id] = { ...fields[id], text: titleCase(latin) };
  }
  return out;
}

// ai: { userId, ip } when AI may be used for this document, otherwise null.
// facts: extra facts from the story (AI mode), [{ en, local }]; [] in demo mode.
export async function draftDocument({ fields, lang, today = new Date(), ai = null, facts = [] }) {
  let noticeFields = fields;
  let mode = 'demo';
  if (ai && sarvamConfigured()) {
    try {
      const latin = await latinFields(fields, lang, ai);
      if (latin) {
        noticeFields = latin;
        mode = 'ai';
      }
    } catch (err) {
      console.warn('[drafting] transliteration skipped:', err.kind ?? '', err.message);
    }
  }
  return {
    notice: buildNotice(noticeFields, { today, facts }),
    summary: buildSummary(fields, lang, facts),
    mode,
  };
}
