// Shared by both Telugu review sheets: the 5 summary points rendered with the
// sample case values, in English and Telugu, straight from the server template.
const { buildSummary } = await import('../server/src/drafting/summary.js');

const sampleFields = {
  tenantName: { text: 'ప్రియా శర్మ' },
  tenantAddress: { text: 'రూమ్ 12, శాంతి పీజీ, అమీర్‌పేట్, హైదరాబాద్ 500016' },
  landlordName: { text: 'రాజేష్ గుప్తా' },
  landlordAddress: { text: '8 మైత్రివనం రోడ్, అమీర్‌పేట్, హైదరాబాద్ 500016' },
  depositAmount: { amount: 25000 },
  movedOutDate: { iso: '2026-09-15', precision: 'day' },
  dueDate: { kind: 'date', iso: '2026-09-30', precision: 'day' },
};

// The same sample in English letters, for the English column.
const englishNames = {
  tenantName: { text: 'Priya Sharma' },
  tenantAddress: { text: 'Room 12, Shanti PG, Ameerpet, Hyderabad 500016' },
  landlordName: { text: 'Rajesh Gupta' },
  landlordAddress: { text: '8 Maitrivanam Road, Ameerpet, Hyderabad 500016' },
};

// [{ en, te }] × 5
export function summaryPairs() {
  const en = buildSummary({ ...sampleFields, ...englishNames }, 'en').split('\n');
  return buildSummary(sampleFields, 'te')
    .split('\n')
    .map((te, i) => ({ en: en[i], te }));
}

export const cell = (s) => String(s ?? '').replace(/\|/g, '\|').replace(/\n/g, '<br>');
