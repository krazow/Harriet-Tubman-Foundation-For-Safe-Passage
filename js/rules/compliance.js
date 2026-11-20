// Compliance calendar rules.
import { addYears, diffDays, ymd, parts, lastDay } from './dates.js';

/** IRS Form 990 is due the 15th day of the 5th month after fiscal year end (calendar year -> May 15). */
export function form990Due(fiscalYearEndMonth, fiscalYear) {
  const m = fiscalYearEndMonth + 5;
  return ymd(fiscalYear + (m > 12 ? 1 : 0), m > 12 ? m - 12 : m, 15);
}

/** Next calendar occurrence (today or later) of month/day. */
export function nextOccurrence(month, day, today) {
  const { y } = parts(today);
  const c = ymd(y, month, Math.min(day, lastDay(y, month)));
  return c >= today ? c : ymd(y + 1, month, Math.min(day, lastDay(y + 1, month)));
}

/** Mark an item done. Returns { item, next } where next is the new item for yearly recurring items. */
export function completeItem(item, doneDate, newId) {
  const done = { ...item, done: true, doneDate };
  const next = item.recurring === 'yearly' ? { ...item, id: newId, due: addYears(item.due, 1), done: false, doneDate: null } : null;
  return { item: done, next };
}

/** Open items due within `days` (overdue included). */
export function dueSoon(items, today, days = 30) {
  return items.filter((i) => !i.done).map((i) => ({ ...i, days: diffDays(i.due, today) }))
    .filter((i) => i.days <= days).sort((a, b) => a.days - b.days);
}
