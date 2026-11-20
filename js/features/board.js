import { register } from './registry.js';
import { store } from '../store.js';
import { esc, today, fmtDate, relDays, D, users, toast, sheet, field, options, empty, printHtml } from '../ui.js';
import { daysUntil } from '../rules.js';
import { defaultVoting, quorumStatus, motionResult } from '../rules/board.js';

const canEdit = () => ['ed', 'board'].includes(store.user.role);
const frac = () => Number(D().settings.quorumFraction ?? 0.5);
const meeting = (id) => D().meetings.find((m) => m.id === id);
const nm = (id) => store.userName(id);
const nl = (s) => esc(s).replace(/\n/g, '<br>');
const VOTES = [['', '—'], ['yes', 'Yes'], ['no', 'No'], ['abstain', 'Abstain']];
const RES = { passed: ['approved', 'Passed'], failed: ['rejected', 'Failed'], 'no quorum': ['rejected', 'No quorum'], open: ['pending', 'Open'] };
const when = (m) => `${fmtDate(m.date)}${m.time ? ` · ${esc(m.time)}` : ''}`;

function meetingForm(m = {}) {
  sheet(m.id ? 'Edit meeting' : 'New board meeting', `
    ${field('Date', `<input name="date" type="date" required value="${m.date || today()}">`)}
    ${field('Time', `<input name="time" type="time" value="${m.time || '18:00'}">`)}
    ${field('Place or video link', `<input name="place" maxlength="160" value="${esc(m.place || '')}">`)}`,
  (f, fm) => {
    if (!fm.reportValidity()) return false;
    const v = { date: f.get('date'), time: f.get('time'), place: f.get('place').trim() };
    store.change(m.id ? 'Board meeting updated' : 'Board meeting scheduled', fmtDate(v.date), (d) => {
      if (m.id) Object.assign(d.meetings.find((x) => x.id === m.id), v);
      else d.meetings.push({ id: store.id('bm'), ...v, voting: defaultVoting(d.users), attendance: [], agenda: [], minutes: '', motions: [] });
    });
  });
}

function minutesHtml(m) {
  const q = quorumStatus(m, frac());
  const present = (m.attendance || []).map(nm), absent = (m.voting || []).filter((id) => !(m.attendance || []).includes(id)).map(nm);
  return `<h1>Harriet Tubman Foundation for Safe Passage</h1><h2>Board meeting minutes</h2>
    <p>${when(m)}${m.place ? ` · ${esc(m.place)}` : ''}</p>
    <p><b>Present:</b> ${esc(present.join(', ') || 'none recorded')}<br><b>Absent:</b> ${esc(absent.join(', ') || 'none')}<br>
    <b>Quorum:</b> ${q.met ? 'Yes' : 'No'} (${q.present} of ${q.voting} voting members; ${q.needed} needed)</p>
    <h2>Agenda</h2><ol>${(m.agenda || []).map((a) => `<li>${esc(a.text)}</li>`).join('') || '<li>—</li>'}</ol>
    <h2>Minutes</h2><p>${nl(m.minutes || 'No minutes recorded.')}</p>
    <h2>Motions</h2>${(m.motions || []).map((mo, i) => { const r = motionResult(m, mo, frac());
      return `<p><b>Motion ${i + 1}:</b> ${esc(mo.text)}<br>Moved by ${esc(nm(mo.mover))}${mo.seconder ? `, seconded by ${esc(nm(mo.seconder))}` : ''}.<br>
      Yes ${r.yes} · No ${r.no} · Abstain ${r.abstain} — <b>${RES[r.result][1]}</b></p>`; }).join('') || '<p>None.</p>'}
    <p class="muted">Recorded by ${esc(store.user.name)} on ${fmtDate(today())}. Draft until approved at the next meeting.</p>`;
}

