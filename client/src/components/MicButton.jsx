// The one big round microphone button. `state` drives the look:
// idle | speaking (Arzi talking) | listening (user talking).
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
        <path
          fill="currentColor"
          d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
        />
      </svg>
      <span className="mic-label">{label}</span>
    </button>
  );
}
