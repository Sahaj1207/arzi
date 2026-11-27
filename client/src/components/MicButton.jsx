// The one big round microphone button. `state` drives the look:
//   idle | speaking (Arzi talking) | listening (user talking, red)
//   | sample (the scripted sample case: a play icon, never red)
const MIC = 'M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z';
const PLAY = 'M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z';

export default function MicButton({ state = 'idle', size = 'big', label, onClick, disabled }) {
  return (
    <button
      type="button"
      className={`mic mic-${state} mic-${size}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" width="64" height="64" aria-hidden="true">
        <path fill="currentColor" d={state === 'sample' ? PLAY : MIC} />
      </svg>
      <span className="mic-label">{label}</span>
    </button>
  );
}