function detail(id) {
  const m = meeting(id);
  if (!m) return empty('Meeting not found.');
  const ed = canEdit(), q = quorumStatus(m, frac()), dis = ed ? '' : 'disabled';
  const everyone = users().filter((u) => ['board', 'ed', 'treasurer'].includes(u.role) || m.voting.includes(u.id) || m.attendance.includes(u.id));
  const presentVoters = m.voting.filter((u) => m.attendance.includes(u));
  return `<a class="back" href="#/f/board">‹ Meetings</a><div class="head"><h1>${when(m)}</h1>
      <button class="btn small" data-act="board-print" data-id="${m.id}">Print minutes</button></div>
    <p class="muted">${esc(m.place || 'Place not set')} ${ed ? `<button class="btn small ghost" data-act="board-edit" data-id="${m.id}">Edit</button>` : ''}</p>
    <section class="card"><div class="head"><h3>Attendance</h3><span class="pill ${q.met ? 'approved' : 'rejected'}">${q.met ? 'Quorum met' : 'No quorum'}</span></div>
      <p class="muted">${q.present} of ${q.voting} voting members present · ${q.needed} needed (more than ${Math.round(frac() * 100)}%)</p>
      ${everyone.map((u) => `<div class="row"><span class="grow">${esc(u.name)}<small>${m.voting.includes(u.id) ? 'Voting member' : 'Non-voting'}</small></span>
        <label><input type="checkbox" data-act="board-attend" data-id="${m.id}" data-u="${u.id}" ${m.attendance.includes(u.id) ? 'checked' : ''} ${dis}> Present</label>
        <label><input type="checkbox" data-act="board-voter" data-id="${m.id}" data-u="${u.id}" ${m.voting.includes(u.id) ? 'checked' : ''} ${dis}> Votes</label></div>`).join('')}
    </section>
    <section class="card"><div class="head"><h3>Agenda</h3>${ed ? `<button class="btn small" data-act="board-add-agenda" data-id="${m.id}">+ Item</button>` : ''}</div>
      ${m.agenda.map((a, i) => `<div class="row"><span class="grow">${i + 1}. ${esc(a.text)}</span>${ed ? `<button class="btn small ghost" data-act="board-del-agenda" data-id="${m.id}" data-a="${a.id}" aria-label="Remove">✕</button>` : ''}</div>`).join('') || empty('No agenda items.')}
    </section>
    <section class="card"><div class="head"><h3>Minutes</h3>${ed ? `<button class="btn small" data-act="board-minutes" data-id="${m.id}">Edit</button>` : ''}</div>
      <p>${m.minutes ? nl(m.minutes) : '<span class="muted">No minutes yet.</span>'}</p></section>
    <div class="head"><h2>Motions</h2>${ed ? `<button class="btn small" data-act="board-add-motion" data-id="${m.id}">+ Motion</button>` : ''}</div>
    ${m.motions.map((mo, i) => { const r = motionResult(m, mo, frac()); const [c, l] = RES[r.result];
      return `<section class="card"><div class="head"><h3>${i + 1}. ${esc(mo.text)}</h3><span class="pill ${c}">${l}</span></div>
        <p class="muted">Moved by ${esc(nm(mo.mover))}${mo.seconder ? ` · seconded by ${esc(nm(mo.seconder))}` : ''} · Yes ${r.yes} · No ${r.no} · Abstain ${r.abstain}</p>
        ${presentVoters.map((u) => `<div class="row"><span class="grow">${esc(nm(u))}</span>
          <select data-act="board-vote" data-id="${m.id}" data-m="${mo.id}" data-u="${u}" aria-label="Vote of ${esc(nm(u))}" ${dis}>${options(VOTES, mo.votes[u] || '')}</select></div>`).join('') || '<p class="empty">Mark voting members present to record votes.</p>'}
        </section>`; }).join('') || empty('No motions yet.')}`;
}

