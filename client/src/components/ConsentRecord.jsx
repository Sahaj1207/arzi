// Shows the saved consent: when, how, and the recording to play back.
import { t } from '@arzi/shared';
import { getUserId } from '../lib/userId.js';

const fmt = (sqlTime, lang) =>
  new Date(`${sqlTime.replace(' ', 'T')}Z`).toLocaleString(lang === 'en' ? 'en-IN' : `${lang}-IN`, {
    dateStyle: 'long', // date only: the sentence templates add "on / को / रोजी"
  });

export default function ConsentRecord({ doc }) {
  const c = doc.consent;
  if (!c) return null;
  const lang = doc.language;
  const date = fmt(c.createdAt, lang);
  return (
    <section className="consent-record">
      <h2>{t(lang, 'consentTitle')}</h2>
      <p>
        {t(lang, c.method === 'voice' ? 'consentVoice' : c.hasAudio ? 'consentButtonAudio' : 'consentButton', { date })}
      </p>
      {c.transcript && <p className="consent-words">“{c.transcript}”</p>}
      {c.hasAudio && (
        <audio
          controls
          preload="none"
          src={`/api/documents/${doc.id}/consent-audio?userId=${encodeURIComponent(getUserId())}`}
        />
      )}
    </section>
  );
}
