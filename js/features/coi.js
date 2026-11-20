import { register } from './registry.js';
import { store } from '../store.js';
import { esc, today, fmtDate, D, users, toast, sheet, field, options, empty } from '../ui.js';
import { COI_ROLES, coiStatus, coiMissingFor } from '../rules/coi.js';
import { todayCard } from './p2util.js';

const year = () => new Date().getFullYear();
const isAll = () => ['ed', 'board'].includes(store.user.role);

function fileForm(uid, y) {
  const prev = D().coiDisclosures.find((d) => d.userId === uid && d.year === y);
  const rows = [0, 1, 2].map((i) => { const it = prev?.interests?.[i] || {};
    return `<fieldset><legend>Interest ${i + 1}</legend>${field('Organization', `<input name="org${i}" maxlength="80" value="${esc(it.org || '')}">`)}
      ${field('Relationship', `<input name="rel${i}" maxlength="80" placeholder="e.g. spouse is an owner" value="${esc(it.relationship || '')}">`)}
      ${field('Nature of interest', `<input name="nat${i}" maxlength="120" value="${esc(it.nature || '')}">`)}</fieldset>`; }).join('');
  sheet(`${y} conflict-of-interest disclosure`, `
    <p class="muted">${esc(store.userName(uid))}. Either confirm you have no conflicts, or list each interest. Related-party expenses are flagged in Money.</p>
    <label class="row check"><input type="checkbox" name="none" ${!prev || prev.noConflicts ? 'checked' : ''}><span class="grow">I have no conflicts of interest to disclose</span></label>
    ${rows}
    ${field('Signature (type your full name)', `<input name="sig" required maxlength="80" value="${esc(prev?.signature || '')}">`)}
    ${field('Date signed', `<input name="date" type="date" required value="${prev?.date || today()}">`)}`,
  (f, fm) => {
    if (!fm.reportValidity()) return false;
    const none = f.get('none') === 'on';
    const interests = [0, 1, 2].map((i) => ({ org: f.get('org' + i).trim(), relationship: f.get('rel' + i).trim(), nature: f.get('nat' + i).trim() })).filter((x) => x.org);
    if (!none && !interests.length) { toast('List at least one interest, or tick "no conflicts"'); return false; }
    const rec = { userId: uid, year: y, noConflicts: none, interests: none ? [] : interests, signature: f.get('sig').trim(), date: f.get('date') };
    store.change('COI disclosure filed', `${store.userName(uid)} ${y}`, (d) => {
      if (prev) Object.assign(prev, rec); else d.coiDisclosures.push({ id: store.id('coi'), ...rec });
    });
    toast('Disclosure filed');
  });
}

register({
  id: 'coi', title: 'Conflict of interest', icon: '⚖️', group: 'Governance', roles: COI_ROLES,
  collections: { coiDisclosures: [] },
  demo: (iso) => { const y = Number(iso(0).slice(0, 4));
    return { coiDisclosures: [
      { id: 'coi1', userId: 'u1', year: y, noConflicts: true, interests: [], signature: 'Avery Johnson', date: `${y}-01-12` },
      { id: 'coi2', userId: 'u3', year: y, noConflicts: false, interests: [{ org: 'Price Catering LLC (demo)', relationship: 'Owned by a family member', nature: 'Sometimes bids on event catering' }], signature: 'Jordan Price', date: `${y}-01-20` },
      { id: 'coi3', userId: 'u1', year: y - 1, noConflicts: true, interests: [], signature: 'Avery Johnson', date: `${y - 1}-01-10` },
      { id: 'coi4', userId: 'u2', year: y - 1, noConflicts: true, interests: [], signature: 'Morgan Lee', date: `${y - 1}-01-14` },
    ] }; },
  view(a) {
    const y = year(), me = store.user;
    const all = coiStatus(users(), D().coiDisclosures, y);
    const rows = isAll() ? all : all.filter((s) => s.user.id === me.id);
    const mine = all.find((s) => s.user.id === me.id);
    return `<h1>Conflict of interest ${y}</h1>
      <p class="muted">Every officer and board member files a disclosure each year. Related-party expenses are flagged in Money for Board + Treasurer approval.</p>
      ${isAll() ? `<div class="stats"><div class="stat"><b>${all.filter((s) => s.status === 'filed').length}</b><span>Filed</span></div><div class="stat"><b>${all.filter((s) => s.status === 'missing').length}</b><span>Missing</span></div></div>` : ''}
      <section class="card"><h3>Status</h3>${rows.map((s) => `<div class="row"><span class="grow">${esc(s.user.name)}
        <small>${s.disclosure ? (s.disclosure.noConflicts ? 'No conflicts' : `${s.disclosure.interests.length} interest(s) listed`) + ` · signed ${fmtDate(s.disclosure.date)}` : 'Not filed yet'}</small></span>
        <span class="pill ${s.status === 'filed' ? 'approved' : 'pending'}">${s.status === 'filed' ? 'Filed' : 'Missing'}</span></div>`).join('')}</section>
      ${mine ? `<button class="btn primary" data-act="coi-file" data-u="${me.id}" data-y="${y}">${mine.status === 'filed' ? 'Update my disclosure' : 'File my disclosure'}</button>` : ''}
      ${isAll() ? `<section class="card"><h3>Disclosed interests ${y}</h3>${D().coiDisclosures.filter((d) => d.year === y && d.interests?.length)
        .map((d) => d.interests.map((i) => `<div class="row"><span class="grow">${esc(i.org)}<small>${esc(store.userName(d.userId))} · ${esc(i.relationship)} · ${esc(i.nature)}</small></span></div>`).join('')).join('') || empty('None disclosed.')}</section>
        <section class="card"><h3>Earlier years</h3>${[...new Set(D().coiDisclosures.map((d) => d.year))].filter((x) => x < y).sort().reverse().map((x) => `<div class="row"><span class="grow">${x}</span>
          <span class="muted">${coiStatus(users(), D().coiDisclosures, x).filter((s) => s.status === 'filed').length} of ${all.length} filed</span></div>`).join('') || empty('No earlier records.')}</section>` : ''}`;
  },
  forms: { 'coi-file': (el) => fileForm(el.dataset.u, Number(el.dataset.y)) },
  today() {
    const u = store.user, y = year();
    return coiMissingFor(u, D().coiDisclosures || [], y)
      ? todayCard('Conflict-of-interest form', [{ t: `Your ${y} disclosure is not filed`, sub: 'Takes about two minutes', pill: 'Missing', cls: 'pending' }], '#/f/coi', 'File it') : '';
  },
});
