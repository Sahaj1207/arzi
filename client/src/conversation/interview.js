// The citizen interview (core flow steps 2–3), as one readable async script.
//
//   1. Listen to the whole problem (until a ~3 s pause or the "done" tap, up to
//      2 minutes) → deposit? → "Is that right? Say yes or no."
//      Not a deposit problem → say so, offer to note it for an advocate.
//   1b. AI mode only (opts.aiStory): read every detail already in the story, plus
//      extra facts (the landlord's excuse, deductions…), confirm them in ONE summary,
//      and ask only for what is missing. Demo mode asks every field.
//   2. Ask the 7 fields one by one. Every answer is read back ("I heard: …
//      Is that right?"); after 2 "no"s for one field, ask the user to type it.
//   3. Read a summary → "Is everything correct?" → fix any single field by
//      voice ("change the amount") → repeat until yes.
//
//   On EVERY answer: violence/emergency words stop everything and show 112;
//   "Speak in Marathi" switches language and repeats the question.
//
// It talks to the screen only through `io`, so tests can drive it with a fake:
//   io.ask({ prompt, parse, keyboard }) → { status: 'answer', text, value, via } | { status: 'aborted' }
//                                          (the UI handles retries, silence and typing)
//   io.say(text)        speak without listening
//   io.update(patch)    update what the screen shows
//   io.getLang() / io.setLang(code)
import {
  FIELDS,
  getField,
  t,
  detectIntent,
  isEmergency,
  detectLanguageSwitch,
  detectFieldToChange,
  parseYesNo,
  parseFieldAnswer,
  displayFieldValue,
  speakFieldValue,
  isValidFieldValue,
} from '@arzi/shared';

class Stop extends Error {
  constructor(result) {
    super(result.outcome);
    this.result = result;
  }
}

const MAX_DESCRIBE_TRIES = 2;
const REJECTIONS_BEFORE_TYPING = 2;

// Consent for outside AI services is a checkbox on the home screen (not asked here);
// the AI helpers are only passed in when it is ticked.
export async function runInterview(io, opts = {}) {
  const s = createSession(io, opts);
  return s.guard(async () => {
    await s.askProblem();
    if (s.ctx.outcome) return s.ctx.outcome; // not a deposit problem
    const fromStory = await s.fromStory();
    const missing = FIELDS.filter((f) => !s.ctx.fields[f.id]);
    if (fromStory && missing.length) await s.io.say(t(s.L(), 'storyRest'));
    for (const field of missing) await s.askField(field);
    // Everything came from the story → its summary was the full check already.
    if (!fromStory || missing.length) await s.confirmAll();
    s.io.update({ current: 'done' });
    await s.io.say(t(s.L(), 'allSet'));
    return s.result('ready');
  });
}

// After the advocate asks for changes: read the advocate's note, then the
// same "Is everything correct? / change the amount" loop as the summary.
export async function runCorrection(io, { fields, note = '', ...opts }) {
  const s = createSession(io, opts);
  s.ctx.fields = { ...fields };
  io.update({ fields: { ...fields } });
  return s.guard(async () => {
    const clean = note.trim().replace(/[.।!?\s]+$/u, ''); // the sentence template adds its own full stop
    if (clean) await s.io.say(t(s.L(), 'fixIntro', { note: clean }));
    await s.confirmAll();
    s.io.update({ current: 'done' });
    return s.result('ready');
  });
}

