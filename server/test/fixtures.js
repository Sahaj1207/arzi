// A complete, valid set of the 7 fields, as the interview produces them.
export const FIELDS_OK = {
  tenantName: { text: 'Ramesh Kumar' },
  tenantAddress: { text: 'Flat 3, 12 MG Road, Kothrud, Pune' },
  landlordName: { text: 'Suresh Sharma' },
  landlordAddress: { text: 'Flat 3, 12 MG Road, Kothrud, Pune', same: true },
  depositAmount: { amount: 150000 },
  movedOutDate: { iso: '2026-03-15', precision: 'day' },
  dueDate: { kind: 'duration', value: 3, unit: 'month', days: 90, sinceIso: '2026-08-27' },
};
