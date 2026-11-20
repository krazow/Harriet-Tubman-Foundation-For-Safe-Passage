// Outreach contact log: pure totals and CSV rows.
export const ITEMS = [['hygiene', 'Hygiene kits'], ['food', 'Food'], ['water', 'Water'], ['clothing', 'Clothing'],
  ['harm', 'Harm-reduction info'], ['cards', 'Resource cards'], ['other', 'Other']];
export const itemLabel = (k) => ITEMS.find(([x]) => x === k)?.[1] || k;
const month = (d) => String(d).slice(0, 7);

export const totalItems = (c) => Object.values(c.items || {}).reduce((s, n) => s + (Number(n) || 0), 0);

/** Per-month totals, newest first. */
export function monthlyTotals(logs) {
  const m = new Map();
  for (const c of logs) {
    const k = month(c.date);
    const t = m.get(k) || { month: k, contacts: 0, people: 0, referrals: 0, items: 0, byItem: {} };
    t.contacts += 1; t.people += Number(c.people) || 0; t.referrals += Number(c.referrals) || 0; t.items += totalItems(c);
    for (const [i, n] of Object.entries(c.items || {})) t.byItem[i] = (t.byItem[i] || 0) + (Number(n) || 0);
    m.set(k, t);
  }
  return [...m.values()].sort((a, b) => b.month.localeCompare(a.month));
}

export function csvRows(logs) {
  const head = ['Date', 'Place/area', 'People reached', ...ITEMS.map(([, l]) => l), 'Referrals', 'Notes'];
  return [head, ...[...logs].sort((a, b) => a.date.localeCompare(b.date)).map((c) =>
    [c.date, c.place, c.people, ...ITEMS.map(([k]) => (c.items || {})[k] || 0), c.referrals || 0, c.notes || ''])];
}
