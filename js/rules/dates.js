// Small date helpers working on 'YYYY-MM-DD' strings (no timezone surprises).
export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const parts = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
export const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const addDays = (s, n) => { const { y, m, d } = parts(s); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
export const diffDays = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);
/** Add whole years; Feb 29 falls back to Feb 28. */
export const addYears = (s, n) => { const { y, m, d } = parts(s); return ymd(y + n, m, Math.min(d, lastDay(y + n, m))); };
export const inRange = (d, from, to) => !!d && (!from || d >= from) && (!to || d <= to);
