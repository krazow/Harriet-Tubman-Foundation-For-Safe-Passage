import { register } from './registry.js';
import { store } from '../store.js';
import { $, esc, today, fmtDate, D, toast, sheet, field, options, empty } from '../ui.js';
import { daysUntil } from '../rules.js';
import { REFERRAL_STATUS, SERVICE_TYPES, followUpsDue, filterReferrals } from '../rules/referrals.js';
import { todayCard, duePill, dueClass } from './p2util.js';

const filt = { status: '', service: '', q: '' };
const nm = (id) => D().participants.find((p) => p.id === id)?.name || 'Unknown';
const cls = { sent: 'pending', connected: 'approved', noresponse: 'rejected', declined: 'rejected' };

function form(r = {}) {
  const parts = D().participants;
  sheet(r.id ? 'Edit referral' : 'New referral', `
    ${field('Participant', `<select name="participantId" required>${options(parts.map((p) => [p.id, p.name]), r.participantId)}</select>`)}
    ${field('Partner organization', `<input name="partner" required maxlength="80" value="${esc(r.partner || '')}">`)}
    ${field('Service type', `<select name="service">${options(SERVICE_TYPES.map((s) => [s, s]), r.service)}</select>`)}
    ${field('Date sent', `<input name="sent" type="date" required value="${r.sent || today()}">`)}
    ${field('Follow up by', `<input name="followUp" type="date" value="${r.followUp || ''}">`)}
    ${field('Status', `<select name="status">${options(Object.entries(REFERRAL_STATUS), r.status || 'sent')}</select>`)}
    ${field('Notes (no sensitive details)', `<textarea name="notes" maxlength="400" rows="3">${esc(r.notes || '')}</textarea>`)}`,
  (f, fm) => {
    if (!fm.reportValidity()) return false;
    const v = { participantId: f.get('participantId'), partner: f.get('partner').trim(), service: f.get('service'), sent: f.get('sent'),
      followUp: f.get('followUp') || '', status: f.get('status'), notes: f.get('notes').trim() };
    store.change(r.id ? 'Referral updated' : 'Referral created', `${nm(v.participantId)} → ${v.partner}`, (d) => {
      if (r.id) Object.assign(d.referrals.find((x) => x.id === r.id), v);
      else d.referrals.push({ id: store.id('rf'), createdBy: store.user.id, ...v });
    });
    toast('Referral saved');
  });
}

register({
  id: 'referrals', title: 'Referrals', icon: '🤝', group: 'People', roles: ['ed', 'lead', 'outreach'],
  collections: { referrals: [] },
  demo: (iso) => ({ referrals: [
    { id: 'rf1', participantId: 'c1', partner: 'Tacoma Housing Alliance (demo)', service: 'Housing', sent: iso(-9), followUp: iso(-1), status: 'sent', notes: 'Sent rental application packet.', createdBy: 'u4' },
    { id: 'rf2', participantId: 'c2', partner: 'Pierce Community Credit Union (demo)', service: 'Financial', sent: iso(-14), followUp: iso(-7), status: 'connected', notes: 'Appointment held; account opened.', createdBy: 'u4' },
    { id: 'rf3', participantId: 'c3', partner: 'Puget Sound Legal Clinic (demo)', service: 'Legal', sent: iso(-4), followUp: iso(2), status: 'sent', notes: '', createdBy: 'u1' },
    { id: 'rf4', participantId: 'c4', partner: 'Workforce Pathways (demo)', service: 'Employment', sent: iso(-20), followUp: iso(-10), status: 'noresponse', notes: 'Left two messages.', createdBy: 'u5' },
    { id: 'rf5', participantId: 'c1', partner: 'Hilltop Clinic (demo)', service: 'Health / behavioral health', sent: iso(-2), followUp: iso(12), status: 'sent', notes: '', createdBy: 'u5' },
  ] }),
  view() {
    const list = filterReferrals(D().referrals, filt).sort((a, b) => b.sent.localeCompare(a.sent));
    const due = followUpsDue(D().referrals, today());
    return `<div class="head"><h1>Referrals</h1><button class="btn primary" data-act="referrals-add">+ Referral</button></div>
      <div class="stats"><div class="stat"><b>${D().referrals.filter((r) => r.status === 'sent').length}</b><span>Awaiting</span></div>
        <div class="stat"><b>${due.length}</b><span>Follow-ups due</span></div>
        <div class="stat"><b>${D().referrals.filter((r) => r.status === 'connected').length}</b><span>Connected</span></div></div>
      <section class="card">
        ${field('Status', `<select data-act="referrals-filter" data-k="status">${options([['', 'All statuses'], ...Object.entries(REFERRAL_STATUS)], filt.status)}</select>`)}
        ${field('Service', `<select data-act="referrals-filter" data-k="service">${options([['', 'All services'], ...SERVICE_TYPES.map((s) => [s, s])], filt.service)}</select>`)}
      </section>
      <section class="card">${list.map((r) => { const n = daysUntil(r.followUp || r.sent);
        return `<div class="row"><span class="grow">${esc(nm(r.participantId))} → ${esc(r.partner)}
          <small>${esc(r.service)} · sent ${fmtDate(r.sent)}${r.followUp ? ` · follow up ${fmtDate(r.followUp)}${r.status === 'sent' ? ` (${duePill(n)})` : ''}` : ''}${r.notes ? ` · ${esc(r.notes)}` : ''}</small></span>
          <span class="acts"><span class="pill ${cls[r.status]}">${REFERRAL_STATUS[r.status]}</span>
          <button class="btn small ghost" data-act="referrals-edit" data-id="${r.id}">Edit</button></span></div>`; }).join('') || empty('No referrals match.')}</section>`;
  },
  forms: {
    'referrals-add': () => form(),
    'referrals-edit': (el) => form(D().referrals.find((r) => r.id === el.dataset.id)),
  },
  changes: {
    'referrals-filter': (el) => { filt[el.dataset.k] = el.value; return true; },
  },
  today() {
    const due = followUpsDue(D().referrals || [], today());
    return todayCard('Referral follow-ups', due.map((x) => ({ t: `${nm(x.ref.participantId)} → ${x.ref.partner}`, sub: x.ref.service, pill: duePill(x.days), cls: dueClass(x.days) })), '#/f/referrals');
  },
});
