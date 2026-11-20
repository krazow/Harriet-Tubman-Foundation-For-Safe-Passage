// Donors, gifts, grant prospects: pure totals and wording.
import { daysUntil } from '../rules.js';
const r2 = (n) => Math.round(n * 100) / 100;
export const DONOR_TYPES = [['individual', 'Individual'], ['organization', 'Organization'], ['foundation', 'Foundation'], ['daf', 'Donor-advised fund'], ['workplace', 'Workplace giving (e.g. Benevity)']];
export const GIFT_TYPES = [['cash', 'Cash'], ['check', 'Check'], ['online', 'Online'], ['in-kind', 'In-kind'], ['stock', 'Stock']];
export const STAGES = [['researching', 'Researching'], ['applied', 'Applied'], ['awarded', 'Awarded'], ['declined', 'Declined']];

export const giftYear = (g) => String(g.date).slice(0, 4);
/** In-kind gifts are never given a dollar value in totals. */
export const cashValue = (g) => (g.type === 'in-kind' ? 0 : Number(g.amount) || 0);

export function donorTotals(gifts, year) {
  const m = new Map();
  for (const g of gifts) {
    if (year && giftYear(g) !== String(year)) continue;
    const x = m.get(g.donorId) || { donorId: g.donorId, total: 0, count: 0, inKind: 0 };
    x.total = r2(x.total + cashValue(g)); x.count += 1; if (g.type === 'in-kind') x.inKind += 1;
    m.set(g.donorId, x);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}
export const grandTotal = (gifts, year) => r2(gifts.filter((g) => !year || giftYear(g) === String(year)).reduce((n, g) => n + cashValue(g), 0));
export const giftYears = (gifts) => [...new Set(gifts.map(giftYear))].sort().reverse();

/** Standard IRS acknowledgment sentence for one gift. */
export function acknowledgment(g) {
  if (g.type === 'in-kind') return `Thank you for your in-kind contribution${g.description ? ` (${g.description})` : ''}. No goods or services were provided in exchange for this contribution. In keeping with IRS rules, we have not stated a value; the donor is responsible for determining the fair market value of donated property.`;
  return 'No goods or services were provided in exchange for this contribution.';
}
export const designationText = (g, name) => (!g.designation || g.designation === 'general' ? 'General support' : name || g.designation);

/** Prospects still in "researching" with a deadline within `days` (overdue included). */
export function dueProspects(prospects, now = new Date(), days = 14) {
  return prospects.filter((p) => p.stage === 'researching' && p.deadline && daysUntil(p.deadline, now) <= days)
    .map((p) => ({ ...p, days: daysUntil(p.deadline, now) })).sort((a, b) => a.days - b.days);
}
export function pipelineTotals(prospects) {
  const t = Object.fromEntries(STAGES.map(([k]) => [k, { count: 0, ask: 0 }]));
  for (const p of prospects) if (t[p.stage]) { t[p.stage].count += 1; t[p.stage].ask = r2(t[p.stage].ask + (Number(p.ask) || 0)); }
  return t;
}
