import { register } from './registry.js';
import { store } from '../store.js';
import { esc, D, toast, sheet, field, options, today, fmtDate } from '../ui.js';
import { money } from '../rules.js';
import { DEFAULT_RATE, rideMiles, monthlySummary, groupForSubmission, mileageExpense, validateRide, reimbursement, monthOf } from '../rules/rides.js';
import { has, monthLabel, progName, progOptions, pageHead } from './p3util.js';

const rides = () => D().rides || [];
const rate = () => Number(D().settings.mileageRate ?? DEFAULT_RATE);
const sees = () => has('ed', 'treasurer');

register({
  id: 'rides', title: 'Ride & mileage log', icon: '🚗', group: 'Field', roles: ['ed', 'treasurer', 'outreach', 'lead', 'volunteer'],
  collections: { rides: [] },
  settings: { mileageRate: DEFAULT_RATE },
  demo: (iso) => ({ rides: [
    { id: 'rd1', driverId: 'u5', date: iso(-9), from: 'Foundation office', to: 'Hilltop Community Center', purpose: 'Deliver supplies', passengers: '', odoStart: 41210, odoEnd: 41226, miles: '', programId: 'p5', submitted: null },
    { id: 'rd2', driverId: 'u5', date: iso(-4), from: 'Foundation office', to: 'Tacoma Public Library', purpose: 'Workshop setup', passengers: 'DB, TG', odoStart: '', odoEnd: '', miles: 12.4, programId: 'p4', submitted: null },
    { id: 'rd3', driverId: 'u6', date: iso(-6), from: 'Casey home', to: 'Foundation office', purpose: 'Volunteer shift', passengers: '', odoStart: '', odoEnd: '', miles: 8.2, programId: 'p1', submitted: null },
    { id: 'rd4', driverId: 'u4', date: iso(-2), from: 'Foundation office', to: 'Housing appt., Lakewood', purpose: 'Client transport', passengers: 'LW', odoStart: 18800, odoEnd: 18831, miles: '', programId: 'p5', submitted: null },
  ] }),

  view() {
    const u = store.user, r = rate();
    const mineAll = rides().filter((x) => x.driverId === u.id);
    const shown = (sees() ? rides() : mineAll).sort((a, b) => b.date.localeCompare(a.date));
    const sum = monthlySummary(shown, r);
    const pending = groupForSubmission(rides(), u.id, r);
    const pendTotal = pending.reduce((n, g) => n + g.amount, 0);
    return `${pageHead('Ride & mileage log', '<button class="btn primary" data-act="rides-add">+ Log ride</button>')}
      <section class="card"><div class="head"><div><h3>Mileage rate</h3><b>$${r.toFixed(2)} / mile</b>
        <small class="muted"><br>IRS business standard rate effective July 1, 2026</small></div>
        ${sees() ? '<button class="btn small" data-act="rides-rate">Edit</button>' : ''}</div></section>
      <section class="card"><h3>Ready to submit</h3>
        ${pending.length ? `<p>${pending.reduce((n, g) => n + g.rideIds.length, 0)} ride(s), ${pending.reduce((n, g) => n + g.miles, 0).toFixed(1)} miles = <b>${money(pendTotal)}</b></p>
          <button class="btn primary" data-act="rides-submit">Submit for reimbursement</button>
          <p class="muted">Creates an expense for approval (one per program). Odometer or typed miles are used as logged.</p>`
          : '<p class="empty">No unsubmitted rides.</p>'}</section>
      <section class="card"><h3>${sees() ? 'Monthly summary by driver' : 'My monthly summary'}</h3>
        ${sum.map((x) => `<div class="row"><span class="grow">${esc(store.userName(x.driverId))}<small>${monthLabel(x.month)} · ${x.rides} ride(s) · ${x.miles} mi</small></span><b>${money(x.amount)}</b></div>`).join('') || '<p class="empty">No rides yet.</p>'}</section>
      <section class="card"><h3>${sees() ? 'All rides' : 'My rides'}</h3>
        ${shown.map((x) => `<div class="row"><span class="date">${fmtDate(x.date)}</span><span class="grow">${esc(x.from)} → ${esc(x.to)}
          <small>${esc(store.userName(x.driverId))} · ${esc(x.purpose)} · ${rideMiles(x)} mi · ${esc(progName(x.programId))}${x.passengers ? ` · passengers: ${esc(x.passengers)}` : ''}</small></span>
          ${x.submitted ? '<span class="pill approved">Submitted</span>' : ''}</div>`).join('') || '<p class="empty">No rides logged.</p>'}</section>`;
  },

  forms: {
    'rides-add'() {
      sheet('Log a ride', `<p class="muted">Driver: ${esc(store.user.name)}</p>
        ${field('Date', `<input name="date" type="date" value="${today()}" required>`)}
        ${field('From', '<input name="from" required maxlength="80">')}${field('To', '<input name="to" required maxlength="80">')}
        ${field('Purpose', '<input name="purpose" required maxlength="80">')}
        ${field('Program', `<select name="programId">${options(progOptions())}</select>`)}
        ${field('Passenger initials (optional)', '<input name="passengers" maxlength="30" placeholder="Initials only, e.g. DB, TG">')}
        <fieldset><legend>Distance — odometer or miles</legend>
        ${field('Odometer start', '<input name="odoStart" type="number" min="0" step="0.1">')}${field('Odometer end', '<input name="odoEnd" type="number" min="0" step="0.1">')}
        ${field('…or miles driven', '<input name="miles" type="number" min="0" step="0.1">')}</fieldset>`,
      (f) => {
        const r = { id: store.id('rd'), driverId: store.user.id, date: f.get('date'), from: f.get('from').trim(), to: f.get('to').trim(), purpose: f.get('purpose').trim(),
          passengers: f.get('passengers').trim(), odoStart: f.get('odoStart'), odoEnd: f.get('odoEnd'), miles: f.get('miles'), programId: f.get('programId'), submitted: null };
        const err = validateRide(r);
        if (err) { toast(err); return false; }
        store.change('Ride logged', `${r.from} → ${r.to}, ${rideMiles(r)} mi`, (d) => d.rides.push(r));
      });
    },
    'rides-rate'() {
      if (!sees()) return;
      sheet('Mileage rate', `${field('Dollars per mile', `<input name="rate" type="number" min="0" max="5" step="0.001" value="${rate()}" required>`)}
        <p class="muted">Default 0.76 = IRS business standard rate effective July 1, 2026. Update when the IRS changes it.</p>`,
      (f) => { store.change('Mileage rate changed', `$${Number(f.get('rate'))}/mi`, (d) => { d.settings.mileageRate = Number(f.get('rate')); }); });
    },
  },

  actions: {
    'rides-submit'() {
      const u = store.user, groups = groupForSubmission(rides(), u.id, rate());
      if (!groups.length) return false;
      store.change('Mileage submitted for reimbursement', `${u.name}: ${groups.length} expense(s)`, (d) => {
        for (const g of groups) {
          const id = store.id('x');
          d.expenses.push(mileageExpense({ id, date: today(), name: u.name, amount: reimbursement(g.miles, rate()), programId: g.programId, driverId: u.id }));
          for (const r of d.rides) if (g.rideIds.includes(r.id)) r.submitted = id;
        }
      });
      toast('Submitted — it now waits for approval under Money');
      return true;
    },
  },
});
