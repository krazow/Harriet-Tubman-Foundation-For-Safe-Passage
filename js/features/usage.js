// Privacy-friendly usage counts: page views per route segment and feature actions per day.
// Opt-in. Stored only on this device in localStorage; no user ids, no record contents.
import { register } from './registry.js';
import { store } from '../store.js';
import { D, esc, fmtDate, toast, empty } from '../ui.js';
import { recordView, recordAction, summarize } from '../rules/usage.js';

const KEY = 'spo:usage';
const day = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const enabled = () => store.data?.settings?.usageAnalytics === true;
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (u) => { try { localStorage.setItem(KEY, JSON.stringify(u)); } catch { /* storage full: skip */ } };
const countView = () => { if (enabled()) save(recordView(load(), day(), location.hash)); };
const countAct = (el) => { if (enabled() && el?.dataset?.act) save(recordAction(load(), day(), el.dataset.act)); };

window.addEventListener('hashchange', countView);
setTimeout(countView, 0); // the page that was opened
// Buttons and links count on click; checkboxes and selects count when changed (never both).
document.addEventListener('click', (e) => { const el = e.target.closest?.('[data-act]'); if (el && !el.matches('input,select,textarea')) countAct(el); }, true);
document.addEventListener('change', (e) => { if (e.target.matches?.('[data-act]')) countAct(e.target); }, true);

register({
  id: 'usage', title: 'Usage statistics', icon: '📊', group: 'Admin', roles: ['ed'],
  settings: { usageAnalytics: false },
  view() {
    const on = enabled();
    const s = summarize(load(), day(), 30);
    return `<h1>Usage statistics</h1>
      <p class="muted">Off by default. When on, this device counts how often each page and button is used per day. It never records who, or anything typed into a record. Counts stay on this device and are not sent anywhere.</p>
      <section class="card"><label class="row check"><input type="checkbox" data-act="usage-toggle" ${on ? 'checked' : ''}><span class="grow">Count usage on this device</span></label>
        <button class="btn" data-act="usage-clear">Clear counts</button></section>
      <section class="card"><h3>Last 30 days</h3>
        ${s.totalViews + s.totalActions ? `<table class="tbl"><thead><tr><th scope="col">Day</th><th scope="col">Page views</th><th scope="col">Actions</th></tr></thead><tbody>
          ${s.rows.filter((r) => r.views || r.actions).map((r) => `<tr><td>${esc(fmtDate(r.day))}</td><td>${r.views}</td><td>${r.actions}</td></tr>`).join('')}
          <tr><th scope="row">Total</th><td>${s.totalViews}</td><td>${s.totalActions}</td></tr></tbody></table>` : empty(on ? 'No counts yet.' : 'Nothing counted. Turn counting on above.')}
      </section>
      ${s.pages.length ? `<section class="card"><h3>By page</h3><table class="tbl"><tbody>${s.pages.map(([k, n]) => `<tr><td>${esc(k)}</td><td>${n}</td></tr>`).join('')}</tbody></table></section>` : ''}
      ${s.actions.length ? `<section class="card"><h3>By action</h3><table class="tbl"><tbody>${s.actions.map(([k, n]) => `<tr><td>${esc(k)}</td><td>${n}</td></tr>`).join('')}</tbody></table></section>` : ''}`;
  },
  changes: {
    'usage-toggle'(el) {
      store.change('Usage statistics ' + (el.checked ? 'on' : 'off'), '', (d) => { d.settings.usageAnalytics = el.checked; });
      return true;
    },
  },
  actions: {
    'usage-clear'() { if (!confirm('Clear all usage counts on this device?')) return false; localStorage.removeItem(KEY); toast('Counts cleared'); return true; },
  },
});
