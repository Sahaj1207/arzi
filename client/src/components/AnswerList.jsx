// The 7 answers as one compact list (label on the left, value on the right on
// wide screens; stacked on phones). The one being asked is marked.
import { FIELDS, displayFieldValue, t } from '@arzi/shared';

export default function AnswerList({ lang, fields, current, title = true, onlyFilled = false }) {
  const rows = FIELDS.filter((f) => !onlyFilled || fields[f.id]);
  if (rows.length === 0) return null;
  return (
    <section className="answers" aria-label={t(lang, 'yourAnswers')}>
      {title && <h2>{t(lang, 'yourAnswers')}</h2>}
      <dl>
        {rows.map((f) => {
          const value = fields[f.id];
          return (
            <div key={f.id} className={`answer ${value ? 'is-filled' : ''} ${current === f.id ? 'is-current' : ''}`}>
              <dt>{f.label[lang]}</dt>
              <dd className={`answer-${f.type}`} lang={lang}>
                {value ? displayFieldValue(f, value, lang) : '—'}
                {value?.same && <small> {t(lang, 'sameAsAbove')}</small>}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
