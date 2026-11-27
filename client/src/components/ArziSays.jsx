// What Arzi is saying, always on screen. If no voice could speak it,
// the text is highlighted so the user knows to read it.
export default function ArziSays({ text, speaking, voiceless }) {
  if (!text) return null;
  return (
    <p className={`arzi-says ${speaking ? 'is-speaking' : ''} ${voiceless ? 'is-voiceless' : ''}`} aria-live="polite">
      {text}
    </p>
  );
}
