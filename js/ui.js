// Shared UI helpers used by app.js and every feature module.
import { store } from './store.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const today = () => new Date().toISOString().slice(0, 10);
export const fmtDate = (d) => (d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
export const relDays = (n) => (n < 0 ? `${-n}d overdue` : n === 0 ? 'today' : `in ${n}d`);
export const D = () => store.data;
export const users = () => store.data.users;

/** Re-render hook; app.js sets this. */
export const ui = { render: () => {} };

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

/**
 * Bottom sheet form. onSubmit(formData, form) may be async; return false to keep it open.
 * The sheet re-renders the page after a successful save.
 */
export function sheet(title, bodyHtml, onSubmit, { submitLabel = 'Save' } = {}) {
  const el = $('#sheet');
  openTrap(el);
  el.innerHTML = `<form class="sheet-card" novalidate role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></header>
    <div class="sheet-body" tabindex="-1">${bodyHtml}</div>
    <footer><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">${esc(submitLabel)}</button></footer>
  </form>`;
  el.hidden = false;
  const form = $('form', el);
  el.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeSheet));
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const ok = await onSubmit(new FormData(form), form);
    if (ok !== false) { closeSheet(); ui.render(); }
  };
  setTimeout(() => (form.querySelector('input,select,textarea') || form.querySelector('.sheet-body')).focus(), 50);
}
export function closeSheet() {
  const s = $('#sheet');
  s.hidden = true; s.innerHTML = '';
  for (const n of document.querySelectorAll('[data-was-inert]')) { n.inert = false; n.removeAttribute('data-was-inert'); }
  const back = trap.opener; trap.opener = null;
  if (back && back.isConnected) back.focus(); // if a re-render removed it, app.js restores focus by data-act
}

// Focus trap for sheets: remember the opener, make the page behind inert, keep Tab inside.
const trap = { opener: null };
function openTrap(el) {
  if (el.hidden) trap.opener = document.activeElement;
  for (const n of document.querySelectorAll('body > :not(#sheet):not(#toast):not(script)')) { if (!n.inert) { n.inert = true; n.setAttribute('data-was-inert', ''); } }
  el.onkeydown = (e) => {
    if (e.key !== 'Tab') return;
    const items = [...el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && !x.hidden && x.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  };
}

/** Simple read-only sheet (e.g. a printable letter or details). */
export function infoSheet(title, bodyHtml) {
  const el = $('#sheet');
  openTrap(el);
  el.innerHTML = `<div class="sheet-card" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></header>
    <div class="sheet-body">${bodyHtml}</div>
    <footer><button type="button" class="btn" data-print>Print / Save PDF</button><button type="button" class="btn primary" data-close>Done</button></footer>
  </div>`;
  el.hidden = false;
  el.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeSheet));
  el.querySelector('[data-print]').onclick = () => printHtml(title, bodyHtml);
  setTimeout(() => el.querySelector('[data-close]').focus(), 50);
}

let fieldSeq = 0;
/** Labelled form field. `input` is raw HTML for an input/select/textarea. */
export const field = (label, input) => {
  const id = `f${++fieldSeq}`;
  const withId = input.replace(/^<(input|select|textarea)/, `<$1 id="${id}"`);
  return `<div class="field"><label for="${id}">${esc(label)}</label>${withId}</div>`;
};
export const options = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');
export const checkRow = (name, value, label, checked = false, sub = '') =>
  `<label class="row check"><input type="checkbox" name="${esc(name)}" value="${esc(value)}" ${checked ? 'checked' : ''}><span class="grow">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></label>`;
export const empty = (msg) => `<p class="empty">${esc(msg)}</p>`;
export const pill = (text, cls = '') => `<span class="pill ${cls}">${esc(text)}</span>`;

export function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(text instanceof Blob ? text : new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n');

/** Open a clean printable page (the user picks "Save as PDF" in the print dialog). */
export function printHtml(title, bodyHtml) {
  const w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups to print');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>body{font-family:system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#222;line-height:1.45}
    table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border:1px solid #ccc;padding:6px;text-align:left;font-size:13px}
    h1{font-size:22px}h2{font-size:17px;margin-top:22px}.muted{color:#666;font-size:13px}button,.btn{display:none}</style></head>
    <body>${bodyHtml}<script>setTimeout(()=>print(),300)<\/script></body></html>`);
  w.document.close();
}

export async function shrinkImage(file, max = 900) {
  if (!file || !file.size) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = img.width * scale; c.height = img.height * scale;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}
