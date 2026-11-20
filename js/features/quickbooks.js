// QuickBooks Online export (device-side: builds files to import; no live connection yet).
import { register } from './registry.js';
import { store } from '../store.js';
import { D, users, esc, today, fmtDate, field, sheet, toast, download, empty } from '../ui.js';
import { money } from '../rules.js';
import { QB_DEFAULT_MAP, accountFor, approvedInRange, newSinceExport, qboBankCsv, qboDetailCsv } from '../rules/quickbooks.js';

const range = { from: '', to: '' };
const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const bounds = () => ({ from: range.from || iso(-30), to: range.to || today() });
const map = () => D().settings.qbAccountMap || {};
const categories = () => [...new Set([...Object.keys(QB_DEFAULT_MAP), ...D().expenses.map((e) => e.category).filter(Boolean), ...Object.keys(map())])];
const chosen = () => { const { from, to } = bounds(); return approvedInRange(D().expenses, users(), from, to); };

function exportFile(kind) {
  const list = chosen();
  if (!list.length) { toast('No approved expenses in that date range'); return false; }
  const { from, to } = bounds();
  if (kind === 'bank') download(`qbo-bank-transactions-${from}-to-${to}.csv`, qboBankCsv(list), 'text/csv');
  else download(`qbo-expense-detail-${from}-to-${to}.csv`, qboDetailCsv(list, { map: map(), programs: D().programs, grants: D().grants, users: users() }), 'text/csv');
  store.change('QuickBooks export', `${kind} file, ${list.length} expenses, ${from} to ${to}`, (d) => { d.settings.qbLastExport = today(); });
  return true;
}

register({
  id: 'quickbooks', title: 'QuickBooks export', icon: '📒', group: 'Money', roles: ['ed', 'treasurer'],
  settings: { qbAccountMap: { ...QB_DEFAULT_MAP }, qbLastExport: '' },
  view() {
    const { from, to } = bounds();
    const list = chosen();
    const total = list.reduce((s, e) => s + Number(e.amount || 0), 0);
    const last = D().settings.qbLastExport;
    const fresh = newSinceExport(D().expenses, users(), last).length;
    return `<h1>QuickBooks export</h1>
      <p class="muted">This builds files on this device for you to import into QuickBooks Online. There is no live connection to QuickBooks yet. Only fully approved expenses are included.</p>
      <section class="card">
        ${field('From', `<input type="date" value="${esc(from)}" data-act="quickbooks-from">`)}
        ${field('To', `<input type="date" value="${esc(to)}" data-act="quickbooks-to">`)}
        <div class="stats">
          <div class="stat"><b>${list.length}</b><span>Approved in range</span></div>
          <div class="stat"><b>${money(total)}</b><span>Total</span></div>
          <div class="stat"><b>${fresh}</b><span>New since last export</span></div>
        </div>
        <p class="muted">${last ? `Last export: ${esc(fmtDate(last))}` : 'Not exported yet.'}</p>
        <button class="btn primary" data-act="quickbooks-bank">Download bank transactions (CSV)</button>
        <button class="btn" data-act="quickbooks-detail">Download expense detail (CSV)</button>
        <p class="muted">In QuickBooks Online: Transactions, Bank transactions, Upload from file. The detail file is for your bookkeeper (account, program as class, grant, who approved).</p>
      </section>
      <section class="card"><div class="head"><h3>Account mapping</h3><button class="btn small" data-act="quickbooks-map">Edit</button></div>
        ${categories().map((c) => `<div class="row"><span class="grow">${esc(c)}</span><span>${esc(accountFor(c, map()))}</span></div>`).join('')}
      </section>
      <section class="card"><h3>In this range</h3>
        ${list.map((e) => `<div class="row"><span class="date">${fmtDate(e.date)}</span><span class="grow">${esc(e.vendor)}<small>${esc(e.category)} to ${esc(accountFor(e.category, map()))}</small></span><b>${money(e.amount)}</b></div>`).join('') || empty('No approved expenses in this range.')}
      </section>`;
  },
  forms: {
    'quickbooks-map'() {
      const cats = categories();
      sheet('QuickBooks account mapping', cats.map((c, i) => field(c, `<input name="c${i}" value="${esc(accountFor(c, map()))}" maxlength="60">`)).join('') +
        '<p class="muted">Use the exact account name from your QuickBooks chart of accounts. Leave empty to use the default.</p>', (f) => {
        const next = {};
        cats.forEach((c, i) => { const v = String(f.get('c' + i) || '').trim(); if (v && v !== (QB_DEFAULT_MAP[c] || QB_DEFAULT_MAP.Other)) next[c] = v; else if (QB_DEFAULT_MAP[c]) next[c] = QB_DEFAULT_MAP[c]; });
        store.change('QuickBooks account map updated', `${Object.keys(next).length} categories`, (d) => { d.settings.qbAccountMap = next; });
        toast('Mapping saved');
      });
    },
  },
  actions: {
    'quickbooks-bank': () => exportFile('bank'),
    'quickbooks-detail': () => exportFile('detail'),
  },
  changes: {
    'quickbooks-from': (el) => { range.from = el.value; return true; },
    'quickbooks-to': (el) => { range.to = el.value; return true; },
  },
});
