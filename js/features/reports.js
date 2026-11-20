import { register } from './registry.js';
import { store } from '../store.js';
import { esc, today, fmtDate, D, field, options, download, toCSV, printHtml } from '../ui.js';
import { canSeeMoney, money } from '../rules.js';
import { rangePreset, buildReport, reportRows } from '../rules/reports.js';

const PRESETS = [['lastMonth', 'Last month'], ['lastQuarter', 'Last quarter'], ['ytd', 'Year to date'], ['custom', 'Custom range']];
const st = { preset: 'lastMonth', programId: '', grantId: '', ...rangePreset('lastMonth', today()) };

function compute() {
  const d = D(), money_ = canSeeMoney(store.user);
  return buildReport({ users: d.users, programs: d.programs, grants: d.grants, participants: d.participants, sessions: d.sessions, events: d.events,
    expenses: money_ ? d.expenses : [], referrals: d.referrals, volunteerShifts: d.volunteerShifts }, st);
}

const table = (head, rows) => `<table><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;

function body(r, showMoney) {
  const stat = (b, s) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`;
  const scope = [st.programId && D().programs.find((p) => p.id === st.programId)?.name, st.grantId && D().grants.find((g) => g.id === st.grantId)?.name].filter(Boolean);
  return `<p class="muted">${fmtDate(r.range.from)} – ${fmtDate(r.range.to)}${scope.length ? ` · ${esc(scope.join(' · '))}` : ''}</p>
    <div class="stats">${stat(r.peopleServed, 'People served')}${stat(r.sessions, 'Sessions')}${stat(r.hours, 'Hours')}</div>
    <div class="stats">${stat(r.newParticipants, 'New participants')}${stat(r.events.count, 'Events')}${stat(r.events.checkins, 'Check-ins')}</div>
    ${r.referrals != null || r.volunteer ? `<div class="stats">${r.referrals != null ? stat(r.referrals, 'Referrals made') : ''}${r.volunteer ? stat(r.volunteer.hours, `Volunteer hrs (${r.volunteer.shifts} shifts)`) : ''}</div>` : ''}
    <h2>By program</h2>${r.programs.length ? table(['Program', 'People', 'Sessions', 'Hours'], r.programs.map((p) => [p.name, p.people, p.sessions, p.hours])) : '<p class="muted">No sessions in this range.</p>'}
    ${showMoney ? `<h2>Approved expenses: ${money(r.expenses.total)}</h2>
      ${r.expenses.count ? table(['Program', 'Total'], r.expenses.byProgram.map((x) => [x.name, money(x.total)]))
        + table(['Category', 'Total'], r.expenses.byCategory.map((x) => [x.name, money(x.total)]))
        + table(['Grant', 'Total'], r.expenses.byGrant.map((x) => [x.name, money(x.total)])) : '<p class="muted">No approved expenses in this range.</p>'}` : ''}`;
}

register({
  id: 'reports', title: 'Activity reports', icon: '📊', group: 'Reports', roles: ['ed', 'treasurer', 'board', 'lead'],
  view() {
    const r = compute(), showMoney = canSeeMoney(store.user), custom = st.preset === 'custom';
    return `<h1>Activity report</h1>
      <section class="card">
        ${field('Period', `<select data-act="reports-set" data-k="preset">${options(PRESETS, st.preset)}</select>`)}
        ${custom ? field('From', `<input type="date" data-act="reports-set" data-k="from" value="${st.from}">`) + field('To', `<input type="date" data-act="reports-set" data-k="to" value="${st.to}">`) : ''}
        ${field('Program', `<select data-act="reports-set" data-k="programId">${options([['', 'All programs'], ...D().programs.map((p) => [p.id, p.name])], st.programId)}</select>`)}
        ${showMoney ? field('Grant (expenses)', `<select data-act="reports-set" data-k="grantId">${options([['', 'All grants'], ...D().grants.map((g) => [g.id, g.name])], st.grantId)}</select>`) : ''}
      </section>
      <section class="card">${body(r, showMoney)}</section>
      <div class="acts"><button class="btn" data-act="reports-csv">Export CSV</button><button class="btn primary" data-act="reports-print">Print / PDF</button></div>`;
  },
  actions: {
    'reports-csv': () => { download(`activity-report-${st.from}-to-${st.to}.csv`, toCSV(reportRows(compute())), 'text/csv'); return false; },
    'reports-print': () => {
      printHtml('Activity report', `<h1>Harriet Tubman Foundation for Safe Passage — Activity report</h1>${body(compute(), canSeeMoney(store.user))}<p class="muted">Prepared ${fmtDate(today())} by ${esc(store.user.name)}</p>`);
      return false;
    },
  },
  changes: {
    'reports-set': (el) => {
      st[el.dataset.k] = el.value;
      if (el.dataset.k === 'preset' && el.value !== 'custom') Object.assign(st, rangePreset(el.value, today()));
      return true;
    },
  },
});
