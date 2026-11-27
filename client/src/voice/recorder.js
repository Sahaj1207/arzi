// Records the citizen's spoken consent with MediaRecorder (Chrome/Android: webm).
// startRecording() resolves to a recorder, or null if this browser/phone cannot
// record (no MediaRecorder, mic blocked). The caller then falls back to a button.
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
const MAX_MS = 60000; // never record longer than a minute

export async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return null;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    return null;
  }
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
  let rec;
  try {
    rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }
  const chunks = [];
  rec.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
  rec.start(250);
  const safety = setTimeout(() => rec.state === 'recording' && rec.stop(), MAX_MS);

  const release = () => {
    clearTimeout(safety);
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    // Stops and returns the audio as a Blob (type without codec, e.g. "audio/webm").
    stop: () =>
      new Promise((resolve) => {
        const finish = () => {
          release();
          const type = (rec.mimeType || mimeType || 'audio/webm').split(';')[0];
          resolve(new Blob(chunks, { type }));
        };
        if (rec.state === 'inactive') return finish();
        rec.onstop = finish;
        rec.stop();
      }),
    cancel: () => {
      if (rec.state !== 'inactive') rec.stop();
      release();
    },
  };
}
