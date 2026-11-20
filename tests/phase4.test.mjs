import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QB_DEFAULT_MAP, accountFor, mdy, safeText, approvedInRange, newSinceExport, qboBankCsv, qboDetailCsv } from '../js/rules/quickbooks.js';
import { escapeText, foldLine, buildICS, collectItems, agenda, typesFor, addDays } from '../js/rules/calendar.js';
import { segmentOf, recordView, recordAction, summarize } from '../js/rules/usage.js';
import { validPin, checkPin, cleanSubmission, toParticipant, looksSensitive } from '../js/rules/intake.js';

const users = [{ id: 'u1', name: 'Avery Johnson', role: 'ed' }, { id: 'u2', name: 'Morgan Lee', role: 'treasurer' }, { id: 'u4', name: 'Riley Carter', role: 'lead' }];
const ex = (o) => ({ id: 'x', date: '2025-03-09', vendor: 'Art Supply, Co.', amount: 186.4, category: 'Supplies', programId: 'p1', grantId: 'gr1', submittedBy: 'u4', approvals: [{ userId: 'u2', date: '2025-03-10' }], ...o });

// ---- QuickBooks ----
test('account mapping: custom, default, fallback', () => {
  assert.equal(accountFor('Food'), 'Meals');
  assert.equal(accountFor('Food', { Food: 'Client Meals' }), 'Client Meals');
  assert.equal(accountFor('Mystery'), 'Other Business Expenses');
  assert.equal(accountFor('Travel', { Travel: '  ' }), 'Travel');
  assert.equal(Object.keys(QB_DEFAULT_MAP).length, 8);
});
test('mdy and safeText', () => {
  assert.equal(mdy('2025-03-09'), '03/09/2025');
  assert.equal(safeText('=HYPERLINK("x")'), `'=HYPERLINK("x")`);
  assert.equal(safeText('a\nb'), 'a b');
});
test('QBO bank CSV: 3 columns, MM/DD/YYYY, expenses negative, CRLF, quoting', () => {
  const csv = qboBankCsv([ex()]);
  assert.equal(csv, 'Date,Description,Amount\r\n03/09/2025,"Art Supply, Co. - Supplies",-186.40\r\n');
});
test('only approved expenses in range, sorted', () => {
  const list = [ex({ id: 'a', date: '2025-03-12' }), ex({ id: 'b', approvals: [] }), ex({ id: 'c', date: '2025-02-01' }), ex({ id: 'd', rejected: true })];
  const r = approvedInRange(list, users, '2025-03-01', '2025-03-31');
  assert.deepEqual(r.map((e) => e.id), ['a']);
});
test('new since last export uses approval date', () => {
  const list = [ex({ id: 'a' }), ex({ id: 'b', approvals: [{ userId: 'u2', date: '2025-04-01' }] })];
  assert.equal(newSinceExport(list, users, '').length, 2);
  assert.deepEqual(newSinceExport(list, users, '2025-03-15').map((e) => e.id), ['b']);
});
test('detail CSV has class, grant, account, approver', () => {
  const csv = qboDetailCsv([ex()], { programs: [{ id: 'p1', name: 'Healing Arts' }], grants: [{ id: 'gr1', name: 'General' }], users });
  const [head, row] = csv.trim().split('\r\n');
  assert.equal(head, 'Date,Vendor,Category,Account,Class,Grant,Amount,Approved by');
  assert.equal(row, '03/09/2025,"Art Supply, Co.",Supplies,Supplies & Materials,Healing Arts,General,186.40,Morgan Lee');
});

