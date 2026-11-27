// PDF and WhatsApp helpers for a finished (approved) document.
import { t } from '@arzi/shared';
import { api } from './api.js';
import { getUserId } from './userId.js';

// The server sends the PDF, or a printable page if PDF generation failed.
export const pdfUrl = (doc) => `/api/documents/${doc.id}/pdf?userId=${encodeURIComponent(getUserId())}`;

// Opens WhatsApp with a message and a share link. The link uses a random
// per-document token, never the private anonymous user ID.
export async function shareOnWhatsApp(doc) {
  // Open the window inside the tap, then fill it in: popup blockers allow that.
  const win = window.open('', '_blank');
  const r = await api(`/documents/${doc.id}/share?userId=${encodeURIComponent(getUserId())}`, { method: 'POST' });
  if (!r.ok) {
    win?.close();
    return false;
  }
  const text = t(doc.language, 'shareMessage', { url: `${window.location.origin}${r.data.path}` });
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  if (win) win.location.href = url;
  else window.location.href = url;
  return true;
}
