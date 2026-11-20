// Pure QuickBooks Online export formatting. No DOM, no storage.
import { expenseStatus } from '../rules.js';

export const QB_DEFAULT_MAP = {
  Supplies: 'Supplies & Materials',
  Food: 'Meals',
  Facilities: 'Rent or Lease',
  'Mileage/fuel': 'Car & Truck',
  Travel: 'Travel',
  Stipends: 'Contract Labor',
  Printing: 'Office Supplies & Software',
  Other: 'Other Business Expenses',
};

/** QuickBooks account for a category: custom map first, then defaults, then "Other". */
export const accountFor = (category, map = {}) =>
  (map && typeof map[category] === 'string' && map[category].trim()) || QB_DEFAULT_MAP[category] || QB_DEFAULT_MAP.Other;

/** 2025-03-09 -> 03/09/2025 */
export const mdy = (iso) => { const [y, m, d] = String(iso || '').slice(0, 10).split('-'); return y && m && d ? `${m}/${d}/${y}` : ''; };

/** Plain text for a CSV cell: one line, and no leading = + @ - that a spreadsheet could run as a formula. */
export const safeText = (s) => {
  const t = String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim();
  return /^[=+\-@]/.test(t) ? `'${t}` : t;
};
const cell = (v) => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const csvLine = (cells) => cells.map(cell).join(',');
const amt = (n) => (Math.round(Number(n || 0) * 100) / 100).toFixed(2);

/** The day an expense became approved (its last approval), else its own date. */
export const approvalDate = (e) => (e.approvals || []).map((a) => a.date).filter(Boolean).sort().pop() || e.date;

/** Approved expenses whose date falls in [from, to] (YYYY-MM-DD, inclusive), oldest first. */
export function approvedInRange(expenses, users, from, to) {
  return expenses
    .filter((e) => expenseStatus(e, users) === 'approved' && (!from || e.date >= from) && (!to || e.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.vendor).localeCompare(String(b.vendor)));
}

/** Approved expenses approved after the last export date (all of them if never exported). */
export const newSinceExport = (expenses, users, last) =>
  expenses.filter((e) => expenseStatus(e, users) === 'approved' && (!last || approvalDate(e) > last));

/** QBO bank-transaction upload: Date (MM/DD/YYYY), Description, Amount (expenses negative). */
export function qboBankCsv(list) {
  const rows = [['Date', 'Description', 'Amount']];
  for (const e of list) rows.push([mdy(e.date), safeText(`${e.vendor} - ${e.category}`), Number(e.amount) ? `-${amt(Math.abs(e.amount))}` : '0.00']);
  return rows.map(csvLine).join('\r\n') + '\r\n';
}

/** Richer detail CSV for the bookkeeper. Amounts are positive here. */
export function qboDetailCsv(list, { map = {}, programs = [], grants = [], users = [] } = {}) {
  const rows = [['Date', 'Vendor', 'Category', 'Account', 'Class', 'Grant', 'Amount', 'Approved by']];
  for (const e of list) {
    rows.push([
      mdy(e.date), safeText(e.vendor), safeText(e.category), accountFor(e.category, map),
      safeText(programs.find((p) => p.id === e.programId)?.name || ''),
      safeText(grants.find((g) => g.id === e.grantId)?.name || ''),
      amt(e.amount),
      safeText((e.approvals || []).map((a) => users.find((u) => u.id === a.userId)?.name).filter(Boolean).join('; ')),
    ]);
  }
  return rows.map(csvLine).join('\r\n') + '\r\n';
}