// ---- iCalendar ----
test('escapeText escapes backslash, semicolon, comma, newline', () => {
  assert.equal(escapeText('a,b;c\\d\ne'), 'a\\,b\;c\\\\d\\ne');
});
test('foldLine at 75 octets, CRLF + space, UTF-8 safe', () => {
  const long = 'SUMMARY:' + 'x'.repeat(200);
  const folded = foldLine(long);
  const lines = folded.split('\r\n');
  assert.ok(lines.every((l) => new TextEncoder().encode(l).length <= 75));
  assert.ok(lines.slice(1).every((l) => l.startsWith(' ')));
  assert.equal(lines.map((l, i) => (i ? l.slice(1) : l)).join(''), long);
  const emoji = foldLine('SUMMARY:' + 'é'.repeat(80));
  for (const l of emoji.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75);
  assert.equal(emoji.split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join(''), 'SUMMARY:' + 'é'.repeat(80));
  assert.equal(foldLine('short'), 'short');
});
test('buildICS: all-day event, timed event, CRLF, UID, DTSTAMP', () => {
  const ics = buildICS([
    { uid: 'events-e1', date: '2025-03-09', title: 'Listening, session; big', location: 'Hall' },
    { uid: 'sessions-s1', date: '2025-03-31', time: '23:30', title: 'Late', description: 'a\nb' },
  ], { now: new Date(Date.UTC(2025, 0, 2, 3, 4, 5)) });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(ics));
  assert.match(ics, /UID:events-e1@safepassage-ops\r\n/);
  assert.match(ics, /DTSTAMP:20250102T030405Z\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20250309\r\nDTEND;VALUE=DATE:20250310\r\n/);
  assert.match(ics, /SUMMARY:Listening\\, session\; big\r\n/);
  assert.match(ics, /DTSTART:20250331T233000\r\nDTEND:20250401T003000\r\n/);
  assert.match(ics, /DESCRIPTION:a\\nb\r\n/);
  assert.equal(addDays('2025-12-31', 1), '2026-01-01');
});
test('collectItems: defensive reads and role filtering', () => {
  const data = {
    programs: [{ id: 'p1', name: 'Healing Arts' }],
    events: [{ id: 'e1', name: 'Listening', date: '2025-03-09', place: 'Hall' }],
    sessions: [{ id: 's1', programId: 'p1', date: '2025-03-10', note: 'Mural' }],
    tasks: [{ id: 't1', text: 'Mine', ownerId: 'u4', due: '2025-03-11' }, { id: 't2', text: 'Theirs', ownerId: 'u1', due: '2025-03-11' }, { id: 't3', text: 'Done', ownerId: 'u4', due: '2025-03-11', done: true }],
    grants: [{ id: 'gr1', name: 'G', deadlines: [{ id: 'd1', label: 'Report', date: '2025-03-12', done: false }] }],
    meetings: [{ id: 'm1', title: 'Board', date: '2025-03-13T18:30' }, { id: 'm2' }],
    volunteerShifts: [{ id: 'v1', name: 'Pantry', date: '2025-03-14' }],
    compliance: [{ id: 'c1', title: 'Annual report', due: '2025-03-15' }],
  };
  const lead = collectItems(data, { role: 'lead', userId: 'u4' });
  assert.deepEqual([...new Set(lead.map((i) => i.type))].sort(), ['events', 'sessions', 'shifts', 'tasks']);
  assert.equal(lead.filter((i) => i.type === 'tasks').length, 1);
  const ed = collectItems(data, { role: 'ed', userId: 'u1' });
  assert.equal(ed.length, 1 + 1 + 2 + 1 + 1 + 1 + 1);
  assert.equal(ed.find((i) => i.type === 'meetings').time, '18:30');
  assert.deepEqual(collectItems(data, { role: 'ed', userId: 'u1', types: ['events'] }).map((i) => i.type), ['events']);
  assert.deepEqual(collectItems({}, { role: 'ed' }), []);
  assert.ok(!typesFor('volunteer').includes('grants'));
  assert.equal(agenda(ed, '2025-03-10', 3).length, ed.filter((i) => i.date >= '2025-03-10' && i.date <= '2025-03-13').length);
});

