import { register } from './registry.js';
import { store } from '../store.js';
import { esc, today, fmtDate, D, users, toast, sheet, field, options, empty } from '../ui.js';
import { money } from '../rules.js';
import { TRAVEL_CLASSES, openSlots, travelStatus, canApproveTravel, needsJustification, validateRequest } from '../rules/travel.js';
import { ROLES } from '../rules.js';
import { todayCard } from './p2util.js';

const req = (id) => D().travelRequests.find((r) => r.id === id);
const role = (id) => users().find((u) => u.id === id)?.role;
const APPROVER = ['ed', 'treasurer', 'board'];
const pillCls = { pending: 'pending', approved: 'approved', rejected: 'rejected' };
const pendingForMe = () => (D().travelRequests || []).filter((r) => canApproveTravel(r, store.user, users()));

function row(r) {
  const s = travelStatus(r, users()), me = store.user;
  const need = s === 'pending' ? ` · needs ${openSlots(r, users()).map((x) => x.map((k) => ROLES[k]).join(' or ')).join(' + ')}` : '';
  return `<div class="row exp"><span class="grow">${esc(store.userName(r.travelerId))} → ${esc(r.destination)} <b>${money(r.cost)}</b>
      <small>${esc(r.purpose)} · ${fmtDate(r.start)}${r.end && r.end !== r.start ? ` – ${fmtDate(r.end)}` : ''} · ${TRAVEL_CLASSES[r.travelClass]}${r.lodging ? ` · ${esc(r.lodging)}` : ''}
      ${r.grantId ? ` · ${esc(D().grants.find((g) => g.id === r.grantId)?.name || '')}` : ''}${need}${r.justification ? `<br>Justification: ${esc(r.justification)}` : ''}${r.rejected ? `<br>Rejected: ${esc(r.rejected.why)}` : ''}</small></span>
    ${canApproveTravel(r, me, users()) ? `<span class="acts"><button class="btn small primary" data-act="travel-approve" data-id="${r.id}">Approve</button><button class="btn small ghost" data-act="travel-reject" data-id="${r.id}">Reject</button></span>`
      : `<span class="pill ${pillCls[s]}">${{ pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }[s]}</span>`}</div>`;
}

function requestForm() {
  const me = store.user;
  sheet('Travel request', `
    ${field('Traveler', `<select name="travelerId" data-travel-traveler>${options(users().map((u) => [u.id, u.name]), me.id)}</select>`)}
    ${field('Purpose', '<input name="purpose" required maxlength="140">')}
    ${field('Destination', '<input name="destination" required maxlength="100">')}
    ${field('Departure', `<input name="start" type="date" required value="${today()}">`)}
    ${field('Return', `<input name="end" type="date" required value="${today()}">`)}
    ${field('Estimated cost ($)', '<input name="cost" type="number" min="0" step="0.01" required inputmode="decimal">')}
    ${field('Class of travel', `<select name="travelClass">${options(Object.entries(TRAVEL_CLASSES))}</select>`)}
    ${field('Lodging', '<input name="lodging" maxlength="100" placeholder="Hotel, nights, or none">')}
    ${field('Grant to charge', `<select name="grantId">${options([['', '— None —'], ...D().grants.map((g) => [g.id, g.name])])}</select>`)}
    ${field('Written justification', '<textarea name="justification" rows="3" maxlength="500" placeholder="Required for first class, charter, and for the ED or board members"></textarea>')}
    <p class="muted">Nobody approves their own travel. Standard trips go to the ED. First class, charter, or travel by the ED or a board member needs a Board member and the Treasurer, plus a written justification.</p>`,
  (f, fm) => {
    if (!fm.reportValidity()) return false;
    const r = { travelerId: f.get('travelerId'), purpose: f.get('purpose').trim(), destination: f.get('destination').trim(), start: f.get('start'), end: f.get('end'),
      cost: Number(f.get('cost')), travelClass: f.get('travelClass'), lodging: f.get('lodging').trim(), grantId: f.get('grantId') || null, justification: f.get('justification').trim() };
    const errs = validateRequest(r, role(r.travelerId));
    if (errs.length) { toast(errs[0]); return false; }
    store.change('Travel request submitted', `${store.userName(r.travelerId)} to ${r.destination} ${money(r.cost)}`, (d) =>
      d.travelRequests.push({ id: store.id('tr'), requestedBy: me.id, approvals: [], created: today(), ...r }));
    toast('Request submitted for approval');
  });
}

