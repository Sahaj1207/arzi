// The three steps of Arzi, in order. Numbered because they are a real sequence.
// Non-English pages add a small English line under each title for visiting judges.
import { t } from '@arzi/shared';

const STEPS = [1, 2, 3];

export default function HowItWorks({ lang }) {
  return (
    <section className="how" aria-labelledby="how-title">
      <h2 id="how-title">{t(lang, 'howItWorks')}</h2>
      <ol className="how-steps">
        {STEPS.map((n) => (
          <li key={n}>
            <span className="how-num" aria-hidden="true">
              {n}
            </span>
            <div>
              <strong>{t(lang, `step${n}Title`)}</strong>
              {lang !== 'en' && (
                <span className="how-en" lang="en">
                  {t('en', `step${n}Title`)}
                </span>
              )}
              <p>{t(lang, `step${n}Body`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
