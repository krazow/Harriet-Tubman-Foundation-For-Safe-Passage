import { register } from './registry.js';
import { store } from '../store.js';
import { esc, D, toast, sheet, infoSheet, field, options, today, fmtDate, relDays } from '../ui.js';
import { money } from '../rules.js';
import { DONOR_TYPES, GIFT_TYPES, STAGES, giftYear, cashValue, donorTotals, grandTotal, giftYears, acknowledgment, designationText, dueProspects, pipelineTotals } from '../rules/donors.js';
import { has, tabs, pageHead, para, todayCard, progName } from './p3util.js';

const donors = () => D().donors || [];
const gifts = () => D().gifts || [];
const prospects = () => D().prospects || [];
const edit = () => has('ed', 'treasurer');
const donor = (id) => donors().find((d) => d.id === id);
const typeLabel = (list, k) => list.find(([x]) => x === k)?.[1] || k;
const ui = { year: String(new Date().getFullYear()) };
const LETTERHEAD = 'Harriet Tubman Foundation for Safe Passage · 1107 Tacoma Ave, Tacoma, WA 98402 · EIN 82-4154435';

const designName = (g) => {
  const [kind, id] = String(g.designation || 'general').split(':');
  return kind === 'program' ? progName(id) : kind === 'grant' ? D().grants.find((x) => x.id === id)?.name : '';
};
const giftAmount = (g) => (g.type === 'in-kind' ? `In-kind${g.description ? `: ${esc(g.description)}` : ''}` : money(g.amount));
const signer = () => D().users.find((u) => u.role === 'ed')?.name || 'Executive Director';

function letter(d, list, year) {
  const rows = list.map((g) => `<tr><td>${fmtDate(g.date)}</td><td>${esc(typeLabel(GIFT_TYPES, g.type))}</td><td>${esc(designationText(g, designName(g)))}</td><td>${giftAmount(g)}</td></tr>`).join('');
  const total = list.reduce((n, g) => n + cashValue(g), 0);
  const single = list.length === 1 && !year;
  const inKind = list.some((g) => g.type === 'in-kind');
  return `<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:16px"><b>Harriet Tubman Foundation for Safe Passage</b><br>
    <span class="muted">${esc(LETTERHEAD.split(' · ').slice(1).join(' · '))}</span></div>
    <p>${fmtDate(today())}</p><p>Dear ${esc(d.name)},</p>
    <p>Thank you for your generous ${single ? 'gift' : `support in ${year}`} to the Harriet Tubman Foundation for Safe Passage. Your giving helps neighbors in Tacoma find safe passage to housing, healing, and opportunity.</p>
    <table><tr><th>Date</th><th>Type</th><th>Designation</th><th>Contribution</th></tr>${rows}</table>
    ${list.length > 1 || year ? `<p><b>Total cash contributions${year ? ` in ${esc(year)}` : ''}: ${money(total)}</b></p>` : ''}
    <p>${esc(acknowledgment(single ? list[0] : { type: inKind ? 'in-kind' : 'cash' }))}${inKind && !single ? ' In-kind items are listed without a stated value.' : ''}</p>
    <p>The Harriet Tubman Foundation for Safe Passage is a tax-exempt organization (EIN 82-4154435). Please keep this letter for your tax records.</p>
    <p>With gratitude,<br><br>${esc(signer())}<br>Executive Director</p>
    <p class="muted" style="margin-top:24px">${esc(LETTERHEAD)}</p>`;
}

