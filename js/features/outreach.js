import { register } from './registry.js';
import { store } from '../store.js';
import { esc, D, sheet, field, today, fmtDate, download, toCSV } from '../ui.js';
import { ITEMS, itemLabel, totalItems, monthlyTotals, csvRows } from '../rules/outreach.js';
import { monthLabel, pageHead, para } from './p3util.js';

const logs = () => D().outreachLogs || [];

register({
  id: 'outreach', title: 'Outreach log', icon: '🤝', group: 'Field', roles: ['ed', 'outreach', 'lead', 'volunteer'],
  collections: { outreachLogs: [] },
  demo: (iso) => ({ outreachLogs: [
    { id: 'ol1', date: iso(-12), place: 'Hilltop corridor', people: 14, items: { hygiene: 10, water: 20, cards: 14 }, referrals: 3, notes: 'Several asked about winter shelter.', by: 'u5' },
    { id: 'ol2', date: iso(-7), place: 'Downtown Tacoma transit center', people: 9, items: { food: 12, clothing: 6, harm: 9 }, referrals: 2, notes: '', by: 'u5' },
    { id: 'ol3', date: iso(-3), place: 'Lincoln District', people: 11, items: { hygiene: 8, water: 11, cards: 11, other: 4 }, referrals: 4, notes: 'Other = socks.', by: 'u6' },
    { id: 'ol4', date: iso(-40), place: 'Hilltop corridor', people: 17, items: { food: 15, hygiene: 12 }, referrals: 5, notes: '', by: 'u5' },
  ] }),

  view() {
    const list = [...logs()].sort((a, b) => b.date.localeCompare(a.date));
    const tot = monthlyTotals(list), cur = tot.find((t) => t.month === today().slice(0, 7)) || { contacts: 0, people: 0, items: 0, referrals: 0 };
    return `${pageHead('Outreach log', '<button class="btn primary" data-act="outreach-add">+ Log contact</button>')}
      <section class="card"><h3>This month</h3><div class="stats">
        <div class="stat"><b>${cur.people}</b><span>People reached</span></div><div class="stat"><b>${cur.items}</b><span>Items given</span></div><div class="stat"><b>${cur.referrals}</b><span>Referrals</span></div></div></section>
      <section class="card"><h3>Monthly totals</h3>${tot.map((t) => `<div class="row"><span class="grow">${monthLabel(t.month)}
        <small>${t.contacts} outings · ${Object.entries(t.byItem).map(([k, n]) => `${esc(itemLabel(k))} ${n}`).join(', ') || 'no items'}</small></span>
        <span><b>${t.people}</b> people<br><small>${t.referrals} referrals</small></span></div>`).join('') || '<p class="empty">Nothing logged yet.</p>'}
        <button class="btn" data-act="outreach-csv">Export CSV</button></section>
      <section class="card"><h3>Recent contacts</h3>${list.slice(0, 15).map((c) => `<div class="row"><span class="date">${fmtDate(c.date)}</span>
        <span class="grow">${esc(c.place)}<small>${c.people} people · ${totalItems(c)} items · ${c.referrals || 0} referrals · ${esc(store.userName(c.by))}${c.notes ? `<br>${para(c.notes)}` : ''}</small></span></div>`).join('') || '<p class="empty">None.</p>'}</section>`;
  },

  forms: {
    'outreach-add'() {
      sheet('Log outreach contact', `${field('Date', `<input name="date" type="date" value="${today()}" required>`)}
        ${field('Place / area', '<input name="place" required maxlength="80">')}
        ${field('People reached', '<input name="people" type="number" min="0" step="1" required value="0">')}
        <fieldset><legend>Items given</legend>${ITEMS.map(([k, l]) => `<div class="row check"><label class="grow" style="display:flex;gap:10px;align-items:center">
          <input type="checkbox" name="item" value="${k}" style="width:22px;height:22px"> ${esc(l)}</label>
          <input type="number" name="qty_${k}" min="1" step="1" value="1" aria-label="${esc(l)} count" style="width:72px;padding:8px;border-radius:8px;border:1px solid var(--line)"></div>`).join('')}</fieldset>
        ${field('Referrals made', '<input name="referrals" type="number" min="0" step="1" value="0">')}
        ${field('Notes (no names please)', '<textarea name="notes" maxlength="500"></textarea>')}`,
      (f) => {
        const items = {};
        for (const k of f.getAll('item')) items[k] = Math.max(1, Math.floor(Number(f.get(`qty_${k}`)) || 1));
        store.change('Outreach contact logged', f.get('place'), (d) => d.outreachLogs.push({ id: store.id('ol'), date: f.get('date'), place: f.get('place').trim(),
          people: Math.floor(Number(f.get('people')) || 0), items, referrals: Math.floor(Number(f.get('referrals')) || 0), notes: f.get('notes').trim(), by: store.user.id }));
      });
    },
  },
  actions: { 'outreach-csv'() { download(`outreach-${today()}.csv`, toCSV(csvRows(logs())), 'text/csv'); return false; } },
});
