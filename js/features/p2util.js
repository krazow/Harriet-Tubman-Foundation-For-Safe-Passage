// Small helpers shared by the Phase 2 feature modules (not a feature itself).
import { esc, fmtDate, relDays } from '../ui.js';

/** Short Today card: title, up to 4 rows [{t, sub, pill, cls}], and a link. */
export function todayCard(title, rows, href, more = 'Open') {
  if (!rows.length) return '';
  const shown = rows.slice(0, 4);
  return `<section class="card"><h3>${esc(title)}</h3>${shown.map((r) => `<a class="row" href="${href}"><span class="grow">${esc(r.t)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span>${r.pill ? `<span class="pill ${r.cls || ''}">${esc(r.pill)}</span>` : ''}</a>`).join('')}
    <a class="row" href="${href}"><span class="grow muted">${rows.length > 4 ? `+${rows.length - 4} more · ` : ''}${esc(more)} →</span></a></section>`;
}
export const dueClass = (n) => (n < 0 ? 'rejected' : n <= 7 ? 'pending' : '');
export const duePill = (n) => relDays(n);
export { esc, fmtDate };
