# Arzi — Project Brief (Scaler x Wispr Flow "India Runs on Voice", Round 2)

Read this whole file before writing any code. It is the source of truth for what we are building and the hackathon rules the code must pass.

## 1. What Arzi is

Arzi lets ordinary Indians create a legal document by **speaking**, gets it checked by an advocate, then reads it back so the person understands exactly what they are agreeing to.

- Theme: **Public infrastructure and civic services**
- One-liner: "Speak your legal problem, get a lawyer-verified document."
- Round 2 scope: **one narrow use case, working end to end.** Not a full product.

### The one use case for this prototype
**A legal notice to a landlord / PG owner for an unreturned security deposit.**
Real, frequent (tenants, students in PGs and hostels), one standard format, easy to test with real users.

## 2. Users
- **Citizen:** tenants, students, workers. Many have low literacy or are not comfortable typing. Speak Hindi, Marathi, English, Telugu (added after step 8), or a mix (Hinglish). Strong regional accents. Often on cheap Android phones, in noisy places.

### Languages
- **Fully supported, no keys needed:** Hindi (`hi-IN`), Marathi (`mr-IN`), English (`en-IN`), and **Telugu (`te-IN`)**. Telugu is added **only after step 8 works end to end in Hindi, Marathi and English**. A Telugu-speaking teammate checks the translations and tests by voice. Telugu needs the same pieces as the others: UI and spoken strings, field questions, number words, month names, yes/no and intent keywords, the plain-language summary template, digit-by-digit read-back, and a bundled Noto Sans Telugu font for the PDF.
- **Beta languages (lowest priority, cut first if time runs short):** only when `SARVAM_API_KEY` is set, offer the other Indian languages Sarvam supports. They use Sarvam speech-to-text (and Sarvam text-to-speech where available) plus the LLM for field extraction and the translated summary, since we have no hand-written parsers or templates for them. They are **clearly labelled "Beta"** in the UI. Without a Sarvam key they are **still shown in the picker, greyed out and not selectable, with the note "Needs Sarvam key"**, so judges can see the feature exists.
- **Telugu read-back voice:** many browsers have no Telugu text-to-speech voice. If the browser has none **and** a Sarvam key is set, use **Sarvam text-to-speech** for Telugu. With no key and no browser voice, fall back to on-screen text highlighting.

### Advocate
- Reviews and approves drafts on a laptop or phone.

## 3. Core flow (must work end to end, citizen never has to type)

1. **Welcome.** Home screen: one big microphone button + language picker (Hindi, Marathi, English; Telugu later; Beta languages only with a Sarvam key, see "Languages"). Arzi speaks first: greets and asks the user to describe their problem.
2. **Describe the problem.** User speaks freely. Show live transcript. Arzi confirms: "Your landlord has not returned your deposit. I will make a legal notice. Is that right? Say yes or no."
3. **Follow-up questions by voice, one at a time.** Ask for each field, show each answer as a filled card:
   - your full name
   - your address (the rented property)
   - landlord / owner name
   - landlord address
   - deposit amount
   - date you moved out / vacated
   - date deposit was due / how long it has been pending
   After all fields, read back a summary and ask "Is everything correct?" Allow correcting any single field by voice ("Change the amount").
4. **Draft.** Generate the legal notice in formal English legal-notice format, plus a simple-language summary in the user's chosen language below it. Status: "Sent to advocate for checking".
   - **Notice content rules:** the notice is sent by the **tenant in their own name** (not by the advocate on their behalf), and carries the line **"Reviewed by Advocate [name]"**. It gives the landlord **15 days** to pay. It claims **the deposit amount only**, plus a line reserving the right to claim interest and legal costs in legal proceedings.