// aiExtract(field, text, lang) / aiIntent(text, lang) / aiStory(text, lang): optional
// AI helpers, only passed in when the citizen agreed to AI. They may return null.
//   aiStory → { fields: { <fieldId>: value }, facts: [{ en, local }] }
function createSession(io, { today = new Date(), aiExtract = null, aiIntent = null, aiStory = null } = {}) {
  const ctx = { problem: '', fields: {}, facts: [], transcript: [], outcome: null };
  const L = () => io.getLang();
  const result = (outcome, extra = {}) => ({
    outcome,
    lang: L(),
    problem: ctx.problem,
    facts: [...ctx.facts],
    fields: { ...ctx.fields },
    transcript: [...ctx.transcript],
    ...extra,
  });

  // Ask one question. Every answer is first checked for an emergency and for
  // a language switch, then given to `parse` (null = not understood).
  async function q(promptFor, parse, { keyboard = false, long = false } = {}) {
    for (;;) {
      const prompt = promptFor(L());
      const r = await io.ask({
        prompt,
        keyboard,
        long,
        parse: async (text) => {
          if (isEmergency(text)) return { emergency: true };
          const lang = detectLanguageSwitch(text);
          if (lang && lang !== L()) return { switchTo: lang };
          const v = await parse(text);
          return v === null || v === undefined ? null : { value: v };
        },
      });
      if (r.status !== 'answer') throw new Stop(result('aborted'));
      ctx.transcript.push({ q: prompt, a: r.text, via: r.via ?? 'voice' });

      if (r.value.emergency) {
        io.update({ emergency: true });
        await io.say(t(L(), 'emergency'));
        throw new Stop(result('emergency'));
      }
      if (r.value.switchTo) {
        io.setLang(r.value.switchTo);
        await io.say(t(L(), 'languageChanged'));
        continue; // ask the same question again, now in the new language
      }
      return { value: r.value.value, text: r.text };
    }
  }

  async function askField(field) {
    io.update({ current: field.id });
    let rejections = 0;
    for (;;) {
      const typing = rejections >= REJECTIONS_BEFORE_TYPING;
      const lead = (lang) => (rejections === 0 ? '' : `${t(lang, typing ? 'pleaseType' : 'sayAgain')} `);
      const { value } = await q(
        (lang) => lead(lang) + field.question[lang],
        // Built-in parser first; if it cannot read the answer and AI is allowed,
        // ask the AI. Either way the value is read back and must be confirmed.
        async (text) =>
          parseFieldAnswer(field, text, { today, fields: ctx.fields }) ??
          (aiExtract ? await aiExtract(field, text, L()) : null),
        { keyboard: typing },
      );

      // Show it big on screen and read it back (numbers and dates digit by digit).
      io.update({ pending: { fieldId: field.id, value } });
      const { value: yes } = await q(
        (lang) => t(lang, 'confirmHeard', { value: speakFieldValue(field, value, lang).replace(/[.।\s]+$/u, '') }),
        parseYesNo,
      );
      io.update({ pending: null });
      if (yes === 'yes') {
        ctx.fields[field.id] = value;
        io.update({ fields: { ...ctx.fields } });
        return;
      }
      rejections += 1;
    }
  }

  async function notDeposit() {
    io.update({ current: 'other' });
    await io.say(t(L(), 'wrongRequest'));
    const { value } = await q((lang) => t(lang, 'offerNote'), parseYesNo);
    const noted = value === 'yes';
    await io.say(t(L(), noted ? 'noted' : 'notNoted'));
    return result('other', { noted });
  }

  // ---- 1. The problem ----
  async function askProblem() {
    io.update({ current: 'describe' });
    let tries = 0;
    for (;;) {
      const { text } = await q(
        (lang) => t(lang, tries === 0 ? 'greeting' : 'describeAgain'),
        (s) => (s.trim() ? s.trim() : null),
        { long: true }, // the whole story: until a ~3 s pause or the "done" tap
      );
      ctx.problem = ctx.problem ? `${ctx.problem} ${text}` : text;
      io.update({ problem: ctx.problem });

      let intent = detectIntent(text).intent;
      // Keywords missed it? With AI allowed, ask the AI before saying "not a deposit problem".
      if (intent === 'other' && aiIntent) intent = (await aiIntent(text, L())) ?? intent;
      if (intent === 'emergency') {
        io.update({ emergency: true });
        await io.say(t(L(), 'emergency'));
        throw new Stop(result('emergency'));
      }
      if (intent !== 'deposit') {
        ctx.outcome = await notDeposit();
        return;
      }
      const { value } = await q((lang) => t(lang, 'confirmDeposit'), parseYesNo);
      if (value === 'yes') return;
      tries += 1;
      if (tries >= MAX_DESCRIBE_TRIES) {
        ctx.outcome = await notDeposit();
        return;
      }
    }
  }

  // ---- 1b. AI mode: details and extra facts already in the story ----
  // Returns true when at least one field was found (and confirmed).
  async function fromStory() {
    if (!aiStory || !ctx.problem) return false;
    io.update({ current: 'story', phase: 'thinking' });
    const story = await aiStory(ctx.problem, L());
    const found = FIELDS.filter((f) => story?.fields?.[f.id] && isValidFieldValue(f, story.fields[f.id]));
    ctx.facts = (story?.facts ?? []).filter((x) => x?.en && x?.local).slice(0, 4);
    if (!found.length) return false;
    for (const f of found) ctx.fields[f.id] = story.fields[f.id];
    io.update({ fields: { ...ctx.fields } });

    for (;;) {
      io.update({ current: 'story' });
      const lines = FIELDS.filter((f) => ctx.fields[f.id]).map((f) => `${f.label[L()]}: ${displayFieldValue(f, ctx.fields[f.id], L())}`);
      const facts = ctx.facts.length ? ` ${t(L(), 'storyFacts', { facts: ctx.facts.map((x) => x.local.replace(/[.।\s]+$/u, '')).join('; ') })}.` : '';
      await io.say(`${t(L(), 'storyNoted')} ${lines.join('. ')}.${facts}`);
      const { value: answer } = await q((lang) => t(lang, 'storyAsk'), summaryAnswer);
      if (answer.done) return true;
      const fieldId = answer.field ?? (await q((lang) => t(lang, 'whichField'), detectFieldToChange)).value;
      await askField(getField(fieldId));
    }
  }

  // "Yes" → done; "change the amount" → that field; plain "no" → ask which one.
  function summaryAnswer(s) {
    const yn = parseYesNo(s);
    const field = detectFieldToChange(s);
    if (yn === 'yes' && !field) return { done: true };
    if (field) return { field };
    if (yn === 'yes') return { done: true };
    if (yn === 'no') return { field: null };
    return null;
  }

  // ---- 3. Summary and corrections, until the user says everything is correct ----
  async function confirmAll() {
    for (;;) {
      io.update({ current: 'summary' });
      const lines = FIELDS.map((f) => `${f.label[L()]}: ${displayFieldValue(f, ctx.fields[f.id], L())}`);
      await io.say(`${t(L(), 'summaryIntro')} ${lines.join('. ')}.`);

      const { value: answer } = await q((lang) => t(lang, 'summaryAsk'), summaryAnswer);
      if (answer.done) break;

      const fieldId = answer.field ?? (await q((lang) => t(lang, 'whichField'), detectFieldToChange)).value;
      await askField(getField(fieldId));
    }
  }

  // Runs a flow; an emergency or cancel anywhere ends it with that outcome.
  async function guard(flow) {
    try {
      return await flow();
    } catch (err) {
      if (err instanceof Stop) return err.result;
      throw err;
    }
  }

  return { io, ctx, L, q, askField, askProblem, fromStory, confirmAll, result, guard };
}
