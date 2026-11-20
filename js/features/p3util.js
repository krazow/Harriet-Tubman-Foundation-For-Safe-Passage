// Small helpers shared by the Phase 3 feature modules.
import { store } from '../store.js';
import { esc, D } from '../ui.js';

export const has = (...roles) => roles.includes(store.user.role);
export const monthLabel = (m) => new Date(m + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
export const tabs = (id, list, cur) => `<nav class="tabs">${list.map(([k, l]) => `<a href="#/f/${id}/${k}" class="${cur === k ? 'on' : ''}">${esc(l)}</a>`).join('')}</nav>`;
export const para = (t) => esc(t).replace(/\n/g, '<br>');
export const progName = (id) => D().programs.find((p) => p.id === id)?.name || '';
export const pageHead = (title, btns = '') => `<div class="head"><h1>${esc(title)}</h1><span>${btns}</span></div>`;
export const progOptions = () => D().programs.map((p) => [p.id, p.name]);
/** Today-card wrapper: title, up to 4 rows, link. */
export const todayCard = (title, rows, href, linkText, cls = '') => `<section class="card ${cls}"><h3>${esc(title)}</h3>
  ${rows.slice(0, 4).join('')}${rows.length > 4 ? `<p class="muted">+${rows.length - 4} more</p>` : ''}<a class="back" href="${href}">${esc(linkText)} ›</a></section>`;
