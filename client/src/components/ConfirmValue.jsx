// While Arzi asks "I heard: … Is that right?", show the value very large,
// so the user can check spelling, digits and dates with their eyes too.
import { getField, displayFieldValue } from '@arzi/shared';

export default function ConfirmValue({ lang, pending }) {
  if (!pending) return null;
  const field = getField(pending.fieldId);
  return (
    <div className="confirm" role="status">
      <span className="confirm-label">{field.label[lang]}</span>
      <span className={`confirm-value confirm-${field.type}`} lang={lang}>
        {displayFieldValue(field, pending.value, lang)}
      </span>
    </div>
  );
}
