// Pure iCalendar (RFC 5545) builder and calendar item collection. No DOM, no storage.

export const TYPES = {
  events: { label: 'Events', restricted: false },
  sessions: { label: 'Program sessions', restricted: false },
  tasks: { label: 'Task due dates', restricted: false },
  shifts: { label: 'Volunteer shifts', restricted: false },
  grants: { label: 'Grant deadlines', restricted: true },
  meetings: { label: 'Board meetings', restricted: true },
  compliance: { label: 'Compliance items', restricted: true },
};
export const RESTRICTED_ROLES = ['ed', 'treasurer', 'board'];
export const typesFor = (role) => Object.keys(TYPES).filter((t) => !TYPES[t].restricted || RESTRICTED_ROLES.includes(role));

const enc = new TextEncoder();
/** Escape TEXT values: backslash, semicolon, comma, newline. */
export const escapeText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');

/** Fold a content line at 75 octets (never splitting a UTF-8 character); continuation lines start with one space. */
export function foldLine(line) {
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) { out.push(cur); cur = ''; bytes = 0; limit = 74; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const pad = (n) => String(n).padStart(2, '0');
export const icsDate = (iso) => String(iso).slice(0, 10).replace(/-/g, '');
export const addDays = (iso, n) => { const d = new Date(iso.slice(0, 10) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const icsStamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const timeOk = (t) => /^\d{1,2}:\d{2}$/.test(t || '');
function localStamp(iso, time, plusMin = 0) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), h, m + plusMin));
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`;
}

/**
 * items: [{ uid, date:'YYYY-MM-DD', time?:'HH:MM', endDate?, title, location?, description?, category? }]
 * No time = all-day event (DTEND is the exclusive next day). A time = 1-hour floating local event.
 */
export function buildICS(items, { now = new Date(), name = 'Safe Passage Ops' } = {}) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Safe Passage Ops//Calendar export//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(name)}`];
  const stamp = icsStamp(now);
  for (const it of items) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(it.date || '')) continue;
    L.push('BEGIN:VEVENT', `UID:${String(it.uid).replace(/[^\w.-]/g, '_')}@safepassage-ops`, `DTSTAMP:${stamp}`);
    if (timeOk(it.time)) L.push(`DTSTART:${localStamp(it.date, it.time)}`, `DTEND:${localStamp(it.date, it.time, 60)}`);
    else L.push(`DTSTART;VALUE=DATE:${icsDate(it.date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(it.endDate && it.endDate >= it.date ? it.endDate : it.date, 1))}`);
    L.push(`SUMMARY:${escapeText(it.title || '(untitled)')}`);
    if (it.location) L.push(`LOCATION:${escapeText(it.location)}`);
    if (it.description) L.push(`DESCRIPTION:${escapeText(it.description)}`);
    if (it.category) L.push(`CATEGORIES:${escapeText(it.category)}`);
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(foldLine).join('\r\n') + '\r\n';
}

// ---- collecting items from app data (defensive: other modules' shapes may vary) ----
const pick = (o, keys) => { for (const k of keys) if (o && typeof o[k] === 'string' && o[k].trim()) return o[k].trim(); return ''; };
const isoDate = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || '') ? s.slice(0, 10) : '');
const timeOf = (o) => { const t = pick(o, ['time', 'startTime']) || (/T(\d{2}:\d{2})/.exec(pick(o, ['date', 'start', 'dueDate', 'due'])) || [])[1] || ''; return timeOk(t) ? t.padStart(5, '0') : ''; };
const dateOf = (o, keys = ['date', 'start', 'dueDate', 'due']) => isoDate(pick(o, keys));

export function collectItems(data, { role, userId, types } = {}) {
  const allowed = new Set(typesFor(role));
  const want = new Set((types || Object.keys(TYPES)).filter((t) => allowed.has(t)));
  const out = [];
  const add = (type, o, extra) => { if (want.has(type) && extra.date && extra.title) out.push({ type, category: TYPES[type].label, ...extra, uid: `${type}-${o.id || extra.date + '-' + extra.title.slice(0, 20)}` }); };
  const arr = (k) => (Array.isArray(data?.[k]) ? data[k] : []);
  const progName = (id) => arr('programs').find((p) => p.id === id)?.name || 'Program';

  for (const e of arr('events')) add('events', e, { date: dateOf(e), time: timeOf(e), title: pick(e, ['name', 'title']), location: pick(e, ['place', 'location']) });
  for (const s of arr('sessions')) add('sessions', s, { date: dateOf(s), time: timeOf(s), title: `${progName(s.programId)} session`, description: pick(s, ['note']) });
  for (const t of arr('tasks')) if (!t.done && (role === 'ed' || t.ownerId === userId)) add('tasks', t, { date: dateOf(t), title: `Due: ${pick(t, ['text', 'title', 'name'])}` });
  for (const v of arr('volunteerShifts')) add('shifts', v, { date: dateOf(v), time: timeOf(v), title: `Shift: ${pick(v, ['title', 'name', 'role', 'label']) || 'Volunteer shift'}`, location: pick(v, ['place', 'location']) });
  for (const g of arr('grants')) for (const d of g.deadlines || []) if (!d.done) add('grants', { id: `${g.id}-${d.id}` }, { date: dateOf(d), title: `${pick(d, ['label', 'name', 'title'])} (${g.name})` });
  for (const m of arr('meetings')) add('meetings', m, { date: dateOf(m), time: timeOf(m), title: pick(m, ['title', 'name']) || 'Board meeting', location: pick(m, ['place', 'location']) });
  for (const c of arr('compliance')) if (c.done !== true) add('compliance', c, { date: dateOf(c, ['due', 'dueDate', 'date', 'next']), title: `Compliance: ${pick(c, ['title', 'name', 'label'])}` });
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
}

/** Items from `from` (YYYY-MM-DD) through `days` days later. */
export const agenda = (items, from, days = 60) => { const end = addDays(from, days); return items.filter((i) => i.date >= from && i.date <= end); };