5. **Advocate review.** `/advocate` page: list of pending drafts, each with transcript, filled fields and the draft. Advocate can edit the text, then **Approve** or **Request changes** with a short note. Use one demo advocate (no real accounts). The page is protected by a simple **demo PIN** with a built-in default of `1234` (overridable with `ADVOCATE_PIN` in `.env`, documented in the README) so it works with no `.env`.
   - **Small fixes:** the advocate edits the notice text directly; approving with edits saves a new version written by the advocate.
   - **Request changes:** the citizen's status page shows the advocate's note and a **"Fix my details"** button. Arzi reads the note aloud, the citizen corrects any detail by voice (same "change the amount" flow as the summary), and the redrafted notice goes back to the advocate as the next version (version 2, 3, …) with status "Sent to advocate for checking".
   - The "Reviewed by Advocate [name]" line appears only on approved documents.
6. **Read-back + voice consent.** When approved, Arzi reads aloud the **plain-language summary of the approved notice in the user's language**, point by point (who it is sent to, the amount claimed, the deadline given, what happens next). The English legal notice itself is shown on screen; the user can also ask to hear it in English. Then Arzi asks: "Did you understand this document and do you agree? Say: yes, I understood and I agree." Record the user's spoken answer (audio file) and save it with the document.
7. **History.** User's history page: each document with status, date, final PDF download, the consent recording (playable), and earlier versions. Share to WhatsApp via a share link/intent.

**Demo helpers and comfort controls (added before the Render deploy):**
- **"Try a sample case"** (home screen): auto-plays the real voice interview with pre-typed sample answers shown word by word on screen (a scripted speech provider; no mic, no keys), then the demo advocate auto-approves it and the read-back + consent screen opens. A **"Skip to an approved document"** link goes straight there. Only sample cases can be auto-approved.
- **Consent before AI:** when an outside AI service is configured (Sarvam / Anthropic / Wispr keys), Arzi asks once per session, before anything is sent, whether that is okay. "No" keeps the session on browser speech and demo drafting. Never asked without keys, never in the sample case.
- **Read-back controls:** Pause / Continue, Repeat this point, Slower / Faster (speed remembered on the device).

**Identity (keep it simple):** no login or OTP in the prototype. Give each citizen an anonymous ID stored in the browser (localStorage) so their history persists on that device. The citizen screen shows the document status and updates automatically (simple polling) when the advocate approves or requests changes.

## 4. When things go wrong (judges will check this — it was promised in our Activity 2 prompt)
- **Noise / low confidence:** "I could not hear you clearly. Please move to a quieter place or hold the phone closer, and try again." After 2 failed attempts, show a keyboard fallback.
- **Accents / misheard input:** never assume. Repeat every key fact back and confirm. Show numbers and dates large on screen and read them digit by digit. Show name spellings and allow correction by voice. Parse amounts spoken as words in Hindi/Marathi/English (e.g. "bees hazaar", "twenty thousand") as well as digits; if parsing fails, ask again rather than guess.
- **Mixed languages:** accept Hindi-English (and Marathi-English) mixed speech. Reply in the user's chosen language; switch if the user says e.g. "Speak in Marathi".
- **Silence:** if no speech for 8 seconds, repeat the question once, then pause with a "Tap to continue" button.
- **Wrong request:** if the problem is not a deposit issue, say politely this prototype only handles deposit notices and offer to note it for an advocate. If the user mentions violence or an emergency, immediately show emergency number **112** and stop drafting.

## 5. Hackathon rules the code MUST pass (non-negotiable)
- **Public GitHub repo.** Created with `gh`; push after every build step.
- **`docker-compose.yml` at repo root.** Judges start the app with one command: `docker compose up`. Test this from a fresh clone.
- **Must start and show its main screen with NO secret keys.** Judges will not add any API keys. Any feature needing a key must degrade gracefully (show "key not set" / use demo mode), never crash.
- **~300+ lines of our own new code written during the hackathon.** No starter template with small changes. Commit often with clear messages (commit history proves when code was written).
- Deadline: **30 Nov 2026, 11:59 pm IST.** One submission only.
- Also submitted (not code): YouTube demo ≤3 min, pitch deck PDF, optional live link (must work until 2 Dec).

