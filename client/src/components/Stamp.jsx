// The "Advocate-verified" seal, drawn like the round rubber stamps on Indian
// legal papers. Text runs around the ring; a tick sits in the middle.
import { useId } from 'react';

export default function Stamp({ size = 72, label = 'ADVOCATE VERIFIED', className = '' }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      className={`stamp ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
    >
      <defs>
        <path id={`ring-${id}`} d="M50,50 m-35,0 a35,35 0 1,1 70,0 a35,35 0 1,1 -70,0" />
      </defs>
      <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="50" cy="50" r="26" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <text fontSize="11.5" fontWeight="700" letterSpacing="1.6" fill="currentColor">
        <textPath href={`#ring-${id}`} startOffset="2%">
          {`${label} • ${label} •`}
        </textPath>
      </text>
      <path d="M38 51 l8 8 l16 -18" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