// ---- usage ----
test('segmentOf keeps only the route segment', () => {
  assert.equal(segmentOf('#/money/grants/gr1'), 'money');
  assert.equal(segmentOf('#/f/board/meeting/m1'), 'f/board');
  assert.equal(segmentOf(''), 'today');
  assert.equal(segmentOf('#/people/c1'), 'people');
  assert.equal(segmentOf('#/Dana Brooks'), 'other');
});
test('usage counting stores only counts', () => {
  let u = recordView({}, '2025-03-01', '#/people/c1');
  u = recordView(u, '2025-03-01', '#/people');
  u = recordAction(u, '2025-03-01', 'approve');
  u = recordAction(u, '2025-03-02', 'Dana Brooks!');
  assert.deepEqual(u.days['2025-03-01'], { views: { people: 2 }, actions: { approve: 1 } });
  assert.equal(u.days['2025-03-02'].actions.other, 1);
  assert.ok(!JSON.stringify(u).includes('c1'));
});
test('usage summary: 30 days, totals, prunes old days', () => {
  let u = {};
  for (let i = 0; i < 100; i++) u = recordView(u, new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10), '#/today');
  assert.equal(Object.keys(u.days).length, 90);
  const s = summarize(u, '2025-04-10', 30);
  assert.equal(s.rows.length, 30);
  assert.equal(s.totalViews, 30);
  assert.deepEqual(s.pages, [['today', 30]]);
});

// ---- intake ----
test('kiosk PIN', () => {
  assert.ok(validPin('1234') && !validPin('123') && !validPin('12a4') && !validPin('12345'));
  assert.ok(checkPin('2468', undefined) && checkPin('2468', 'bad'));
  assert.ok(checkPin('1111', '1111') && !checkPin('2468', '1111'));
});
test('intake validation: name, consent, no SSN/DOB', () => {
  const base = { firstName: 'Jamie', lastName: 'R.', consent: true, needs: ['housing', 'bogus'], contactMethod: 'text', phone: '555-0100' };
  assert.deepEqual(cleanSubmission(base).value.needs, ['housing']);
  assert.ok(cleanSubmission({ ...base, firstName: ' ' }).error);
  assert.ok(cleanSubmission({ ...base, consent: false }).error);
  assert.ok(cleanSubmission({ ...base, note: 'my ssn is 123-45-6789' }).error);
  assert.ok(looksSensitive('born 4/12/1990') && !looksSensitive('need a ride on Tuesday'));
  assert.equal(cleanSubmission({ ...base, contactMethod: 'carrier pigeon' }).value.contactMethod, 'none');
});
test('toParticipant matches the participant shape', () => {
  const sub = cleanSubmission({ firstName: 'Jamie', lastName: 'R.', consent: true, needs: ['legal'], note: 'hello' }).value;
  const p = toParticipant(sub, { id: 'c9', leadId: 'u4', today: '2025-03-01', by: 'u1', noteId: 'n9' });
  assert.deepEqual(Object.keys(p).sort(), ['consent', 'created', 'goals', 'id', 'leadId', 'name', 'needs', 'notes']);
  assert.equal(p.name, 'Jamie R.');
  assert.equal(p.consent, true);
  assert.match(p.notes[0].text, /hello/);
});

// ---- accessibility: contrast of CSS colour pairs ----
const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const full = (h) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h);
const vars = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6})\b/gi)].map((m) => [m[1], full(m[2])]));
const light = vars(css.match(/:root\s*\{([^}]*)\}/)[1]);
const dark = { ...light, ...vars(css.match(/prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/)[1]) };
test('text colours meet WCAG AA 4.5:1 in light and dark', () => {
  for (const [mode, v] of [['light', light], ['dark', dark]]) {
    for (const [fg, bg] of [['ink', 'bg'], ['ink', 'card'], ['muted', 'bg'], ['muted', 'card'], ['accent', 'card'], ['accent', 'bg'], ['on-accent', 'accent'], ['bad', 'card']]) {
      assert.ok(ratio(v[fg], v[bg]) >= 4.5, `${mode}: ${fg} on ${bg} = ${ratio(v[fg], v[bg]).toFixed(2)}`);
    }
  }
  for (const [fg, bg] of [['#1f6350', '#d9efe6'], ['#7a4f0e', '#fbecc9'], ['#8f2b28', '#f6d6d4']]) assert.ok(ratio(fg, bg) >= 4.5, `${fg} on ${bg}`);
  for (const f of ['#1f6350', '#7a4f0e', '#8f2b28']) assert.ok(css.includes(f), `pill colour ${f} is in the CSS`);
});
