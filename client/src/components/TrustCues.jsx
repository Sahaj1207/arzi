// Two reassurances for first-time users: an advocate checks every notice, and
// their details are not public. Kept truthful: see CLAUDE.md (anonymous ID, no login).
import { t } from '@arzi/shared';
import Stamp from './Stamp.jsx';

export default function TrustCues({ lang }) {
  return (
    <ul className="trust">
      <li>
        <Stamp size={52} className="trust-stamp" />
        <div>
          <strong>{t(lang, 'verifiedBadge')}</strong>
          <p>{t(lang, 'verifiedBody')}</p>
        </div>
      </li>
      <li>
        <svg className="trust-lock" width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
          <rect x="12" y="23" width="28" height="21" rx="4" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M18 23v-6a8 8 0 0 1 16 0v6" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="26" cy="33" r="3" fill="currentColor" />
        </svg>
        <div>
          <strong>{t(lang, 'privateBadge')}</strong>
          <p>{t(lang, 'privateBody')}</p>
        </div>
      </li>
    </ul>
  );
}
