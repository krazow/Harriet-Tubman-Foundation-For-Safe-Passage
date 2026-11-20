// Pure usage-counting logic. Stores only counts per day: no users, no record contents.
const SAFE = /^[a-z0-9-]{1,40}$/i;
const KEEP_DAYS = 90;

/** '#/money/grants/gr1' -> 'money'; '#/f/board/x' -> 'f/board'. Ids and anything unexpected never survive. */
export function segmentOf(hash) {
  const parts = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!parts.length) return 'today';
  if (parts[0] === 'f') return parts[1] && SAFE.test(parts[1]) ? `f/${parts[1]}` : 'f';
  return SAFE.test(parts[0]) ? parts[0] : 'other';
}
export const actionName = (act) => (SAFE.test(act || '') ? act : 'other');

const bump = (usage, day, kind, key) => {
  const u = usage && typeof usage === 'object' ? usage : {};
  u.days ||= {};
  const d = (u.days[day] ||= { views: {}, actions: {} });
  d[kind][key] = (d[kind][key] || 0) + 1;
  const keep = Object.keys(u.days).sort().slice(-KEEP_DAYS);
  for (const k of Object.keys(u.days)) if (!keep.includes(k)) delete u.days[k];
  return u;
};
export const recordView = (usage, day, hash) => bump(usage, day, 'views', segmentOf(hash));
export const recordAction = (usage, day, act) => bump(usage, day, 'actions', actionName(act));

const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
const addDay = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Last `days` days ending `today`, newest first, plus totals per page and per action. */
export function summarize(usage, today, days = 30) {
  const rows = [], pages = {}, actions = {};
  for (let i = 0; i < days; i++) {
    const day = addDay(today, -i);
    const d = usage?.days?.[day] || { views: {}, actions: {} };
    rows.push({ day, views: sum(d.views), actions: sum(d.actions) });
    for (const [k, n] of Object.entries(d.views)) pages[k] = (pages[k] || 0) + n;
    for (const [k, n] of Object.entries(d.actions)) actions[k] = (actions[k] || 0) + n;
  }
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { rows, pages: top(pages), actions: top(actions), totalViews: rows.reduce((a, r) => a + r.views, 0), totalActions: rows.reduce((a, r) => a + r.actions, 0) };
}
