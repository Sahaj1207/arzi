// Speech-to-text through the server (Sarvam saaras:v4). Same interface as browserStt.
// The browser records the answer (MediaRecorder, webm/opus), watches the volume to
// notice when the person starts and stops talking, then uploads the clip.
// Any server/provider failure returns { status: 'provider_failed' } and the caller
// switches the session to browser speech.
import { getUserId } from '../lib/userId.js';

const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
const END_OF_SPEECH_MS = 1300; // quiet after speaking → answer finished
const MAX_MS = 25000; // Sarvam's quick endpoint is for clips under 30 s

export function createServerStt() {
  return {
    name: 'sarvam',
    isSupported: () =>
      typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined',
    listen,
  };
}

async function listen({ lang, onInterim = () => {}, signal, silenceMs = 8000 } = {}) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (err) {
    return { status: err?.name === 'NotAllowedError' ? 'denied' : 'error', text: '' };
  }
  if (signal?.aborted) {
    stream.getTracks().forEach((t) => t.stop());
    return { status: 'aborted', text: '' };
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);

  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
  rec.start(200);

  const started = performance.now();
  let noiseFloor = 0.01;
  let heard = false;
  let lastVoice = started;

  const outcome = await new Promise((resolve) => {
    const tick = () => {
      if (signal?.aborted) return resolve('aborted');
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += s * s;
      const rms = Math.sqrt(sum / samples.length);
      const now = performance.now();
      if (now - started < 300) noiseFloor = Math.max(noiseFloor, rms); // learn the room's noise
      const loud = rms > Math.max(0.02, noiseFloor * 2.5);
      if (loud) {
        if (!heard) onInterim('…');
        heard = true;
        lastVoice = now;
      }
      if (!heard && now - started > silenceMs) return resolve('silence');
      if (heard && now - lastVoice > END_OF_SPEECH_MS) return resolve('done');
      if (now - started > MAX_MS) return resolve(heard ? 'done' : 'silence');
      setTimeout(tick, 60);
    };
    tick();
  });

  const blob = await new Promise((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: (rec.mimeType || mimeType || 'audio/webm').split(';')[0] }));
    if (rec.state !== 'inactive') rec.stop();
    else resolve(new Blob(chunks));
  });
  stream.getTracks().forEach((t) => t.stop());
  ctx.close().catch(() => {});

  if (outcome !== 'done') return { status: outcome, text: '' };

  try {
    const qs = new URLSearchParams({ userId: getUserId(), lang, aiConsent: 'yes' });
    const res = await fetch(`/api/ai/stt?${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'audio/webm' },
      body: blob,
      signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { status: 'provider_failed', reason: data?.error ?? res.status, text: '' };
    const text = String(data?.text ?? '').trim();
    onInterim(text);
    return { status: text.length >= 2 ? 'ok' : 'unclear', text, confidence: 1 };
  } catch (err) {
    if (signal?.aborted) return { status: 'aborted', text: '' };
    return { status: 'provider_failed', reason: err?.message ?? 'network', text: '' };
  }
}