register({
  id: 'travel', title: 'Travel requests', icon: '✈️', group: 'Money',
  collections: { travelRequests: [] },
  demo: (iso) => ({ travelRequests: [
    { id: 'tv1', requestedBy: 'u4', travelerId: 'u4', purpose: 'Housing coalition conference', destination: 'Olympia, WA', start: iso(18), end: iso(19), cost: 240, travelClass: 'economy', lodging: '1 night, hotel', grantId: 'gr1', justification: '', approvals: [], created: iso(-2) },
    { id: 'tv2', requestedBy: 'u1', travelerId: 'u1', purpose: 'National funder convening', destination: 'Washington, DC', start: iso(45), end: iso(48), cost: 2650, travelClass: 'premium', lodging: '3 nights, hotel', grantId: 'gr1',
      justification: 'Funder invited the ED to present; premium economy needed for the long flight and a same-day return meeting.', approvals: [{ userId: 'u3', date: iso(-1) }], created: iso(-3) },
    { id: 'tv3', requestedBy: 'u5', travelerId: 'u5', purpose: 'Outreach training', destination: 'Seattle, WA', start: iso(-20), end: iso(-20), cost: 45, travelClass: 'economy', lodging: '', grantId: 'gr2', justification: '', approvals: [{ userId: 'u1', date: iso(-25) }], created: iso(-28) },
    { id: 'tv4', requestedBy: 'u3', travelerId: 'u3', purpose: 'Board retreat', destination: 'Portland, OR', start: iso(60), end: iso(61), cost: 520, travelClass: 'first', lodging: '1 night, hotel', grantId: null, justification: '', approvals: [], rejected: { userId: 'u1', why: 'Please resubmit economy class with justification.' }, created: iso(-6) },
  ] }),
  view() {
    const me = store.user, all = D().travelRequests, approver = APPROVER.includes(me.role);
    const mine = all.filter((r) => r.travelerId === me.id || r.requestedBy === me.id);
    const forMe = all.filter((r) => canApproveTravel(r, me, users()));
    const others = all.filter((r) => travelStatus(r, users()) === 'pending' && !forMe.includes(r) && !mine.includes(r));
    return `<div class="head"><h1>Travel requests</h1><button class="btn primary" data-act="travel-add">+ Request</button></div>
      ${approver ? `<section class="card"><h3>For your approval</h3>${forMe.map(row).join('') || empty('Nothing waiting for you.')}</section>
        ${others.length ? `<section class="card"><h3>Waiting on others</h3>${others.map(row).join('')}</section>` : ''}` : ''}
      <section class="card"><h3>My requests</h3>${mine.sort((a, b) => b.created.localeCompare(a.created)).map(row).join('') || empty('No requests yet.')}</section>
      ${approver ? `<section class="card"><h3>All decided</h3>${all.filter((r) => travelStatus(r, users()) !== 'pending' && !mine.includes(r)).map(row).join('') || empty('None.')}</section>` : ''}`;
  },
  forms: { 'travel-add': requestForm },
  actions: {
    'travel-approve': (el) => { const r = req(el.dataset.id);
      store.change('Travel request approved', `${store.userName(r.travelerId)} to ${r.destination}`, () => r.approvals.push({ userId: store.user.id, date: today() }));
      toast(travelStatus(r, users()) === 'approved' ? 'Approved' : 'Your approval is recorded; another is still needed'); return true; },
    'travel-reject': (el) => { const r = req(el.dataset.id), why = prompt('Reason for rejecting?');
      if (why === null) return false;
      store.change('Travel request rejected', `${store.userName(r.travelerId)} to ${r.destination} — ${why}`, () => { r.rejected = { userId: store.user.id, why }; }); return true; },
  },
  today() {
    const p = pendingForMe();
    return todayCard('Travel requests to review', p.map((r) => ({ t: `${store.userName(r.travelerId)} → ${r.destination}`, sub: `${money(r.cost)} · ${TRAVEL_CLASSES[r.travelClass]}`, pill: 'Review', cls: 'pending' })), '#/f/travel');
  },
});
