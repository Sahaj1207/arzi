// Shown after 2 failed voice attempts (or when voice cannot work at all).
// Big text box + Send. The answer goes through the same parser as speech.
import { useEffect, useRef, useState } from 'react';
import { t } from '@arzi/shared';

export default function KeyboardFallback({ lang, messageKey, onSubmit, error }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => inputRef.current?.focus(), []);

  const submit = (e) => {
    e.preventDefault();
    const text = value.trim();
    if (text) onSubmit(text);
  };

  return (
    <form className="keyboard" onSubmit={submit}>
      {messageKey && <p className="keyboard-help">{t(lang, messageKey)}</p>}
      <label className="sr-only" htmlFor="kb-answer">
        {t(lang, 'typeInstead')}
      </label>
      <textarea
        id="kb-answer"
        ref={inputRef}
        rows={2}
        value={value}
        placeholder={t(lang, 'typeInstead')}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) submit(e);
        }}
        lang={lang}
      />
      {error && (
        <p className="keyboard-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
        {t(lang, 'send')}
      </button>
    </form>
  );
}
