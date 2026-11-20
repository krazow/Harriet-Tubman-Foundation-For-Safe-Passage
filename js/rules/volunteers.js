// Volunteer shifts: pure rules.
const r2 = (n) => Math.round(n * 100) / 100;
const month = (d) => String(d).slice(0, 7);

export function shiftHours(s) {
  const [a, b] = [s.start, s.end].map((t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); });
  return b > a ? r2((b - a) / 60) : 0;
}
export const slotsLeft = (s) => Math.max(0, Number(s.slots) - (s.signups || []).length);
export const isSignedUp = (s, uid) => (s.signups || []).some((x) => x.userId === uid);
export const canSignUp = (s, uid) => !isSignedUp(s, uid) && slotsLeft(s) > 0;

/** Attended entries flattened: {userId, date, month, hours, title}. */
export function attendedEntries(shifts) {
  return shifts.flatMap((s) => (s.signups || []).filter((x) => x.attended)
    .map((x) => ({ userId: x.userId, date: s.date, month: month(s.date), hours: Number(x.hours) || 0, title: s.title })));
}
export const hoursForUser = (shifts, uid) => r2(attendedEntries(shifts).filter((e) => e.userId === uid).reduce((n, e) => n + e.hours, 0));

/** Rows per person per month plus per-person totals. */
export function totalsByPerson(shifts) {
  const p = new Map();
  for (const e of attendedEntries(shifts)) {
    const x = p.get(e.userId) || { userId: e.userId, total: 0, months: {} };
    x.total = r2(x.total + e.hours); x.months[e.month] = r2((x.months[e.month] || 0) + e.hours);
    p.set(e.userId, x);
  }
  return [...p.values()].sort((a, b) => b.total - a.total);
}
export function totalsByMonth(shifts) {
  const m = {};
  for (const e of attendedEntries(shifts)) m[e.month] = r2((m[e.month] || 0) + e.hours);
  return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0])).map(([month, hours]) => ({ month, hours }));
}
/** In-kind value; null when no hourly value is set (never invent a figure). */
export const inKindValue = (hours, rate) => (Number(rate) > 0 ? r2(hours * rate) : null);
