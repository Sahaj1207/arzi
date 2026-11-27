// Shown the moment violence or an emergency is mentioned. Drafting stops.
import { t } from '@arzi/shared';

export default function EmergencyPanel({ lang, onClose }) {
  return (
    <section className="emergency" role="alertdialog" aria-labelledby="emg-title" aria-describedby="emg-body">
      <h2 id="emg-title">{t(lang, 'emergencyTitle')}</h2>
      <a className="emergency-call" href="tel:112">
        112
      </a>
      <p id="emg-body">{t(lang, 'emergencyBody')}</p>
      <a className="btn btn-danger btn-big" href="tel:112">
        {t(lang, 'callNow')}
      </a>
      <button type="button" className="btn btn-big" onClick={onClose}>
        {t(lang, 'startOver')}
      </button>
    </section>
  );
}
