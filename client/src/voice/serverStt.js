// Speech-to-text through the server (Sarvam saaras:v4, or Groq whisper-large-v3 if
// Sarvam fails; the server picks). Same interface as browserStt.
// The browser records the answer (MediaRecorder, webm/opus), watches the volume to
// notice when the person starts and stops talking, then uploads the clip.
// Any server/provider failure returns { status: 'provider_failed' } and the caller
// switches the session to browser speech.
//
// Speed:
//   - prepareMic() asks for the microphone on the first tap and keeps the stream
//     open for the interview, so each answer starts recording at once.
//   - While recording, the browser's own recognition shows the words live as a
//     preview (desktop only: on Android two users of the mic can break the recording).
//     The server's transcript replaces the preview when it arrives.
//   - Long answers (the problem story, up to 2 minutes) are cut into 25 s pieces
//     (Sarvam's quick endpoint takes clips under 30 s); each piece is uploaded while
//     the person keeps talking, so only the last one is waited for.
import { getUserId } from '../lib/userId.js';
import { createBrowserStt } from './browserStt.js';
import { hasSpeechRecognition } from './support.js';

const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
const END_OF_SPEECH_MS = 1300; // quiet after speaking → short answer finished
const SEGMENT_MS = 25000; // under Sarvam's 30 s limit per clip
const MAX_SHORT_MS = 25000;
const MAX_LONG_MS = 120000;

const isAndroid = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
const previewStt = createBrowserStt();

export function createServerStt() {
  return {
    name: 'server',
    isSupported: () =>
      typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined',
    listen,
  };
}

// ---- one microphone stream for the whole interview ----
let warm = null; // Promise<MediaStream>
const live = (stream) => stream?.getAudioTracks().some((t) => t.readyState === 'live');

export function prepareMic() {
  if (!warm) {
    warm = navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .catch((err) => {
        warm = null;
        throw err;
      });
  }
  return warm;
}

export function releaseMic() {
  const p = warm;
  warm = null;
  p?.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => {});
}

async function getStream() {
  const s = await prepareMic();
  if (live(s)) return s;
  warm = null; // the track ended (another app took the mic, device unplugged): ask again
  return prepareMic();
}

async function upload(blob, lang, signal) {
  const qs = new URLSearchParams({ userId: getUserId(), lang, aiConsent: 'yes' });
  const res = await fetch(`/api/ai/stt?${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'audio/webm' },
    body: blob,
    signal,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(String(data?.error ?? res.status));
  return { text: String(data?.text ?? '').trim(), provider: data?.provider ?? null };
}

async function listen({ lang, onInterim = () => {}, signal, finishSignal, silenceMs = 8000, long = false, endPauseMs = 3000 } = {}) {
  let stream;
  try {
    stream = await getStream();
  } catch (err) {
    return { status: err?.name === 'NotAllowedError' ? 'denied' : 'error', text: '' };
  }
  if (signal?.aborted) return { status: 'aborted', text: '' };

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));

  // Live preview with the browser's recognition (words only for the screen).
  const previewAbort = new AbortController();
  let previewText = '';
  if (!isAndroid() && hasSpeechRecognition()) {
    previewStt
      .listen({
        lang,
        long: true,
        silenceMs: MAX_LONG_MS,
        endPauseMs: MAX_LONG_MS,
        signal: previewAbort.signal,
        onInterim: (t) => {
          previewText = t;
          if (t) onInterim(t);
        },
      })
      .catch(() => {});
  }

  // Each piece is a complete audio file: a fresh MediaRecorder per piece.
  const uploads = [];
  let rec = null;
  let pieceHasVoice = false;
  const startPiece = () => {
    const chunks = [];
    const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    r.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
    r.done = new Promise((resolve) => {
      r.onstop = () => resolve(new Blob(chunks, { type: (r.mimeType || mimeType || 'audio/webm').split(';')[0] }));
    });
    r.start(200);
    pieceHasVoice = false;
    return r;
  };
  const closePiece = (send) => {
    const r = rec;
    rec = null;
    if (!r) return;
    if (r.state !== 'inactive') r.stop();
    if (!send) return;
    const up = r.done.then((blob) => upload(blob, lang, signal));
    up.catch(() => {}); // handled when all pieces are awaited
    uploads.push(up);
  };
  rec = startPiece();

  const started = performance.now();
  let pieceStarted = started;
  let noiseFloor = 0.01;
  let heard = false;
  let lastVoice = started;
  const endAfter = long ? endPauseMs : END_OF_SPEECH_MS;
  const maxMs = long ? MAX_LONG_MS : MAX_SHORT_MS;

  const outcome = await new Promise((resolve) => {
    const onFinish = () => resolve(heard ? 'done' : 'silence');
    finishSignal?.addEventListener('abort', onFinish, { once: true });
    const tick = () => {
      if (signal?.aborted) return resolve('aborted');
      if (finishSignal?.aborted) return onFinish();
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += s * s;
      const rms = Math.sqrt(sum / samples.length);
      const now = performance.now();
      if (now - started < 300) noiseFloor = Math.max(noiseFloor, rms); // learn the room's noise
      const loud = rms > Math.max(0.02, noiseFloor * 2.5);
      if (loud) {
        if (!heard && !previewText) onInterim('…');
        heard = true;
        pieceHasVoice = true;
        lastVoice = now;
      }
      if (!heard && now - started > silenceMs) return resolve('silence');
      if (heard && now - lastVoice > endAfter) return resolve('done');
      if (now - started > maxMs) return resolve(heard ? 'done' : 'silence');
      // Long answer: hand over a finished piece and keep recording.
      if (long && now - pieceStarted > SEGMENT_MS) {
        closePiece(pieceHasVoice);
        rec = startPiece();
        pieceStarted = now;
      }
      setTimeout(tick, 60);
    };
    tick();
  });

  closePiece(outcome === 'done' && pieceHasVoice);
  previewAbort.abort();
  ctx.close().catch(() => {});

  if (outcome !== 'done' || !uploads.length) {
    await Promise.allSettled(uploads);
    return { status: outcome === 'done' ? 'unclear' : outcome, text: '' };
  }

  onInterim(previewText || '…');
  try {
    const parts = await Promise.all(uploads);
    const text = parts
      .map((p) => p.text)
      .filter(Boolean)
      .join(' ')
      .trim();
    onInterim(text);
    return { status: text.length >= 2 ? 'ok' : 'unclear', text, confidence: 1, provider: parts.at(-1)?.provider ?? null };
  } catch (err) {
    if (signal?.aborted) return { status: 'aborted', text: '' };
    return { status: 'provider_failed', reason: err?.message ?? 'network', text: '' };
  }
}