## 6. Technical decisions (designed around the no-keys rule)
- **Speech-to-text, behind one pluggable "speech provider" interface:**
  - **Default (no key): browser Web Speech API** (`SpeechRecognition`, lang `hi-IN`, `mr-IN`, `en-IN`, later `te-IN`). Works in Chrome/Edge on desktop and Android; needs localhost or HTTPS. Detect support and show a clear message on unsupported browsers. Verify Marathi early.
    - Chrome's Web Speech sends audio to Google, so it **needs internet**.
    - It rarely gives a usable confidence score, so "low confidence" in practice means **no result, an empty result, or a very short result**.
    - A phone opening the app via the laptop's LAN IP gets **no mic access** (needs HTTPS or localhost). Phone testing uses the HTTPS Render deploy (section 6, Deploy).
  - **Optional (recommended upgrade): Sarvam AI** (docs: https://docs.sarvam.ai). Used only if `SARVAM_API_KEY` is set. Self-serve signup with free credits. Speech-to-text model `saaras:v3` (22 Indian languages, handles code-mixed speech like Hinglish, noise-robust). Official Node.js SDK available. Check the current docs for exact model names and request formats before coding.
  - **Optional free backup: Groq** (`GROQ_API_KEY`, docs: https://console.groq.com/docs/speech-to-text). Speech-to-text only, model `whisper-large-v3`. **Fallback order: Sarvam → Groq → browser speech.** The server retries the same recording with Groq when Sarvam fails. It counts its own Groq requests against the free plan (20/minute, 2,000/day; `GROQ_REQUESTS_PER_*`), respects `retry-after` on a 429, and on any Groq error the browser falls back to its own speech. Covered by the same consent question. Shown in the footer status line.
  - **Optional: Wispr Flow Voice Interface API** (docs: https://api-docs.wisprflow.ai). Used only if `WISPR_API_KEY` is set. Access is approval-only (enterprise@wisprflow.ai), so the app must never depend on it. Notes from the docs: expects base64-encoded 16 kHz PCM WAV audio (browser MediaRecorder gives webm, so convert to WAV); WebSocket endpoint recommended, REST available; keep the API key on the backend (or use their client access tokens). Without approved access the adapter is written against the docs only and marked **"untested"** in the README.
  - Show the active provider in the UI ("Browser speech" / "Sarvam" / "Wispr Flow").
  - **Automatic fallback:** if a paid provider errors, times out, or runs out of credits, switch to browser speech for that session and keep going. Never leave the user stuck.
- **Text-to-speech (read-back):** default browser `speechSynthesis`; pick the best available voice for the language. Optional: Sarvam text-to-speech (`bulbul` models) when `SARVAM_API_KEY` is set, for more natural Indian-language voices (verify Marathi voice support). If no voice is available, fall back to on-screen text highlighting.
- **Drafting:**
  - **Demo mode (default, no key):** detect the deposit problem with simple keyword matching in Hindi, Marathi and English (e.g. deposit, security, advance, जमा, डिपॉज़िट, अनामत), then fill a well-written legal-notice template from the collected fields + a template-based summary in Hindi / Marathi / English. Must always work.
  - **AI mode (optional):** if an LLM key (`SARVAM_API_KEY` or `ANTHROPIC_API_KEY`) is set, use the LLM to understand free-form speech better and polish the draft. Show a small badge "Demo mode" vs "AI mode".
  - **Name transliteration (step 9, needs `SARVAM_API_KEY`):** names and addresses spoken in Devanagari or Telugu script are transliterated into English letters for the **English notice**; the **summary keeps the original script**. Without a key, the original script is used in the notice (the advocate can edit it).
- **API keys:** read only on the backend from `.env`. Never send keys to the browser and never commit `.env`. Add a simple per-user usage limit on paid API calls so a public live link cannot burn all credits.
- **Consent recording:** `MediaRecorder` in the browser, upload to backend, store on disk. Risk: on some Android phones, recording and speech recognition fight over the mic. Test early; if it fails, record the audio and confirm the answer with a big "I understood and I agree" button as backup.
- **Usage limit:** per anonymous ID **and** per IP daily cap on paid API calls (the localStorage ID is easy to reset).
- **Backend:** Node.js + Express, **SQLite via `better-sqlite3`** (compiled inside the Docker build stage). Store users, documents, versions, field values, advocate notes, recording file paths.
- **Code layout:** npm workspaces — `shared/` (pure parsers, intent, i18n, field definitions; used by client and server), `server/` (Express API, SQLite, providers, drafting, PDF), `client/` (React + Vite). One Node service serves both API and built frontend on port 3000. Plain JavaScript (ES modules).
- **PDF:** rendered server-side by **headless Chromium (Puppeteer) from an HTML template**, using the bundled Noto Sans Devanagari font, so Hindi/Marathi conjuncts render correctly. Chromium is part of the image from step 1 so the full Docker build is proven early. **If PDF generation fails, the app keeps running** and the UI falls back to a printable page (browser print-to-PDF).
- **Frontend:** React (Vite), mobile-first, large text, high contrast, big touch targets, works for older users. Every step usable by voice alone; buttons as backup.
- **Docker:** one `docker-compose.yml`, app on port 3000, volume for the SQLite DB and recordings. The image must build on a clean machine (make sure any native modules, e.g. SQLite drivers, compile inside the image).
- **Deploy:** after build step 8, deploy to **Render** (Docker, HTTPS) so the voice flow can be tested on real phones; this is also the optional live link (must work until 2 Dec).
  - **Free tier** (`render.yaml`). No disk, so data is wiped on restart: sample cases (one pending, one approved, one "other problem") are seeded on every startup; the demo advocate is config only (PIN 1234).
  - Measured in Docker with Render-free limits: Chromium peak ~230 MB real memory (fits 512 MB, closed after 60 s idle), but at **0.1 CPU the first PDF takes ~55 s**. So the live link sets **`PDF_ENGINE=print`** (print-to-PDF page); `docker compose up` keeps real Chromium PDFs.
  - The user keeps it awake with an uptime ping to `/api/health`.
- Include `.env.example` (all keys optional, documented) and a clear `README.md`: what Arzi is, how to run (`docker compose up`, open http://localhost:3000 in Chrome), demo mode vs AI mode, browser support notes.
- Show a small "Prototype — not legal advice" note in the UI.

## 7. Definition of done
- [x] Fresh clone → `docker compose up` → main screen loads at localhost:3000 with no `.env`.
- [ ] Citizen completes steps 1–7 entirely by voice in Hindi and in English (Marathi if browser supports it). *(Flow verified with the scripted sample and typed answers; still to test with a real phone mic on the live link.)*
- [x] Advocate can approve and request changes at `/advocate`.
- [x] Consent recording is saved and playable in history; PDF downloads.
- [x] All error cases in section 4 behave as described.
- [x] With a Sarvam key set, speech uses Sarvam; removing the key or exhausting credits falls back to browser speech without errors.
- [x] PDF shows Hindi/Marathi text correctly.
- [ ] (After step 8) Telugu works end to end by voice, translations checked by the Telugu-speaking teammate; PDF shows Telugu correctly. *(Built and PDF font bundled; waiting for the teammate's review.)*
- [x] (After step 8) With a Sarvam key and no browser Telugu voice, Telugu read-back uses Sarvam text-to-speech.
- [ ] (Optional, lowest priority) With a Sarvam key, Beta languages are selectable and labelled "Beta"; without a key they show greyed out with "Needs Sarvam key".
- [x] README complete; commits are frequent and meaningful.

## 8. How to work
- Plan the structure first and show it to me before writing lots of code.
- Build in small working steps; commit after each working step and push to GitHub.
- After every step, check that `docker compose up` still builds and starts (main screen loads at localhost:3000). Only report it to the user if something breaks.
- Explain briefly what you built after each step so I understand the codebase (I will be asked about it at the finale).
- **This file is a living document.** If I give an instruction that conflicts with this file, follow my latest instruction, then update the relevant section of this file and add a dated line to the Decisions log below, so the file always matches what we are actually building. If something here is unclear or seems wrong, ask me before guessing.

## 9. Decisions log
- 2026-11-27: Brief created. Use case: deposit legal notice. Default speech: browser; optional Sarvam / Wispr Flow API.
- 2026-11-27: Plan approved. Single Node/Express service + React (Vite), npm workspaces (shared/server/client), plain JS, SQLite via better-sqlite3.
- 2026-11-27: Notice sent by tenant in own name with "Reviewed by Advocate [name]"; 15-day deadline; deposit only, plus a line reserving the right to claim interest and legal costs.
- 2026-11-27: Advocate page protected by demo PIN, default `1234` (override `ADVOCATE_PIN`), documented in README.
- 2026-11-27: PDF via headless Chromium (Puppeteer); Chromium included from step 1; if PDF fails, app keeps running and falls back to browser print-to-PDF.
- 2026-11-27: Public GitHub repo created with gh; push after each build step.
- 2026-11-27: Accepted brief corrections: Web Speech needs internet; "low confidence" = no/empty/very short result; phones need HTTPS for mic; Android consent mic-contention fallback button; Wispr adapter marked untested; usage limit per ID and per IP.
- 2026-11-27: After step 8, deploy to Render (HTTPS) for phone testing.
- 2026-11-27: Fresh-clone `docker compose up` test before step 2; after every step re-check that the Docker build starts, report only failures.
- 2026-11-27: Build order: 1 skeleton+Docker+Chromium, 2 shared parsers/tests, 3 voice layer, 4 conversation machine, 5 documents API + demo drafting, 6 advocate page, 7 read-back + consent, 8 PDF + history, then Render deploy, 9 optional providers, 10 README/polish.
- 2026-11-27: Telugu (`te-IN`) becomes the 4th fully supported language, added only after step 8 works in hi/mr/en; a Telugu-speaking teammate reviews translations and tests by voice.
- 2026-11-27: "Beta languages" mode: with a Sarvam key, offer Sarvam's other Indian languages via Sarvam speech + LLM extraction/summaries, labelled "Beta"; hidden without a key. Lowest priority.
- 2026-11-27: Updated build order after step 8: Render deploy → Telugu → 9 optional providers (Sarvam, Anthropic, Wispr) → 10 README/polish → Beta languages (needs step 9's Sarvam + LLM). Cut order if short on time: Beta languages first, then Wispr, then Sarvam text-to-speech.
- 2026-11-27: Changed: without a Sarvam key, Beta languages are shown greyed out with "Needs Sarvam key" (not hidden), so judges can see them.
- 2026-11-27: With a Sarvam key, Telugu read-back uses Sarvam text-to-speech when the browser has no Telugu voice (so Sarvam TTS for Telugu is kept even if general Sarvam TTS is cut).
- 2026-11-27: Request changes → citizen sees note + "Fix my details", corrects by voice, redraft goes back as the next version. Advocate can also edit the text directly for small fixes.
- 2026-11-27: Step 9 adds Sarvam transliteration of Devanagari/Telugu names and addresses into English letters for the English notice; summary keeps the original script.
- 2026-11-27: Demo advocate default name "R. Mehta (demo)" (override `ADVOCATE_NAME`). "Reviewed by Advocate" line shown only once approved.
- 2026-11-27: Live link on Render **free tier** (not Starter). Sample cases seeded on every startup. Live link uses `PDF_ENGINE=print` because 0.1 CPU makes Chromium PDFs take ~55 s (memory fits). User sets up an uptime ping.
- 2026-11-27: Deployed via Render Blueprint `exs-dc4ionm1egvs738j6fkg` → service `arzi-2p1d`, live at https://arzi-2p1d.onrender.com (Singapore, free, auto-deploys on push to main).
- 2026-11-27: Default language is English unless the browser prefers Hindi or Marathi; a saved choice always wins. Headline shortened to "Speak your problem. Get a lawyer‑checked notice." (non-breaking hyphen), max 44px, ≤3 lines in all languages.
- 2026-11-27: Visual style: warm cream background, soft white surfaces with shadows instead of outlines, pill buttons, Mukta for all text, one serif accent word (Noto Serif Devanagari) in the home headline; centred hero with the mic below. Logo and language names are translate="no".
- 2026-11-27: Advocate desk uses its own field labels: Tenant name, Tenant address, Landlord name, Landlord address, Deposit amount, Date vacated, Pending since (`advocateLabel` in shared/src/fields.js).
- 2026-11-27: Telugu started as a DRAFT: all text in shared/src/i18n-te.js + fields, parsers (numbers, months, yes/no, intent, consent, names), summary template, sample case, Noto Sans Telugu for app and PDF. Hidden from the picker until a device opens `/?telugu=1` (marked `review: true` in languages.js); remove that flag once the Telugu-speaking teammate approves `docs/telugu-review.md` (regenerate with `npm run review:telugu`).
- 2026-11-27: Step 9 (Sarvam) built against the current docs: STT `saaras:v4` (not v3, now legacy; webm accepted, clips < 30 s), TTS `bulbul:v3`, chat `sarvam-105b-conversations` (`sarvam-m` no longer exists), `/transliterate` to `en-IN`. All behind the once-per-session consent; any failure (incl. 429 / insufficient_quota) switches the session to browser speech and re-asks the question.
- 2026-11-27: Sarvam verified live with the real key (TTS hi/te, STT round trip, LLM extraction + intent, transliteration incl. Telugu) and the consent prompt in the app.
- 2026-11-27: AI scope decisions: Sarvam TTS only when the browser has no voice for the language (saves credits); the LLM only classifies the problem and proposes values the built-in parser could not read (always read back + confirmed); the legal notice wording stays the template. Names/addresses transliterated for the English notice only. Wispr and Anthropic not wired yet (keys ignored). Paid-call caps raised to 150/user and 500/IP per day.
- 2026-11-27: Added before deploy: "Try a sample case" (scripted voice interview → demo auto-approve → read-back) + "Skip to an approved document"; consent prompt once per session before any outside AI service; read-back controls (pause/continue, repeat point, slower/faster).
- 2026-11-27: Step 10 (README + polish): README rewritten for judges (2-minute tour, flow diagram, error-handling table, Demo vs AI mode, language status, key files). Tests set `ARZI_IGNORE_DOTENV` so they never read a developer's real `.env` keys or spend Sarvam credits. Added a favicon; removed unused code.
- 2026-11-27: Render PDF checked: the logs show no Chromium error. `pdf: print` is deliberate (`PDF_ENGINE=print` in render.yaml) because the free tier's 0.1 CPU makes Chromium PDFs take ~55 s; memory is fine. Kept print, and made the printable page work on phones: mobile layout, a big "Save as PDF" button in the citizen's language with a hint, auto print dialog only on computers, none on WhatsApp share links. The file name is `arzi-legal-notice-<id>-v<n>`.
- 2026-11-27: Groq added as a free backup speech-to-text provider (`GROQ_API_KEY`, `whisper-large-v3`). Order: Sarvam → Groq → browser. Groq is used for STT only (voice and LLM stay Sarvam). There is our own limiter at 20/min and 2,000/day, plus retry-after; any error → browser. The consent question now names all services: "outside AI services (Sarvam AI, Groq)" in en/hi/mr/te (the Telugu sentence changed; the review sheet was regenerated). Tests use fake Sarvam/Groq servers and never read the real .env.
- 2026-11-27: Added a short Telugu review sheet, `docs/telugu-review-short.md` (the 7 questions + 5 summary points, English | Telugu | Correction, under 20 lines), generated from the code by `npm run review:telugu-short`. `npm run review:telugu` now rebuilds both sheets. English summary rows use English sample addresses.
