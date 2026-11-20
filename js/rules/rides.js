// Ride / mileage log: pure math.
export const DEFAULT_RATE = 0.76;
const r2 = (n) => Math.round(n * 100) / 100;
const r1 = (n) => Math.round(n * 10) / 10;

/** Miles for a ride: odometer difference when both readings exist, otherwise the typed miles. */
export function rideMiles(r) {
  const a = Number(r.odoStart), b = Number(r.odoEnd);
  if (r.odoStart !== '' && r.odoEnd !== '' && r.odoStart != null && r.odoEnd != null && b >= a) return r1(b - a);
  return r1(Number(r.miles) || 0);
}
export const reimbursement = (miles, rate) => r2(Number(miles) * Number(rate));
export const monthOf = (date) => String(date).slice(0, 7);

/** One row per driver per month: miles, rides, reimbursement. Newest month first. */
export function monthlySummary(rides, rate) {
  const m = new Map();
  for (const r of rides) {
    const k = `${r.driverId}|${monthOf(r.date)}`;
    const row = m.get(k) || { driverId: r.driverId, month: monthOf(r.date), miles: 0, rides: 0 };
    row.miles = r1(row.miles + rideMiles(r)); row.rides += 1;
    m.set(k, row);
  }
  return [...m.values()].map((x) => ({ ...x, amount: reimbursement(x.miles, rate) }))
    .sort((a, b) => b.month.localeCompare(a.month) || a.driverId.localeCompare(b.driverId));
}

/** Unsubmitted rides of a driver, grouped by program, ready to become expenses. */
export function groupForSubmission(rides, driverId, rate) {
  const g = new Map();
  for (const r of rides) {
    if (r.driverId !== driverId || r.submitted) continue;
    const x = g.get(r.programId) || { programId: r.programId, miles: 0, rideIds: [] };
    x.miles = r1(x.miles + rideMiles(r)); x.rideIds.push(r.id);
    g.set(r.programId, x);
  }
  return [...g.values()].filter((x) => x.miles > 0).map((x) => ({ ...x, amount: reimbursement(x.miles, rate) }));
}

export const mileageExpense = ({ id, date, name, amount, programId, driverId }) => ({
  id, date, vendor: `Mileage reimbursement — ${name}`, amount, category: 'Mileage/fuel', programId,
  grantId: null, submittedBy: driverId, relatedParty: false, approvals: [],
});

export function validateRide(r) {
  const hasOdo = r.odoStart !== '' && r.odoEnd !== '' && r.odoStart != null && r.odoEnd != null;
  if (hasOdo && Number(r.odoEnd) < Number(r.odoStart)) return 'Odometer end must be at least the start.';
  if (rideMiles(r) <= 0) return 'Enter odometer start/end or miles.';
  return '';
}
