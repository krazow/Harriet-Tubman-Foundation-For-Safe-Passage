import { register } from './registry.js';
import { store } from '../store.js';
import { esc, today, fmtDate, D, toast, sheet, field, options, empty } from '../ui.js';
import { daysUntil } from '../rules.js';
import { form990Due, nextOccurrence, completeItem, dueSoon } from '../rules/compliance.js';
import { todayCard, duePill, dueClass } from './p2util.js';

const canEdit = () => ['ed', 'treasurer'].includes(store.user.role);

register({
  id: 'compliance', title: 'Compliance calendar', icon: '📆', group: 'Admin', roles: ['ed', 'treasurer', 'board'],
  collections: { complianceItems: [] },
  settings: { fiscalYearEndMonth: 12 },
  demo: (iso) => { const t = iso(0), y = Number(t.slice(0, 4));
    const may = nextOccurrence(5, 15, t);
    return { complianceItems: [
      { id: 'ci1', title: 'IRS Form 990', due: may, recurring: 'yearly', done: false, note: 'Due the 15th day of the 5th month after fiscal year end (calendar year: May 15).' },
      { id: 'ci2', title: 'WA Secretary of State annual report', due: iso(26), recurring: 'yearly', done: false, note: 'Filed online with the Corporations & Charities Filing System.' },
      { id: 'ci3', title: 'WA charitable organization registration renewal', due: iso(75), recurring: 'yearly', done: false, note: '' },
      { id: 'ci4', title: 'Insurance renewal (general liability)', due: iso(21), recurring: 'yearly', done: false, note: 'Broker: Harbor Insurance (demo).' },
      { id: 'ci5', title: 'Board conflict-of-interest forms', due: `${y}-12-31`, recurring: 'yearly', done: false, note: 'All officers and board members.' },
      { id: 'ci6', title: 'IRS Form 990 (prior year)', due: `${y}-05-15`, recurring: 'yearly', done: true, doneDate: `${y}-05-02`, note: '' },
    ] }; },
  view() {
    const items = D().complianceItems;
    const open = items.filter((i) => !i.done).sort((a, b) => a.due.localeCompare(b.due));
    const done = items.filter((i) => i.done).sort((a, b) => b.due.localeCompare(a.due));
    const gd = D().grants.flatMap((g) => (g.deadlines || []).filter((d) => !d.done).map((d) => ({ ...d, grant: g.name }))).sort((a, b) => a.date.localeCompare(b.date));
    const row = (i) => { const n = daysUntil(i.due);
      return `<div class="row"><span class="grow">${esc(i.title)}<small>Due ${fmtDate(i.due)} · ${duePill(n)}${i.recurring ? ' · yearly' : ''}${i.note ? ` · ${esc(i.note)}` : ''}</small></span>
        ${canEdit() ? `<button class="btn small primary" data-act="compliance-done" data-id="${i.id}">Done</button>` : `<span class="pill ${dueClass(n)}">${duePill(n)}</span>`}</div>`; };
    return `<div class="head"><h1>Compliance calendar</h1>${canEdit() ? '<button class="btn primary" data-act="compliance-add">+ Item</button>' : ''}</div>
      <p class="muted">Marking a yearly item done creates next year's item automatically. Form 990 for a fiscal year ending month ${D().settings.fiscalYearEndMonth} is due ${fmtDate(form990Due(D().settings.fiscalYearEndMonth, new Date().getFullYear() - 1))}.</p>
      <section class="card"><h3>Upcoming</h3>${open.map(row).join('') || empty('Nothing open.')}</section>
      <section class="card"><h3>Grant report deadlines</h3><p class="muted">Read-only. Manage them on each grant in Money.</p>
        ${gd.map((d) => `<div class="row"><span class="grow">${esc(d.label)}<small>${esc(d.grant)} · ${fmtDate(d.date)}</small></span><span class="pill ${dueClass(daysUntil(d.date))}">${duePill(daysUntil(d.date))}</span></div>`).join('') || empty('No grant deadlines.')}</section>
      <section class="card"><h3>Completed</h3>${done.map((i) => `<div class="row"><span class="grow done">${esc(i.title)}<small>Was due ${fmtDate(i.due)} · done ${fmtDate(i.doneDate)}</small></span></div>`).join('') || empty('None yet.')}</section>`;
  },
  forms: {
    'compliance-add': () => sheet('New compliance item', `${field('Title', '<input name="title" required maxlength="100">')}
      ${field('Due date', `<input name="due" type="date" required value="${today()}">`)}
      ${field('Repeats', `<select name="recurring">${options([['', 'Does not repeat'], ['yearly', 'Every year']])}</select>`)}
      ${field('Note', '<input name="note" maxlength="160">')}`, (f, fm) => {
      if (!fm.reportValidity()) return false;
      store.change('Compliance item added', f.get('title'), (d) => d.complianceItems.push({ id: store.id('ci'), title: f.get('title').trim(), due: f.get('due'), recurring: f.get('recurring') || null, done: false, note: f.get('note').trim() }));
    }),
  },
  actions: {
    'compliance-done': (el) => {
      const d = D(), i = d.complianceItems.find((x) => x.id === el.dataset.id);
      store.change('Compliance item completed', i.title, () => {
        const r = completeItem(i, today(), store.id('ci'));
        Object.assign(i, r.item);
        if (r.next) d.complianceItems.push(r.next);
      });
      toast(i.recurring ? `Done. Next due ${fmtDate(D().complianceItems.at(-1).due)}` : 'Done');
      return true;
    },
  },
  today() {
    const rows = dueSoon(D().complianceItems || [], today(), 30);
    if (!['ed', 'treasurer'].includes(store.user.role)) return '';
    return todayCard('Compliance due (30 days)', rows.map((i) => ({ t: i.title, sub: fmtDate(i.due), pill: duePill(i.days), cls: dueClass(i.days) })), '#/f/compliance');
  },
});
