import { store } from './store.js';
import {
  ROLES, LARGE_EXPENSE, expenseStatus, canApprove, openSlots, grantSummary,
  upcomingDeadlines, canSeeCaseNotes, canSeeMoney, programStats, daysUntil, money,
} from './rules.js';

export const VERSION = '0.2.0';

const NEEDS = { housing: 'Housing', employment: 'Employment', legal: 'Legal help', financial: 'Financial coaching',
  healing: 'Healing arts', mentorship: 'Mentorship' };
const CATEGORIES = ['Supplies', 'Food', 'Facilities', 'Mileage/fuel', 'Travel', 'Stipends', 'Printing', 'Other'];

import {
  $, esc, today, fmtDate, relDays, D, users, ui, toast, sheet, closeSheet, field, options, download, toCSV, shrinkImage,
} from './ui.js';
import { features, feature } from './features/registry.js';
import './features/index.js';

const prog = (id) => D().programs.find((p) => p.id === id);
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function statusPill(s) {
  return `<span class="pill ${s}">${{ approved: 'Approved', pending: 'Pending', rejected: 'Rejected' }[s]}</span>`;
}

// ---------- views ----------
const views = {
  today() {
    const u = store.user;
    const myTasks = D().tasks.filter((t) => !t.done && (t.ownerId === u.id || u.role === 'ed'));
    const approvals = D().expenses.filter((e) => canApprove(e, u, users()));
    const deadlines = upcomingDeadlines(D().grants);
    const upcomingSessions = D().sessions.filter((s) => daysUntil(s.date) >= 0 && daysUntil(s.date) <= 7);
    const upcomingEvents = D().events.filter((e) => daysUntil(e.date) >= 0 && daysUntil(e.date) <= 14);
    const people = D().participants.length;
    // Feature cards; safety alerts (class "card alert") go to the top of the screen.
    const featureCards = features.map((f) => (f.today && (!f.roles || f.roles.includes(u.role)) ? f.today() : '')).filter(Boolean);
    const monthSessions = D().sessions.filter((s) => daysUntil(s.date) > -31 && daysUntil(s.date) <= 0).length;

    return `
      <h1 class="greet">Hi, ${esc(u.name.split(' ')[0])}</h1>
      <p class="muted">${esc(ROLES[u.role])} · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      <div class="quick">
        <button class="qa" data-act="add-expense"><i aria-hidden="true">🧾</i><span>Expense</span></button>
        <button class="qa" data-act="add-session"><i aria-hidden="true">📝</i><span>Session</span></button>
        <button class="qa" data-act="add-participant"><i aria-hidden="true">👤</i><span>Person</span></button>
        <button class="qa" data-act="add-task"><i aria-hidden="true">✅</i><span>Task</span></button>
      </div>
      ${featureCards.filter((h) => h.includes('card alert')).join('')}
      <div class="stats">
        <div class="stat"><b>${people}</b><span>People served</span></div>
        <div class="stat"><b>${monthSessions}</b><span>Sessions, 30 days</span></div>
        <div class="stat"><b>${approvals.length}</b><span>Need your OK</span></div>
      </div>
      ${approvals.length ? `<section class="card"><h3>Waiting for your approval</h3>${approvals.map(expenseRow).join('')}</section>` : ''}
      <section class="card"><h3>My tasks</h3>
        ${myTasks.length ? myTasks.map((t) => `<label class="row check"><input type="checkbox" data-act="task-done" data-id="${t.id}">
          <span class="grow">${esc(t.text)}<small>${esc(store.userName(t.ownerId))} · due ${relDays(daysUntil(t.due))}</small></span></label>`).join('')
          : '<p class="empty">Nothing due. Nice.</p>'}
      </section>
      ${canSeeMoney(u) ? `<section class="card"><h3>Grant deadlines (14 days)</h3>
        ${deadlines.length ? deadlines.map((d) => `<a class="row" href="#/money/grants/${d.grantId}"><span class="grow">${esc(d.label)}<small>${esc(d.grant)}</small></span>
          <span class="pill ${d.days < 0 ? 'rejected' : d.days <= 7 ? 'pending' : ''}">${relDays(d.days)}</span></a>`).join('')
          : '<p class="empty">No reports due soon.</p>'}</section>` : ''}
      ${featureCards.filter((h) => !h.includes('card alert')).join('')}
      <section class="card"><h3>Coming up</h3>
        ${[...upcomingSessions.map((s) => ({ date: s.date, t: `${prog(s.programId)?.name} session`, sub: s.note })),
          ...upcomingEvents.map((e) => ({ date: e.date, t: e.name, sub: e.place }))]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((x) => `<div class="row"><span class="date">${fmtDate(x.date)}</span><span class="grow">${esc(x.t)}<small>${esc(x.sub)}</small></span></div>`).join('')
          || '<p class="empty">Nothing scheduled this week.</p>'}
      </section>`;
  },

  people(id) {
    if (id) return personView(id);
    const q = (views.people.q || '').toLowerCase();
    const list = D().participants.filter((p) => p.name.toLowerCase().includes(q));
    return `
      <div class="head"><h1>People</h1><button class="btn primary" data-act="add-participant">+ Add</button></div>
      <input class="search" type="search" aria-label="Search people" placeholder="Search people" value="${esc(views.people.q || '')}" data-act="search-people">
      <section class="card list">
        ${list.map((p) => `<a class="row" href="#/people/${p.id}"><span class="avatar">${esc(p.name[0])}</span>
          <span class="grow">${esc(p.name)}<small>${p.needs.map((n) => NEEDS[n]).join(' · ') || 'No needs listed'}</small></span>
          ${p.consent ? '' : '<span class="pill pending">No consent</span>'}</a>`).join('') || '<p class="empty">No people yet.</p>'}
      </section>`;
  },

  programs() {
    const u = store.user;
    return `
      <div class="head"><h1>Programs</h1><button class="btn primary" data-act="add-session">+ Session</button></div>
      <div class="prog-grid">${D().programs.map((p) => {
        const s = programStats(p.id, D().sessions);
        return `<div class="prog" style="--c:${p.color}"><h3>${esc(p.name)}</h3>
          <p><b>${s.people}</b> people · <b>${s.sessions}</b> sessions · <b>${s.hours}</b> hrs</p></div>`;
      }).join('')}</div>
      <section class="card"><h3>Recent sessions</h3>
        ${[...D().sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map((s) => `<div class="row">
          <span class="date">${fmtDate(s.date)}</span><span class="grow">${esc(prog(s.programId)?.name)}<small>${esc(s.note || '')} · ${s.attendees.length} attended · ${s.hours} h</small></span></div>`).join('')
          || '<p class="empty">No sessions logged.</p>'}
      </section>
      <div class="head"><h2>Events</h2>${u.role !== 'volunteer' ? '<button class="btn" data-act="add-event">+ Event</button>' : ''}</div>
      <section class="card">
        ${[...D().events].sort((a, b) => b.date.localeCompare(a.date)).map((e) => `<div class="row">
          <span class="date">${fmtDate(e.date)}</span><span class="grow">${esc(e.name)}<small>${esc(e.place)}</small></span>
          <span class="counter"><b>${e.checkins}</b><button class="btn small" data-act="checkin" data-id="${e.id}" aria-label="Check someone in to ${esc(e.name)}">+1</button></span></div>`).join('')
          || '<p class="empty">No events yet.</p>'}
      </section>`;
  },

  money(sub, id) {
    const u = store.user;
    if (sub === 'grants' && id) return grantView(id);
    const tab = sub || 'expenses';
    const tabs = `<nav class="tabs" aria-label="Money sections">${[['expenses', 'Expenses'], ['approvals', 'Approvals'], ['grants', 'Grants']]
      .map(([k, l]) => `<a href="#/money/${k}" class="${tab === k ? 'on' : ''}"${tab === k ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
    let body = '';
    if (tab === 'expenses') {
      const list = [...D().expenses].filter((e) => canSeeMoney(u) || e.submittedBy === u.id).sort((a, b) => b.date.localeCompare(a.date));
      body = `<section class="card">${list.map(expenseRow).join('') || '<p class="empty">No expenses yet.</p>'}</section>`;
    } else if (tab === 'approvals') {
      const mine = D().expenses.filter((e) => canApprove(e, u, users()));
      const pending = D().expenses.filter((e) => expenseStatus(e, users()) === 'pending' && !mine.includes(e));
      body = `<p class="muted rules">Rules: nobody approves their own expense · ${money(LARGE_EXPENSE)}+ needs Treasurer <i>and</i> ED ·
        related-party items need Board + Treasurer.</p>
        <section class="card"><h3>For you</h3>${mine.map(expenseRow).join('') || '<p class="empty">Nothing for you to approve.</p>'}</section>
        <section class="card"><h3>Waiting on others</h3>${pending.map(expenseRow).join('') || '<p class="empty">None.</p>'}</section>`;
    } else {
      body = `${canSeeMoney(u) && u.role !== 'board' ? '<div class="head"><span></span><button class="btn primary" data-act="add-grant">+ Grant</button></div>' : ''}
        ${D().grants.map((g) => {
          const s = grantSummary(g, D().expenses, users());
          return `<a class="card grant" href="#/money/grants/${g.id}"><h3>${esc(g.name)}</h3><small>${esc(g.funder)}</small>
            <div class="bar ${s.over ? 'over' : ''}"><i style="width:${Math.min(100, s.pct)}%"></i></div>
            <p>${money(s.spent)} of ${money(g.amount)} spent · ${money(s.remaining)} left</p></a>`;
        }).join('') || '<p class="empty card">No grants yet.</p>'}`;
    }
    return `<div class="head"><h1>Money</h1><button class="btn primary" data-act="add-expense">+ Expense</button></div>${tabs}${body}`;
  },

  more() {
    const u = store.user;
    const visible = features.filter((f) => f.view && (!f.roles || f.roles.includes(u.role)));
    const groups = [...new Set(visible.map((f) => f.group || 'Tools'))];
    return `<h1>More</h1>
      ${groups.map((g) => `<h2 class="hub-h">${esc(g)}</h2><div class="hub">${visible.filter((f) => (f.group || 'Tools') === g)
        .map((f) => `<a class="hub-item" href="#/f/${f.id}"><span aria-hidden="true">${f.icon || '•'}</span>${esc(f.title)}</a>`).join('')}</div>`).join('')}
      <section class="card"><h3>Signed in as</h3>
        ${field('Person', `<select data-act="switch-user">${options(users().map((x) => [x.id, `${x.name} — ${ROLES[x.role]}`]), u.id)}</select>`)}
        <p class="muted">${store.isDemo ? 'Demo mode lets you try every role.' : 'Real sign-in arrives with the secure backend.'}</p>
      </section>
      <section class="card"><h3>Display</h3>
        <label class="row check"><input type="checkbox" data-act="settings-largetext" ${document.body.classList.contains('large-text') ? 'checked' : ''}><span class="grow">Large text<small>Bigger type. Saved on this device only.</small></span></label>
      </section>
      <section class="card"><h3>Workspace</h3>
        <div class="seg">
          <button class="${store.isDemo ? 'on' : ''}" aria-pressed="${store.isDemo}" data-act="ws" data-ws="demo">Demo data</button>
          <button class="${!store.isDemo ? 'on' : ''}" aria-pressed="${!store.isDemo}" data-act="ws" data-ws="live">Live (this device)</button>
        </div>
        <p class="muted">Demo and live data are kept completely separate. Live data stays on this device until the secure backend is connected — don't enter real participant details yet.</p>
        ${store.isDemo ? '<button class="btn" data-act="reset-demo">Reset demo data</button>' : ''}
        <button class="btn" data-act="export">Export data (JSON)</button>
      </section>
      ${u.role === 'ed' ? `<section class="card"><h3>Team</h3>${users().map((x) => `<div class="row"><span class="avatar">${esc(x.name[0])}</span>
        <span class="grow">${esc(x.name)}<small>${ROLES[x.role]}</small></span></div>`).join('')}
        <button class="btn" data-act="add-user">+ Add team member</button></section>` : ''}
      ${['ed', 'treasurer', 'board'].includes(u.role) ? `<section class="card"><h3>Activity log</h3>
        ${D().audit.slice(0, 25).map((a) => `<div class="row"><span class="grow">${esc(a.action)}<small>${esc(a.detail)} · ${a.userId ? esc(store.userName(a.userId)) : "Anonymous"} · ${new Date(a.at).toLocaleString()}</small></span></div>`).join('')
        || '<p class="empty">No changes yet.</p>'}</section>` : ''}
      <section class="card"><h3>About</h3><p>Safe Passage Ops v${VERSION}</p>
        <p class="muted">Operations app for the Harriet Tubman Foundation for Safe Passage, Tacoma, WA.</p></section>`;
  },
};

function expenseRow(e) {
  const s = expenseStatus(e, users());
  const u = store.user;
  const open = openSlots(e, users()).map((r) => r.map((x) => ROLES[x]).join(' or ')).join(', ');
  return `<div class="row exp">
    <span class="grow">${esc(e.vendor)} <b>${money(e.amount)}</b>
      <small>${fmtDate(e.date)} · ${esc(e.category)} · ${esc(prog(e.programId)?.name || '')} · by ${esc(store.userName(e.submittedBy))}
      ${e.relatedParty ? ' · <span class="flag">Related party</span>' : ''}${s === 'pending' ? ` · needs ${esc(open)}` : ''}</small>
      ${e.receipt ? `<img class="receipt" src="${e.receipt}" alt="Receipt from ${esc(e.vendor)}">` : ''}</span>
    ${canApprove(e, u, users()) ? `<span class="acts"><button class="btn small primary" data-act="approve" data-id="${e.id}">Approve</button>
      <button class="btn small ghost" data-act="reject" data-id="${e.id}">Reject</button></span>` : statusPill(s)}
  </div>`;
}

function personView(id) {
  const p = D().participants.find((x) => x.id === id);
  if (!p) return '<p class="empty">Not found.</p>';
  const u = store.user;
  const sessions = D().sessions.filter((s) => s.attendees.includes(p.id));
  const notes = canSeeCaseNotes(u, p);
  return `<a class="back" href="#/people">‹ People</a>
    <div class="head"><h1>${esc(p.name)}</h1></div>
    <p class="muted">Lead: ${esc(store.userName(p.leadId))} · Since ${fmtDate(p.created)} · ${p.consent ? 'Consent on file' : '<b>No consent on file</b>'}</p>
    <div class="chips">${p.needs.map((n) => `<span class="chip">${NEEDS[n]}</span>`).join('')}</div>
    <section class="card"><div class="head"><h3>Goals</h3><button class="btn small" data-act="add-goal" data-id="${p.id}">+ Goal</button></div>
      ${p.goals.map((g) => `<label class="row check"><input type="checkbox" ${g.done ? 'checked' : ''} data-act="goal" data-id="${p.id}" data-g="${g.id}">
        <span class="grow ${g.done ? 'done' : ''}">${esc(g.text)}</span></label>`).join('') || '<p class="empty">No goals yet.</p>'}
    </section>
    <section class="card"><h3>Sessions attended (${sessions.length})</h3>
      ${sessions.map((s) => `<div class="row"><span class="date">${fmtDate(s.date)}</span><span class="grow">${esc(prog(s.programId)?.name)}</span></div>`).join('') || '<p class="empty">None yet.</p>'}
    </section>
    <section class="card"><div class="head"><h3>Case notes <span aria-hidden="true">🔒</span></h3>${notes ? `<button class="btn small" data-act="add-note" data-id="${p.id}">+ Note</button>` : ''}</div>
      ${notes ? p.notes.map((n) => `<div class="row"><span class="grow">${esc(n.text)}<small>${esc(store.userName(n.by))} · ${fmtDate(n.date)}</small></span></div>`).join('') || '<p class="empty">No notes.</p>'
        : '<p class="empty">Only the assigned lead and the Executive Director can see case notes.</p>'}
    </section>`;
}

function grantView(id) {
  const g = D().grants.find((x) => x.id === id);
  if (!g) return '<p class="empty">Not found.</p>';
  const s = grantSummary(g, D().expenses, users());
  const exp = D().expenses.filter((e) => e.grantId === g.id);
  return `<a class="back" href="#/money/grants">‹ Grants</a><h1>${esc(g.name)}</h1>
    <p class="muted">${esc(g.funder)} · ${fmtDate(g.start)} – ${fmtDate(g.end)}</p>
    <section class="card"><div class="bar big ${s.over ? 'over' : ''}"><i style="width:${Math.min(100, s.pct)}%"></i></div>
      <div class="stats"><div class="stat"><b>${money(s.spent)}</b><span>Spent (${s.pct}%)</span></div>
      <div class="stat"><b>${money(s.pending)}</b><span>Pending</span></div><div class="stat"><b>${money(s.remaining)}</b><span>Left of ${money(g.amount)}</span></div></div>
    </section>
    <section class="card"><div class="head"><h3>Deadlines</h3><button class="btn small" data-act="add-deadline" data-id="${g.id}">+ Deadline</button></div>
      ${g.deadlines.map((d) => `<label class="row check"><input type="checkbox" ${d.done ? 'checked' : ''} data-act="deadline" data-id="${g.id}" data-d="${d.id}">
        <span class="grow ${d.done ? 'done' : ''}">${esc(d.label)}<small>${fmtDate(d.date)} · ${relDays(daysUntil(d.date))}</small></span></label>`).join('') || '<p class="empty">None.</p>'}
    </section>
    <section class="card"><h3>Expenses</h3>${exp.map(expenseRow).join('') || '<p class="empty">None charged yet.</p>'}</section>
    <button class="btn" data-act="report" data-id="${g.id}">Download report (CSV)</button>`;
}

// ---------- forms ----------
const forms = {
  'add-expense'() {
    const progOpts = options(D().programs.map((p) => [p.id, p.name]));
    const grantOpts = options([['', '— None —'], ...D().grants.map((g) => [g.id, g.name])]);
    sheet('New expense', `
      ${field('Receipt photo', '<input type="file" name="receipt" accept="image/*" capture="environment">')}
      ${field('Vendor', '<input name="vendor" required maxlength="80">')}
      ${field('Amount ($)', '<input name="amount" type="number" step="0.01" min="0.01" required inputmode="decimal">')}
      ${field('Date', `<input name="date" type="date" value="${today()}" required>`)}
      ${field('Category', `<select name="category">${options(CATEGORIES.map((c) => [c, c]))}</select>`)}
      ${field('Program', `<select name="programId">${progOpts}</select>`)}
      ${field('Charge to grant', `<select name="grantId">${grantOpts}</select>`)}
      <label class="row check"><input type="checkbox" name="relatedParty"><span class="grow">Involves a board member, officer, their family or their business
        <small>Sends it to the board for approval</small></span></label>`,
    async (f, form) => {
      if (!form.reportValidity()) return false;
      const receipt = await shrinkImage(f.get('receipt'));
      store.change('Expense submitted', `${f.get('vendor')} ${money(f.get('amount'))}`, (d) => d.expenses.push({
        id: store.id('x'), date: f.get('date'), vendor: f.get('vendor').trim(), amount: Number(f.get('amount')),
        category: f.get('category'), programId: f.get('programId'), grantId: f.get('grantId') || null,
        submittedBy: store.user.id, relatedParty: f.get('relatedParty') === 'on', approvals: [], receipt,
      }));
      toast('Expense submitted for approval');
    });
  },
  'add-session'() {
    const people = D().participants.map((p) => `<label class="row check"><input type="checkbox" name="att" value="${p.id}"><span class="grow">${esc(p.name)}</span></label>`).join('');
    sheet('Log a session', `
      ${field('Program', `<select name="programId">${options(D().programs.map((p) => [p.id, p.name]))}</select>`)}
      ${field('Date', `<input name="date" type="date" value="${today()}" required>`)}
      ${field('Hours', '<input name="hours" type="number" step="0.25" min="0" value="1" required>')}
      ${field('What happened', '<input name="note" maxlength="140">')}
      <fieldset><legend>Attendance</legend>${people || '<p class="empty">Add people first.</p>'}</fieldset>`,
    (f, form) => {
      if (!form.reportValidity()) return false;
      store.change('Session logged', prog(f.get('programId'))?.name, (d) => d.sessions.push({
        id: store.id('s'), programId: f.get('programId'), date: f.get('date'), hours: Number(f.get('hours')),
        note: f.get('note'), attendees: f.getAll('att'),
      }));
      toast('Session saved');
    });
  },
  'add-participant'() {
    const leads = users().filter((x) => ['ed', 'lead'].includes(x.role)).map((x) => [x.id, x.name]);
    sheet('Add a person', `
      ${field('Name', '<input name="name" required maxlength="80" autocomplete="off">')}
      <fieldset><legend>Needs</legend>${Object.entries(NEEDS).map(([k, l]) => `<label class="row check"><input type="checkbox" name="needs" value="${k}"><span class="grow">${l}</span></label>`).join('')}</fieldset>
      ${field('Assigned lead', `<select name="leadId">${options(leads, store.user.id)}</select>`)}
      <label class="row check"><input type="checkbox" name="consent"><span class="grow">Consent to store their information is on file</span></label>
      <p class="muted">Collect only what's needed. Never record Social Security numbers.</p>`,
    (f, form) => {
      if (!form.reportValidity()) return false;
      store.change('Person added', f.get('name'), (d) => d.participants.push({
        id: store.id('c'), name: f.get('name').trim(), needs: f.getAll('needs'), leadId: f.get('leadId'),
        consent: f.get('consent') === 'on', created: today(), goals: [], notes: [],
      }));
      toast('Person added');
    });
  },
  'add-task'() {
    sheet('New task', `
      ${field('Task', '<input name="text" required maxlength="120">')}
      ${field('Owner', `<select name="ownerId">${options(users().map((x) => [x.id, x.name]), store.user.id)}</select>`)}
      ${field('Due', `<input name="due" type="date" value="${today()}" required>`)}`,
    (f, form) => {
      if (!form.reportValidity()) return false;
      store.change('Task added', f.get('text'), (d) => d.tasks.push({ id: store.id('t'), text: f.get('text'), ownerId: f.get('ownerId'), due: f.get('due'), done: false }));
    });
  },
  'add-event'() {
    sheet('New event', `${field('Name', '<input name="name" required maxlength="80">')}
      ${field('Date', `<input name="date" type="date" value="${today()}" required>`)}${field('Place', '<input name="place" maxlength="80">')}`,
    (f, form) => {
      if (!form.reportValidity()) return false;
      store.change('Event added', f.get('name'), (d) => d.events.push({ id: store.id('e'), name: f.get('name'), date: f.get('date'), place: f.get('place'), checkins: 0 }));
    });
  },
  'add-grant'() {
    sheet('New grant', `${field('Grant name', '<input name="name" required maxlength="80">')}${field('Funder', '<input name="funder" required maxlength="80">')}
      ${field('Amount ($)', '<input name="amount" type="number" min="0" step="1" required>')}
      ${field('Start', `<input name="start" type="date" value="${today()}" required>`)}${field('End', '<input name="end" type="date" required>')}
      ${field('First report due', '<input name="due" type="date">')}`,
    (f, form) => {
      if (!form.reportValidity()) return false;
      store.change('Grant added', f.get('name'), (d) => d.grants.push({
        id: store.id('gr'), name: f.get('name'), funder: f.get('funder'), amount: Number(f.get('amount')), start: f.get('start'), end: f.get('end'),
        deadlines: f.get('due') ? [{ id: store.id('d'), label: 'Report due', date: f.get('due'), done: false }] : [],
      }));
    });
  },
  'add-user'() {
    sheet('Add team member', `${field('Name', '<input name="name" required maxlength="60">')}
      ${field('Role', `<select name="role">${options(Object.entries(ROLES))}</select>`)}`,
    (f, form) => {
      if (!form.reportValidity()) return false;
      store.change('Team member added', `${f.get('name')} (${ROLES[f.get('role')]})`, (d) => d.users.push({ id: store.id('u'), name: f.get('name'), role: f.get('role') }));
    });
  },
};



// ---------- actions ----------
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.tagName === 'SELECT' || el.matches('input[type=search]')) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  if (forms[act]) return forms[act]();
  for (const f of features) {
    if (f.forms?.[act]) return f.forms[act](el);
    if (f.actions?.[act]) { if (f.actions[act](el)) render(); return; }
  }
  const d = D();
  switch (act) {
    case 'approve': {
      const e = d.expenses.find((x) => x.id === id);
      store.change('Expense approved', `${e.vendor} ${money(e.amount)}`, () => e.approvals.push({ userId: store.user.id, date: today() }));
      toast(expenseStatus(e, users()) === 'approved' ? 'Approved' : 'Your approval is recorded; another is still needed');
      break;
    }
    case 'reject': {
      const e = d.expenses.find((x) => x.id === id);
      const why = prompt('Reason for rejecting?');
      if (why === null) return;
      store.change('Expense rejected', `${e.vendor} — ${why}`, () => { e.rejected = { userId: store.user.id, why }; });
      break;
    }
    case 'checkin': {
      const e = d.events.find((x) => x.id === id);
      store.change('Event check-in', e.name, () => { e.checkins += 1; });
      break;
    }
    case 'ws': store.setWorkspace(el.dataset.ws); toast(store.isDemo ? 'Demo data' : 'Live workspace'); break;
    case 'reset-demo': if (confirm('Reset all demo data?')) { store.resetDemo(); toast('Demo data reset'); } break;
    case 'export': download(`safe-passage-${store.meta.workspace}-${today()}.json`, store.exportJSON(), 'application/json'); return;
    case 'report': {
      const g = d.grants.find((x) => x.id === id);
      const rows = [['Date', 'Vendor', 'Category', 'Program', 'Amount', 'Status']].concat(
        d.expenses.filter((e) => e.grantId === id).map((e) => [e.date, e.vendor, e.category, prog(e.programId)?.name, e.amount, expenseStatus(e, users())]));
      download(`${g.name.replace(/\W+/g, '-')}-report-${today()}.csv`, rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv');
      return;
    }
    case 'add-goal': {
      const text = prompt('New goal');
      if (!text) return;
      const p = d.participants.find((x) => x.id === id);
      store.change('Goal added', p.name, () => p.goals.push({ id: store.id('g'), text, done: false }));
      break;
    }
    case 'add-note': {
      const text = prompt('Case note');
      if (!text) return;
      const p = d.participants.find((x) => x.id === id);
      store.change('Case note added', p.name, () => p.notes.unshift({ id: store.id('n'), by: store.user.id, date: today(), text }));
      break;
    }
    case 'add-deadline': {
      const label = prompt('What is due?');
      if (!label) return;
      const date = prompt('Due date (YYYY-MM-DD)', today());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return toast('Use YYYY-MM-DD');
      const g = d.grants.find((x) => x.id === id);
      store.change('Deadline added', `${g.name}: ${label}`, () => g.deadlines.push({ id: store.id('d'), label, date, done: false }));
      break;
    }
    default: return;
  }
  render();
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  const act = el.dataset.act;
  const d = D();
  if (act === 'switch-user') { store.setUser(el.value); toast(`Now using the app as ${store.user.name}`); }
  else if (act === 'task-done') { const t = d.tasks.find((x) => x.id === el.dataset.id); store.change('Task done', t.text, () => { t.done = true; }); }
  else if (act === 'goal') { const p = d.participants.find((x) => x.id === el.dataset.id); const g = p.goals.find((x) => x.id === el.dataset.g); store.change('Goal updated', g.text, () => { g.done = el.checked; }); }
  else if (features.some((f) => f.changes?.[act])) {
    const f = features.find((x) => x.changes?.[act]);
    if (!f.changes[act](el)) return;
  }
  else if (act === 'deadline') { const g = d.grants.find((x) => x.id === el.dataset.id); const dl = g.deadlines.find((x) => x.id === el.dataset.d); store.change('Deadline updated', dl.label, () => { dl.done = el.checked; }); }
  else return;
  render();
});

