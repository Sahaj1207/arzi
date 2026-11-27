// Demo-mode drafting: the formal English legal notice, filled from the 7 fields.
// Content rules (CLAUDE.md §3.4): sent by the tenant in their own name; 15 days
// to pay; claims the deposit only, reserving interest and legal costs.
// The "Reviewed by Advocate [name]" line is added only once an advocate approves
// (see withReviewLine), so an unchecked draft never claims to be reviewed.
import { formatINR, formatDate, formatDuration, amountInWordsEn } from '@arzi/shared';

export const DAYS_TO_PAY = 15;

const on = ({ iso, precision }) => (precision === 'month' ? `in ${formatDate(iso, 'en', 'month')}` : `on ${formatDate(iso, 'en')}`);

function dueSentence(due) {
  if (due.kind === 'duration') {
    return `The said deposit has remained unpaid for about ${formatDuration(due, 'en')}, that is, since about ${formatDate(due.sinceIso, 'en')}.`;
  }
  return `The said deposit was due to be refunded to me ${on(due)}.`;
}

// facts: extra facts from the citizen's story (AI mode), [{ en }]. They get their
// own numbered paragraph after the facts of the deposit; the advocate checks them.
export function buildNotice(fields, { today = new Date(), facts = [] } = {}) {
  const tenant = fields.tenantName.text;
  const premises = fields.tenantAddress.text;
  const landlord = fields.landlordName.text;
  const landlordAddress = fields.landlordAddress.text;
  const amount = fields.depositAmount.amount;
  const money = `${formatINR(amount)} (Rupees ${amountInWordsEn(amount)} only)`;
  const dated = formatDate(today.toISOString().slice(0, 10), 'en');
  const sentence = (s) => s.trim().replace(/[.\s]*$/, '.');

  const paragraphs = [
    `I, ${tenant}, was your tenant at the premises situated at ${premises} (“the premises”). I paid you a refundable security deposit of ${money} in respect of the premises.`,
    `I vacated the premises ${on(fields.movedOutDate)}.`,
    `${dueSentence(fields.dueDate)} Despite this, you have not refunded the security deposit to me till date.`,
    ...(facts.length ? [`I further state that: ${facts.map((x) => sentence(x.en)).join(' ')}`] : []),
    'You have no lawful reason to keep my security deposit. Withholding it is wrongful, and the full amount is payable to me.',
    `I therefore call upon you to pay me the sum of ${money} within ${DAYS_TO_PAY} (fifteen) days from the date of receipt of this notice.`,
    `Please take notice that if you fail to pay the said amount within ${DAYS_TO_PAY} days, I shall be constrained to initiate appropriate legal proceedings against you for its recovery, entirely at your risk as to costs and consequences. I reserve my right to claim interest and the costs of legal proceedings in such proceedings.`,
  ];

  return [
    'LEGAL NOTICE',
    'Demand for refund of security deposit',
    '',
    `Date: ${dated}`,
    '',
    'From:',
    tenant,
    premises,
    '',
    'To:',
    landlord,
    landlordAddress,
    '',
    `Subject: Legal notice for refund of security deposit of ${money}`,
    '',
    'Sir/Madam,',
    '',
    ...paragraphs.flatMap((p, i) => [`${i + 1}. ${p}`, '']),
    'Yours faithfully,',
    '',
    tenant,
    '(Tenant)',
  ].join('\n');
}

export const reviewLine = (advocateName) => `Reviewed by Advocate ${advocateName}`;

// Appends the review line to an approved notice (once).
export function withReviewLine(text, advocateName) {
  const line = reviewLine(advocateName);
  return text.includes(line) ? text : `${text.trimEnd()}\n\n${line}`;
}
