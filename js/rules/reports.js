// Activity report math. Pure: takes the data collections, returns numbers.
import { expenseStatus, round2 } from '../rules.js';
import { addDays, inRange, parts, ymd, lastDay } from './dates.js';

/** Date range presets relative to `today` ('YYYY-MM-DD'). */
export function rangePreset(name, today) {
  const { y, m } = parts(today);
  if (name === 'lastMonth') { const py = m === 1 ? y - 1 : y; const pm = m === 1 ? 12 : m - 1; return { from: ymd(py, pm, 1), to: ymd(py, pm, lastDay(py, pm)) }; }
  if (name === 'lastQuarter') {
    const q = Math.floor((m - 1) / 3); // current quarter 0-3
    const py = q === 0 ? y - 1 : y; const pq = q === 0 ? 3 : q - 1;
    return { from: ymd(py, pq * 3 + 1, 1), to: ymd(py, pq * 3 + 3, lastDay(py, pq * 3 + 3)) };
  }
  if (name === 'ytd') return { from: ymd(y, 1, 1), to: today };
  return { from: addDays(today, -30), to: today };
}

const shiftHours = (s) => {
  if (Number.isFinite(Number(s.hours)) && s.hours !== '' && s.hours != null) return Number(s.hours);
  return 0;
};
const shiftDate = (s) => s.date || (s.start ? String(s.start).slice(0, 10) : '');

/**
 * data: { sessions, events, participants, expenses, users, programs, grants, referrals?, volunteerShifts? }
 * opts: { from, to, programId?, grantId? }. Grant filter narrows expenses (sessions are not tied to grants).
 */
export function buildReport(data, { from, to, programId = '', grantId = '' }) {
  const users = data.users || [];
  const progName = (id) => (data.programs || []).find((p) => p.id === id)?.name || id || 'Unassigned';
  const sessions = (data.sessions || []).filter((s) => inRange(s.date, from, to) && (!programId || s.programId === programId));
  const people = new Set(sessions.flatMap((s) => s.attendees || []));
  const byProgram = {};
  for (const s of sessions) {
    const b = (byProgram[s.programId] ||= { programId: s.programId, name: progName(s.programId), sessions: 0, hours: 0, ids: new Set() });
    b.sessions++; b.hours += Number(s.hours || 0); (s.attendees || []).forEach((a) => b.ids.add(a));
  }
  const programs = Object.values(byProgram).map((b) => ({ programId: b.programId, name: b.name, sessions: b.sessions, hours: round2(b.hours), people: b.ids.size }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const events = (data.events || []).filter((e) => inRange(e.date, from, to));
  const exps = (data.expenses || []).filter((e) => inRange(e.date, from, to) && (!programId || e.programId === programId)
    && (!grantId || e.grantId === grantId) && expenseStatus(e, users) === 'approved');
  const tally = (keyFn) => {
    const m = {};
    for (const e of exps) { const k = keyFn(e); m[k] = (m[k] || 0) + Number(e.amount || 0); }
    return Object.entries(m).map(([name, total]) => ({ name, total: round2(total) })).sort((a, b) => b.total - a.total);
  };
  const grantName = (id) => (data.grants || []).find((g) => g.id === id)?.name || 'No grant';

  const out = {
    range: { from, to }, programId, grantId,
    peopleServed: people.size,
    sessions: sessions.length,
    hours: round2(sessions.reduce((n, s) => n + Number(s.hours || 0), 0)),
    programs,
    events: { count: events.length, checkins: events.reduce((n, e) => n + Number(e.checkins || 0), 0) },
    expenses: {
      total: round2(exps.reduce((n, e) => n + Number(e.amount || 0), 0)), count: exps.length,
      byProgram: tally((e) => progName(e.programId)), byCategory: tally((e) => e.category || 'Other'), byGrant: tally((e) => grantName(e.grantId)),
    },
    newParticipants: (data.participants || []).filter((p) => inRange(p.created, from, to)).length,
    referrals: Array.isArray(data.referrals) ? data.referrals.filter((r) => inRange(r.sent, from, to)).length : null,
    volunteer: null,
  };
  if (Array.isArray(data.volunteerShifts)) {
    const sh = data.volunteerShifts.filter((s) => inRange(shiftDate(s), from, to));
    out.volunteer = { shifts: sh.length, hours: round2(sh.reduce((n, s) => n + shiftHours(s), 0)) };
  }
  return out;
}

export function reportRows(r) {
  const rows = [['Activity report'], ['From', r.range.from, 'To', r.range.to], [],
    ['People served (unique)', r.peopleServed], ['Sessions', r.sessions], ['Hours', r.hours],
    ['New participants', r.newParticipants], ['Events', r.events.count], ['Event check-ins', r.events.checkins]];
  if (r.referrals != null) rows.push(['Referrals made', r.referrals]);
  if (r.volunteer) rows.push(['Volunteer shifts', r.volunteer.shifts], ['Volunteer hours', r.volunteer.hours]);
  rows.push([], ['Program', 'People', 'Sessions', 'Hours'], ...r.programs.map((p) => [p.name, p.people, p.sessions, p.hours]));
  rows.push([], ['Approved expenses', r.expenses.total], ['By program', 'Total'], ...r.expenses.byProgram.map((x) => [x.name, x.total]));
  rows.push(['By category', 'Total'], ...r.expenses.byCategory.map((x) => [x.name, x.total]));
  rows.push(['By grant', 'Total'], ...r.expenses.byGrant.map((x) => [x.name, x.total]));
  return rows;
}