document.addEventListener('input', (ev) => {
  if (ev.target.dataset.act === 'search-people') {
    views.people.q = ev.target.value;
    const pos = ev.target.selectionStart;
    render();
    const s = $('input[type=search]');
    s.focus(); s.setSelectionRange(pos, pos);
  }
});

// ---------- router ----------
function render() {
  const [, tab = 'today', a, b, c] = (location.hash || '#/today').split('/');
  let html;
  if (tab === 'f') {
    const f = feature(a);
    const allowed = f && (!f.roles || f.roles.includes(store.user.role) || f.openViews?.includes(b)); // openViews: pages any signed-in role may open (e.g. intake kiosk)
    html = allowed ? `<a class="back" href="#/more">‹ More</a>${f.view(b, c)}` : '<p class="empty">This page is not available for your role.</p>';
  } else html = (views[tab] || views.today)(a, b);
  const a11yKeep = (document.activeElement?.closest?.('#main') && document.activeElement.dataset?.act) ? { ...document.activeElement.dataset } : null;
  $('#main').innerHTML = html;
  const navTab = tab === 'f' ? 'more' : tab;
  document.querySelectorAll('.nav a').forEach((n) => {
    const on = n.dataset.tab === navTab;
    n.classList.toggle('on', on);
    if (on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current');
  });
  document.title = `${(tab === 'f' ? feature(a)?.title : { today: 'Today', people: 'People', programs: 'Programs', money: 'Money', more: 'More' }[tab]) || 'Today'} - Safe Passage Ops`;
  // After a re-render keep keyboard focus on the same control (matched by data-act/id) when it still exists.
  if (a11yKeep) {
    const sel = `[data-act="${CSS.escape(a11yKeep.act)}"]` + ['id', 'g', 'd', 't', 'key'].filter((k) => a11yKeep[k]).map((k) => `[data-${k}="${CSS.escape(a11yKeep[k])}"]`).join('');
    $(sel, $('#main'))?.focus({ preventScroll: true });
  }
  $('#demo-banner').hidden = !store.isDemo;
  $('#who').textContent = `${store.user.name} · ${ROLES[store.user.role]}`;
}

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); $('#main').focus({ preventScroll: true }); });
document.addEventListener('click', (e) => { if (e.target.closest?.('[data-skip]')) { e.preventDefault(); $('#main').focus(); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

ui.render = render;
store.load();
render();

if ('serviceWorker' in navigator) {
  // Only offer "new version" when this page was already running an older worker.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    if (!hadController) return;
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          const bar = $('#update');
          bar.hidden = false;
          bar.onclick = () => { nw.postMessage('skipWaiting'); };
        }
      });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
}
