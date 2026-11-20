// Organization settings, large-text mode, and an editor for every setting key.
import { register } from './registry.js';
import { store } from '../store.js';
import { D, esc, field, toast } from '../ui.js';

const LT = 'spo:largeText';
export const largeText = () => { try { return localStorage.getItem(LT) === '1'; } catch { return false; } };
const apply = () => { document.body.classList.toggle('large-text', largeText()); document.documentElement.classList.toggle('large-text', largeText()); };
apply();

const ORG = [['orgName', 'Organization name'], ['orgAddress', 'Address'], ['orgEIN', 'EIN']];
const HIDDEN = new Set(['kioskPin', ...ORG.map(([k]) => k)]); // PIN lives on the Intake page

const input = (k, v) => {
  const a = `data-act="settings-set" data-key="${esc(k)}"`;
  if (typeof v === 'number') return `<input type="number" step="any" value="${esc(v)}" ${a}>`;
  if (typeof v === 'boolean') return `<input type="checkbox" ${v ? 'checked' : ''} ${a}>`;
  return `<input type="text" value="${esc(v)}" ${a}>`;
};

register({
  id: 'settings', title: 'Settings', icon: '⚙️', group: 'Admin', roles: ['ed'],
  settings: { orgName: 'Harriet Tubman Foundation for Safe Passage', orgAddress: '1107 Tacoma Ave, Tacoma, WA 98402', orgEIN: '82-4154435' },
  view() {
    const s = D().settings;
    const rest = Object.keys(s).filter((k) => !HIDDEN.has(k)).sort();
    return `<h1>Settings</h1>
      <section class="card"><h3>Organization</h3>${ORG.map(([k, l]) => field(l, input(k, s[k] ?? ''))).join('')}</section>
      <section class="card"><h3>Display on this device</h3>
        <label class="row check"><input type="checkbox" data-act="settings-largetext" ${largeText() ? 'checked' : ''}><span class="grow">Large text<small>Bigger type for easier reading. Saved on this device only.</small></span></label></section>
      <section class="card"><h3>All settings</h3><p class="muted">Rates and limits used across the app. Changes are saved in the activity log.</p>
        ${rest.map((k) => (s[k] !== null && typeof s[k] === 'object'
          ? `<div class="field"><span class="lbl">${esc(k)} (edit on its own page)</span><pre class="muted">${esc(JSON.stringify(s[k], null, 1))}</pre></div>`
          : typeof s[k] === 'boolean' ? `<label class="row check">${input(k, s[k])}<span class="grow">${esc(k)}</span></label>` : field(k, input(k, s[k])))).join('')}
      </section>`;
  },
  changes: {
    'settings-largetext'(el) { try { localStorage.setItem(LT, el.checked ? '1' : '0'); } catch { /* private mode */ } apply(); return true; },
    'settings-set'(el) {
      const k = el.dataset.key, s = D().settings;
      if (!Object.hasOwn(s, k) && !ORG.some(([o]) => o === k)) return false;
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (typeof s[k] === 'number') { v = Number(v); if (el.value.trim() === '' || !Number.isFinite(v)) { toast('Enter a number'); return true; } }
      if (k === 'orgEIN' && !/^\d{2}-\d{7}$/.test(v)) { toast('EIN looks like 12-3456789'); return true; }
      if (typeof v === 'string') v = v.trim().slice(0, 200);
      store.change('Setting changed', `${k}`, (d) => { d.settings[k] = v; });
      toast('Saved');
      return true;
    },
  },
});
