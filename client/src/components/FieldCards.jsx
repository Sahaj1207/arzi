// The 7 answers as cards. Filled ones show the confirmed value; the one being
// asked is highlighted. Names, numbers and dates are large so mistakes show.
import { FIELDS, displayFieldValue, t } from '@arzi/shared';

export default function FieldCards({ lang, fields, current }) {
  return (
    <ol className="cards">
      {FIELDS.map((f) => {
        const value = fields[f.id];
        const isCurrent = current === f.id;
        return (
          <li key={f.id} className={`card ${value ? 'card-filled' : ''} ${isCurrent ? 'card-current' : ''}`}>
            <span className="card-label">{f.label[lang]}</span>
            <span className={`card-value card-${f.type}`} lang={lang}>
              {value ? displayFieldValue(f, value, lang) : '—'}
              {value?.same && <small className="card-note"> {t(lang, 'sameAsAbove')}</small>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