register({
  id: 'donors', title: 'Donors & prospects', icon: '💝', group: 'Money', roles: ['ed', 'treasurer', 'board'],
  collections: { donors: [], gifts: [], prospects: [] },
  demo: (iso) => ({
    donors: [
      { id: 'dn1', name: 'Priya Raman', type: 'individual', email: 'priya@example.org', phone: '', address: '', notes: 'Monthly giver; likes the garden days.' },
      { id: 'dn2', name: 'Maple Street Church (demo)', type: 'organization', email: 'office@example.org', phone: '', address: '', notes: 'Annual coat drive partner.' },
      { id: 'dn3', name: 'Riverbend Family Foundation (demo)', type: 'foundation', email: '', phone: '', address: '', notes: 'Contact: program officer, fictional.' },
      { id: 'dn4', name: 'Workplace giving via Benevity (demo)', type: 'workplace', email: '', phone: '', address: '', notes: 'Employer match batches arrive monthly.' },
      { id: 'dn5', name: 'Walter Okafor', type: 'individual', email: '', phone: '', address: '', notes: 'Donated folding tables.' },
    ],
    gifts: [
      { id: 'gf1', donorId: 'dn1', date: iso(-45), amount: 50, type: 'online', designation: 'general', description: '', receiptSent: true },
      { id: 'gf2', donorId: 'dn1', date: iso(-15), amount: 50, type: 'online', designation: 'general', description: '', receiptSent: false },
      { id: 'gf3', donorId: 'dn2', date: iso(-30), amount: 1200, type: 'check', designation: 'program:p5', description: '', receiptSent: true },
      { id: 'gf4', donorId: 'dn3', date: iso(-60), amount: 5000, type: 'check', designation: 'grant:gr1', description: '', receiptSent: true },
      { id: 'gf5', donorId: 'dn4', date: iso(-10), amount: 342.5, type: 'online', designation: 'general', description: '', receiptSent: false },
      { id: 'gf6', donorId: 'dn5', date: iso(-20), amount: 0, type: 'in-kind', designation: 'general', description: '4 folding tables', receiptSent: false },
      { id: 'gf7', donorId: 'dn1', date: `${new Date().getFullYear() - 1}-12-10`, amount: 100, type: 'cash', designation: 'general', description: '', receiptSent: true },
    ],
    prospects: [
      { id: 'pr1', funder: 'Puget Sound Giving Circle (demo)', ask: 15000, deadline: iso(6), stage: 'researching', notes: 'Housing support focus; LOI first.' },
      { id: 'pr2', funder: 'Evergreen Community Trust (demo)', ask: 40000, deadline: iso(40), stage: 'researching', notes: '' },
      { id: 'pr3', funder: 'Northwest Women\'s Fund (demo)', ask: 20000, deadline: iso(-10), stage: 'applied', notes: 'Decision expected in spring.' },
      { id: 'pr4', funder: 'Harborview Health Initiative (demo)', ask: 10000, deadline: iso(-50), stage: 'declined', notes: 'Try again next cycle.' },
    ],
  }),

  view(tab, id) {
    const T = tabs('donors', [['donors', 'Donors'], ['gifts', 'Gifts'], ['prospects', 'Prospects'], ['yearend', 'Year-end']], ['gifts', 'prospects', 'yearend'].includes(tab) ? tab : 'donors');
    if (tab === 'donor') {
      const d = donor(id); if (!d) return '<p class="empty">Not found.</p>';
      const list = gifts().filter((g) => g.donorId === d.id).sort((a, b) => b.date.localeCompare(a.date));
      return `<a class="back" href="#/f/donors">‹ Donors</a>${pageHead(d.name, edit() ? `<button class="btn small" data-act="donors-edit" data-id="${d.id}">Edit</button>` : '')}
        <p class="muted">${esc(typeLabel(DONOR_TYPES, d.type))}${d.email ? ` · ${esc(d.email)}` : ''}${d.phone ? ` · ${esc(d.phone)}` : ''}</p><p>${para(d.notes || '')}</p>
        <section class="card"><div class="head"><h3>Gifts</h3>${edit() ? `<button class="btn small primary" data-act="donors-gift" data-donor="${d.id}">+ Gift</button>` : ''}</div>${list.map(giftRow).join('') || '<p class="empty">None yet.</p>'}</section>`;
    }
    if (tab === 'gifts') {
      const list = [...gifts()].sort((a, b) => b.date.localeCompare(a.date));
      return `${pageHead('Donors & gifts', edit() ? '<button class="btn primary" data-act="donors-gift">+ Gift</button>' : '')}${T}
        <section class="card"><h3>Gifts</h3>${list.map((g) => `<div class="muted" style="margin:6px 0 0">${esc(donor(g.donorId)?.name || '')}</div>${giftRow(g)}`).join('') || '<p class="empty">None.</p>'}</section>`;
    }
    if (tab === 'prospects') {
      const pt = pipelineTotals(prospects()), list = [...prospects()].sort((a, b) => (a.deadline || '9').localeCompare(b.deadline || '9'));
      return `${pageHead('Grant prospects', edit() ? '<button class="btn primary" data-act="donors-prospect">+ Prospect</button>' : '')}${T}
        <section class="card"><div class="stats">${STAGES.map(([k, l]) => `<div class="stat"><b>${pt[k].count}</b><span>${l}${pt[k].ask ? ` · ${money(pt[k].ask)}` : ''}</span></div>`).join('')}</div></section>
        ${list.map((p) => `<section class="card"><div class="head"><h3>${esc(p.funder)}</h3><b>${money(p.ask)}</b></div>
          <p class="muted">${p.deadline ? `Deadline ${fmtDate(p.deadline)}` : 'No deadline'}${p.stage === 'researching' && p.deadline ? ` · ${relDays(dayDiff(p.deadline))}` : ''}</p>${p.notes ? `<p>${para(p.notes)}</p>` : ''}
          ${edit() ? `<select data-act="donors-stage" data-id="${p.id}" aria-label="Stage for ${esc(p.funder)}">${options(STAGES, p.stage)}</select> <button class="btn small ghost" data-act="donors-prospect" data-id="${p.id}">Edit</button>` : `<span class="pill">${typeLabel(STAGES, p.stage)}</span>`}</section>`).join('') || '<p class="empty card">None.</p>'}`;
    }
    if (tab === 'yearend') {
      const yrs = giftYears(gifts()), y = yrs.includes(ui.year) ? ui.year : yrs[0] || ui.year, tot = donorTotals(gifts(), y);
      return `${pageHead('Year-end giving')}${T}
        <section class="card">${field('Year', `<select data-act="donors-year">${options(yrs.map((x) => [x, x]), y)}</select>`)}
          <p><b>${money(grandTotal(gifts(), y))}</b> in cash gifts from ${tot.length} donor(s). In-kind gifts are listed without a value.</p>
          ${tot.map((t) => `<div class="row"><span class="grow">${esc(donor(t.donorId)?.name || 'Unknown')}<small>${t.count} gift(s)${t.inKind ? `, ${t.inKind} in-kind` : ''}</small></span><b>${money(t.total)}</b>
            ${edit() ? `<button class="btn small" data-act="donors-yearend" data-id="${t.donorId}" data-y="${y}">Letter</button>` : ''}</div>`).join('') || '<p class="empty">No gifts that year.</p>'}</section>`;
    }
    const tot = donorTotals(gifts(), ui.year);
    return `${pageHead('Donors & gifts', edit() ? '<button class="btn primary" data-act="donors-edit">+ Donor</button>' : '')}${T}
      <section class="card"><div class="stats"><div class="stat"><b>${donors().length}</b><span>Donors</span></div><div class="stat"><b>${money(grandTotal(gifts(), ui.year))}</b><span>Given in ${ui.year}</span></div>
        <div class="stat"><b>${gifts().filter((g) => !g.receiptSent).length}</b><span>Receipts to send</span></div></div></section>
      <section class="card"><h3>Donors</h3>${donors().map((d) => { const t = tot.find((x) => x.donorId === d.id); return `<a class="row" href="#/f/donors/donor/${d.id}"><span class="avatar">${esc(d.name[0])}</span><span class="grow">${esc(d.name)}<small>${esc(typeLabel(DONOR_TYPES, d.type))}</small></span><b>${money(t?.total || 0)}</b></a>`; }).join('') || '<p class="empty">No donors yet.</p>'}</section>`;
  },

  forms: {
    'donors-edit'(el) {
      if (!edit()) return;
      const d = donor(el.dataset.id) || { name: '', type: 'individual', email: '', phone: '', address: '', notes: '' };
      sheet(d.id ? 'Edit donor' : 'New donor', `${field('Name', `<input name="name" required maxlength="80" value="${esc(d.name)}">`)}
        ${field('Type', `<select name="type">${options(DONOR_TYPES, d.type)}</select>`)}${field('Email', `<input name="email" type="email" value="${esc(d.email)}">`)}
        ${field('Phone', `<input name="phone" value="${esc(d.phone)}">`)}${field('Mailing address', `<input name="address" value="${esc(d.address)}">`)}${field('Notes', `<textarea name="notes">${esc(d.notes)}</textarea>`)}`,
      (f) => {
        const v = { name: f.get('name').trim(), type: f.get('type'), email: f.get('email'), phone: f.get('phone'), address: f.get('address'), notes: f.get('notes') };
        if (d.id) store.change('Donor edited', v.name, () => Object.assign(d, v)); else store.change('Donor added', v.name, (x) => x.donors.push({ id: store.id('dn'), ...v }));
      });
    },
    'donors-gift'(el) {
      if (!edit()) return;
      const des = [['general', 'General support'], ...D().programs.map((p) => [`program:${p.id}`, `Program: ${p.name}`]), ...D().grants.map((g) => [`grant:${g.id}`, `Grant: ${g.name}`])];
      sheet('Record a gift', `${field('Donor', `<select name="donorId" required>${options(donors().map((d) => [d.id, d.name]), el.dataset.donor)}</select>`)}
        ${field('Date', `<input name="date" type="date" value="${today()}" required>`)}${field('Amount ($) — leave 0 for in-kind', '<input name="amount" type="number" min="0" step="0.01" value="0" required>')}
        ${field('Type', `<select name="type">${options(GIFT_TYPES)}</select>`)}${field('Designation', `<select name="designation">${options(des)}</select>`)}
        ${field('In-kind description (no value)', '<input name="description" maxlength="120">')}
        <label class="row check"><input type="checkbox" name="receiptSent"><span class="grow">Receipt / thank-you already sent</span></label>`,
      (f) => {
        const type = f.get('type'), amount = Number(f.get('amount')) || 0;
        if (type !== 'in-kind' && amount <= 0) { toast('Enter the gift amount'); return false; }
        store.change('Gift recorded', `${donor(f.get('donorId'))?.name} ${type === 'in-kind' ? '(in-kind)' : money(amount)}`, (d) => d.gifts.push({ id: store.id('gf'), donorId: f.get('donorId'), date: f.get('date'),
          amount: type === 'in-kind' ? 0 : amount, type, designation: f.get('designation'), description: f.get('description').trim(), receiptSent: f.has('receiptSent') }));
      });
    },
    'donors-prospect'(el) {
      if (!edit()) return;
      const p = prospects().find((x) => x.id === el.dataset.id) || { funder: '', ask: '', deadline: '', stage: 'researching', notes: '' };
      sheet(p.id ? 'Edit prospect' : 'New grant prospect', `${field('Funder', `<input name="funder" required maxlength="80" value="${esc(p.funder)}">`)}
        ${field('Ask amount ($)', `<input name="ask" type="number" min="0" step="1" required value="${esc(p.ask)}">`)}${field('Deadline', `<input name="deadline" type="date" value="${esc(p.deadline)}">`)}
        ${field('Stage', `<select name="stage">${options(STAGES, p.stage)}</select>`)}${field('Notes', `<textarea name="notes">${esc(p.notes)}</textarea>`)}`,
      (f) => {
        const v = { funder: f.get('funder').trim(), ask: Number(f.get('ask')), deadline: f.get('deadline'), stage: f.get('stage'), notes: f.get('notes') };
        if (p.id) store.change('Prospect edited', v.funder, () => Object.assign(p, v)); else store.change('Prospect added', v.funder, (d) => d.prospects.push({ id: store.id('pr'), ...v }));
      });
    },
  },

  actions: {
    'donors-letter'(el) {
      const g = gifts().find((x) => x.id === el.dataset.id), d = g && donor(g.donorId); if (!d || !edit()) return false;
      infoSheet('Thank-you / receipt letter', letter(d, [g], ''));
      return false;
    },
    'donors-yearend'(el) {
      const d = donor(el.dataset.id), y = el.dataset.y; if (!d || !edit()) return false;
      infoSheet(`Year-end summary ${y}`, letter(d, gifts().filter((g) => g.donorId === d.id && giftYear(g) === y).sort((a, b) => a.date.localeCompare(b.date)), y));
      return false;
    },
  },

  changes: {
    'donors-receipt'(el) {
      const g = gifts().find((x) => x.id === el.dataset.id); if (!g || !edit()) return false;
      store.change('Receipt flag', `${donor(g.donorId)?.name}: ${el.checked ? 'sent' : 'not sent'}`, () => { g.receiptSent = el.checked; });
      return true;
    },
    'donors-stage'(el) {
      const p = prospects().find((x) => x.id === el.dataset.id); if (!p || !edit()) return false;
      store.change('Prospect stage', `${p.funder}: ${el.value}`, () => { p.stage = el.value; });
      return true;
    },
    'donors-year'(el) { ui.year = el.value; return true; },
  },

  today() {
    if (!has('ed', 'treasurer')) return '';
    const list = dueProspects(prospects());
    if (!list.length) return '';
    return todayCard('Grant prospect deadlines', list.map((p) => `<div class="row"><span class="grow">${esc(p.funder)}<small>${money(p.ask)} · ${fmtDate(p.deadline)}</small></span>
      <span class="pill ${p.days < 0 ? 'rejected' : p.days <= 7 ? 'pending' : ''}">${relDays(p.days)}</span></div>`), '#/f/donors/prospects', 'Open prospects');
  },
});

function dayDiff(d) { return Math.round((new Date(d + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000); }

function giftRow(g) {
  return `<div class="row"><span class="date">${fmtDate(g.date)}</span><span class="grow">${giftAmount(g)}<small>${esc(typeLabel(GIFT_TYPES, g.type))} · ${esc(designationText(g, designName(g)))}</small></span>
    ${edit() ? `<label class="check" style="display:flex;gap:4px;align-items:center;font-size:.75rem"><input type="checkbox" data-act="donors-receipt" data-id="${g.id}" ${g.receiptSent ? 'checked' : ''} aria-label="Receipt sent"> sent</label>
    <button class="btn small" data-act="donors-letter" data-id="${g.id}">Letter</button>` : `<span class="pill ${g.receiptSent ? 'approved' : ''}">${g.receiptSent ? 'Receipt sent' : 'No receipt'}</span>`}</div>`;
}
