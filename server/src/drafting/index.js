// Drafting entry point. Demo mode (templates) always works with no key.
// Step 9 adds AI mode here: if an LLM key is set, polish the draft, and fall
// back to these templates on any error.
import { buildNotice } from './notice.js';
import { buildSummary } from './summary.js';

export async function draftDocument({ fields, lang, today = new Date() }) {
  return {
    notice: buildNotice(fields, { today }),
    summary: buildSummary(fields, lang),
    mode: 'demo',
  };
}