register({
  id: 'board', title: 'Board meetings', icon: '🏛️', group: 'Governance', roles: ['ed', 'treasurer', 'board'],
  collections: { meetings: [] },
  settings: { quorumFraction: 0.5 },
  demo: (iso) => ({ meetings: [
    { id: 'bm1', date: iso(-35), time: '18:00', place: 'Hilltop Community Center', voting: ['u1', 'u2', 'u3'], attendance: ['u1', 'u2', 'u3'],
      agenda: [{ id: 'ba1', text: 'Approve prior minutes' }, { id: 'ba2', text: 'Treasurer report' }, { id: 'ba3', text: 'Listening session plan' }],
      minutes: 'Meeting called to order at 6:05 pm. Treasurer reported the operating grant is on track. Board discussed outreach plans for the fall listening session.',
      motions: [{ id: 'bmo1', text: 'Approve the 2027 budget draft for review', mover: 'u3', seconder: 'u2', votes: { u1: 'yes', u2: 'yes', u3: 'yes' } },
        { id: 'bmo2', text: 'Adopt the updated expense approval policy', mover: 'u2', seconder: 'u3', votes: { u1: 'yes', u2: 'yes', u3: 'abstain' } }] },
    { id: 'bm2', date: iso(12), time: '18:00', place: 'https://meet.example.org/safe-passage-demo', voting: ['u1', 'u2', 'u3'], attendance: [],
      agenda: [{ id: 'ba4', text: 'Annual conflict-of-interest disclosures' }, { id: 'ba5', text: 'Insurance renewal' }, { id: 'ba6', text: 'Travel policy review' }],
      minutes: '', motions: [] },
  ] }),
  view(a) {
    if (a) return detail(a);
    const list = [...D().meetings].sort((x, y) => y.date.localeCompare(x.date));
    return `<div class="head"><h1>Board meetings</h1>${canEdit() ? '<button class="btn primary" data-act="board-add-meeting">+ Meeting</button>' : ''}</div>
      <p class="muted rules">Quorum: more than ${Math.round(frac() * 100)}% of voting members. A motion passes with quorum and more yes than no votes.</p>
      <section class="card">${list.map((m) => { const q = quorumStatus(m, frac()); const n = daysUntil(m.date);
        return `<a class="row" href="#/f/board/${m.id}"><span class="grow">${when(m)}<small>${esc(m.place || '')} · ${m.motions.length} motions${n >= 0 ? ` · ${relDays(n)}` : ''}</small></span>
          ${n < 0 || m.attendance.length ? `<span class="pill ${q.met ? 'approved' : 'rejected'}">${q.met ? 'Quorum' : 'No quorum'}</span>` : '<span class="pill">Upcoming</span>'}</a>`; }).join('') || empty('No meetings yet.')}</section>`;
  },
  forms: {
    'board-add-meeting': () => meetingForm(),
    'board-edit': (el) => meetingForm(meeting(el.dataset.id)),
    'board-add-agenda': (el) => sheet('Agenda item', field('Item', '<input name="text" required maxlength="160">'), (f, fm) => {
      if (!fm.reportValidity()) return false;
      store.change('Agenda item added', f.get('text'), () => meeting(el.dataset.id).agenda.push({ id: store.id('ba'), text: f.get('text').trim() }));
    }),
    'board-minutes': (el) => { const m = meeting(el.dataset.id);
      sheet('Minutes', field('Minutes', `<textarea name="minutes" rows="12" maxlength="8000">${esc(m.minutes)}</textarea>`), (f) => {
        store.change('Board minutes edited', fmtDate(m.date), () => { m.minutes = f.get('minutes'); });
      }); },
    'board-add-motion': (el) => { const m = meeting(el.dataset.id); const opts = options(m.voting.map((u) => [u, nm(u)]));
      sheet('New motion', `${field('Motion', '<textarea name="text" required rows="3" maxlength="400"></textarea>')}
        ${field('Moved by', `<select name="mover">${opts}</select>`)}${field('Seconded by', `<select name="seconder"><option value="">—</option>${opts}</select>`)}`, (f, fm) => {
        if (!fm.reportValidity()) return false;
        if (f.get('seconder') && f.get('seconder') === f.get('mover')) { toast('Mover and seconder must be different people'); return false; }
        store.change('Board motion added', f.get('text').slice(0, 80), () => m.motions.push({ id: store.id('bmo'), text: f.get('text').trim(), mover: f.get('mover'), seconder: f.get('seconder'), votes: {} }));
      }); },
  },
  actions: {
    'board-del-agenda': (el) => { const m = meeting(el.dataset.id);
      store.change('Agenda item removed', fmtDate(m.date), () => { m.agenda = m.agenda.filter((a) => a.id !== el.dataset.a); }); return true; },
    'board-print': (el) => { const m = meeting(el.dataset.id); printHtml(`Minutes ${m.date}`, minutesHtml(m)); },
  },
  changes: {
    'board-attend': (el) => { const m = meeting(el.dataset.id), u = el.dataset.u;
      store.change('Board attendance', `${nm(u)} ${el.checked ? 'present' : 'absent'}`, () => { m.attendance = el.checked ? [...new Set([...m.attendance, u])] : m.attendance.filter((x) => x !== u); }); return true; },
    'board-voter': (el) => { const m = meeting(el.dataset.id), u = el.dataset.u;
      store.change('Voting members changed', `${nm(u)} ${el.checked ? 'added' : 'removed'}`, () => { m.voting = el.checked ? [...new Set([...m.voting, u])] : m.voting.filter((x) => x !== u); }); return true; },
    'board-vote': (el) => { const m = meeting(el.dataset.id), mo = m.motions.find((x) => x.id === el.dataset.m);
      store.change('Board vote recorded', `${nm(el.dataset.u)}: ${el.value || 'cleared'}`, () => { if (el.value) mo.votes[el.dataset.u] = el.value; else delete mo.votes[el.dataset.u]; }); return true; },
  },
});
