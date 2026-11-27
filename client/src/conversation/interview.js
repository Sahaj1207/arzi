// The citizen interview (core flow steps 2–3), as one readable async script.
//
//   1. Listen to the problem → deposit? → "Is that right? Say yes or no."
//      Not a deposit problem → say so, offer to note it for an advocate.
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
} from '@arzi/shared';

class Stop extends Error {
  constructor(result) {
    super(result.outcome);
    this.result = result;
  }
}

const MAX_DESCRIBE_TRIES = 2;
const REJECTIONS_BEFORE_TYPING = 2;

export async function runInterview(io, opts = {}) {
  const s = createSession(io, opts);
  return s.guard(async () => {
    await s.askProblem();
    if (s.ctx.outcome) return s.ctx.outcome; // not a deposit problem
    for (const field of FIELDS) await s.askField(field);
    await s.confirmAll();
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

function createSession(io, { today = new Date() } = {}) {
  const ctx = { problem: '', fields: {}, transcript: [], outcome: null };
  const L = () => io.getLang();
  const result = (outcome, extra = {}) => ({
    outcome,
    lang: L(),
    problem: ctx.problem,
    fields: { ...ctx.fields },
    transcript: [...ctx.transcript],
    ...extra,
  });

  // Ask one question. Every answer is first checked for an emergency and for
  // a language switch, then given to `parse` (null = not understood).
  async function q(promptFor, parse, { keyboard = false } = {}) {
    for (;;) {
      const prompt = promptFor(L());
      const r = await io.ask({
        prompt,
        keyboard,
        parse: (text) => {
          if (isEmergency(text)) return { emergency: true };
          const lang = detectLanguageSwitch(text);
          if (lang && lang !== L()) return { switchTo: lang };
          const v = parse(text);
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
        (text) => parseFieldAnswer(field, text, { today, fields: ctx.fields }),
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
      );
      ctx.problem = ctx.problem ? `${ctx.problem} ${text}` : text;
      io.update({ problem: ctx.problem });

      if (detectIntent(text).intent !== 'deposit') {
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

  // ---- 3. Summary and corrections, until the user says everything is correct ----
  async function confirmAll() {
    for (;;) {
      io.update({ current: 'summary' });
      const lines = FIELDS.map((f) => `${f.label[L()]}: ${displayFieldValue(f, ctx.fields[f.id], L())}`);
      await io.say(`${t(L(), 'summaryIntro')} ${lines.join('. ')}.`);

      const { value: answer } = await q(
        (lang) => t(lang, 'summaryAsk'),
        (s) => {
          const yn = parseYesNo(s);
          const field = detectFieldToChange(s);
          if (yn === 'yes' && !field) return { done: true };
          if (field) return { field };
          if (yn === 'yes') return { done: true };
          if (yn === 'no') return { field: null };
          return null;
        },
      );
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

  return { io, ctx, L, q, askField, askProblem, confirmAll, result, guard };
}
