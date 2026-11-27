# Arzi — अर्ज़ी

**Speak your legal problem, get a lawyer-verified document.**

Arzi lets a tenant create a legal notice for an unreturned security deposit just by speaking, in Hindi, Marathi or English (or a mix). An advocate checks the draft, then Arzi reads the approved notice back in the person's language and records their spoken consent.

> Prototype for Scaler x Wispr Flow "India Runs on Voice", Round 2. **Not legal advice.**

## Run it

```bash
docker compose up
```

Open **http://localhost:3000** in **Google Chrome** (or Microsoft Edge). No `.env` and no API keys are needed.

- Advocate page: **http://localhost:3000/advocate**, demo PIN **`1234`** (change with `ADVOCATE_PIN`).
- Data (SQLite DB, consent recordings, PDFs) is kept in the `arzi-data` Docker volume.
- Sample cases are added on every start, so the advocate desk is never empty.

## Quick demo (no microphone needed)

On the home screen:

- **Try a sample case** — the real voice interview runs with pre-typed answers appearing word by word, as if spoken. Arzi asks, reads back and confirms every answer. The demo advocate then approves it, and the read-back and consent screen opens.
- **Skip to an approved document** — straight to the read-back, consent, PDF and WhatsApp.

During the read-back: **Pause / Continue**, **Repeat this point**, **Slower / Faster** (speed is remembered on the device). Say "English" to hear the full notice in English.

If an AI key is set, Arzi asks once per session before anything is sent to an outside AI service; saying no keeps the session on browser speech and demo drafting.

## Live demo on Render (free tier)

[`render.yaml`](render.yaml) deploys the same Docker image with HTTPS (needed for the microphone on phones). Free tier limits and what Arzi does about them:

| Limit | What Arzi does |
|---|---|
| No disk: data is wiped on restart/redeploy | Sample cases are re-created on every start |
| 0.1 CPU: a Chromium PDF takes ~55 s | `PDF_ENGINE=print`: "Download PDF" opens the print page (Save as PDF) |
| Sleeps after 15 min idle | Ping `/api/health` every 5–10 min with an uptime monitor |

## Demo mode vs AI mode

| | Demo mode (default, no keys) | With keys (optional) |
|---|---|---|
| Speech-to-text | Browser Web Speech API | Sarvam AI (`SARVAM_API_KEY`) or Wispr Flow (`WISPR_API_KEY`, adapter untested) |
| Voice read-back | Browser speech synthesis | Sarvam text-to-speech |
| Drafting | Keyword detection + legal-notice template | LLM via Anthropic or Sarvam (badge shows "AI mode") |

All keys are optional and read only by the backend. See [`.env.example`](.env.example). If a paid provider fails or runs out of credits, Arzi falls back to browser speech automatically.

## Browser notes

- Voice input needs **Chrome or Edge** (desktop or Android). Other browsers show a message and a keyboard fallback.
- Chrome's speech recognition sends audio to Google, so it **needs an internet connection**.
- The microphone only works on **https://** or **localhost**. Opening the app from a phone via your laptop's LAN IP will not get mic access; use the HTTPS live link instead.
- PDFs are rendered with headless Chromium inside the Docker image (one at a time; Chromium is closed after 60 s idle to free memory). If that fails, or `PDF_ENGINE=print` is set, the app keeps running and offers the browser's **Print → Save as PDF** instead.

## Development (without Docker)

Requires Node.js 22+.

```bash
npm install
npm run build        # build the React app into client/dist
npm start            # API + app on http://localhost:3000
```

For live reload, run `npm run dev:server` and `npm run dev:client` in two terminals, then open http://localhost:5173.

## Project layout

```
shared/   language list, all spoken/displayed text, parsers (used by client + server)
server/   Express API, SQLite (better-sqlite3), providers, drafting, PDF (Chromium)
client/   React + Vite frontend (mobile-first, voice-first)
```

Fonts: Noto Sans Devanagari (SIL Open Font License, see `server/assets/fonts/OFL-LICENSE.txt`).
