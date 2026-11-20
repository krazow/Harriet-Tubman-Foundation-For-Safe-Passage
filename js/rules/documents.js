import { diffDays } from './dates.js';
export const DOC_CATEGORIES = ['Bylaws', 'Policies', 'Tax filings', 'Insurance', 'Contracts', 'Grants', 'Other'];

/** Documents expiring within `days` (already-expired included). */
export function expiringDocs(docs, today, days = 30) {
  return docs.filter((d) => d.expires).map((d) => ({ ...d, days: diffDays(d.expires, today) }))
    .filter((d) => d.days <= days).sort((a, b) => a.days - b.days);
}
