import { register } from './registry.js';
import { store } from '../store.js';
import { $, esc, D, ui, toast, sheet, infoSheet, field, options, fmtDate } from '../ui.js';
import { INTERVALS, checkinStatus, secondsLeft, countdown, dueAt, overdueShifts, attentionShifts, openAlerts } from '../rules/field.js';
import { has, para, todayCard } from './p3util.js';

const shifts = () => D().fieldShifts || [];
const mine = () => shifts().find((s) => !s.endedAt && s.userId === store.user.id);
const PILL = { ok: ['approved', 'On time'], 'due-soon': ['pending', 'Check-in due soon'], overdue: ['rejected', 'OVERDUE'], ended: ['', 'Ended'] };
const time = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const pill = (s) => { const [c, t] = PILL[checkinStatus(s)]; return `<span class="pill ${c}">${t}</span>`; };
const name = (id) => store.userName(id);

function notify(title, body) {
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, tag: title }); } catch { /* unsupported */ }
}

// While the app is open: re-check every 30s, notify once per overdue shift, tick the countdown every second.
const notified = new Set();
let lastSig = null;
function tick() {
  if (!store.data || !store.user) return;
  const u = store.user;
  for (const s of overdueShifts(shifts())) {
    if ((u.role === 'ed' || s.userId === u.id) && !notified.has(s.id)) {
      notified.add(s.id);
      notify('Check-in overdue', u.id === s.userId ? 'Please check in — tap "I\'m OK".' : `${name(s.userId)} has missed a field check-in (${s.area}).`);
    }
  }
  // Re-render only when a status changed, so taps are never interrupted by a refresh.
  const sig = shifts().filter((s) => !s.endedAt).map((s) => `${s.id}:${checkinStatus(s)}`).join(',');
  const changed = lastSig !== null && sig !== lastSig;
  lastSig = sig;
  const h = location.hash || '#/today';
  if (changed && (h.startsWith('#/today') || h.startsWith('#/f/field')) && $('#sheet')?.hidden !== false) ui.render();
}
setInterval(tick, 30000);
setTimeout(tick, 2500);
setInterval(() => document.querySelectorAll('[data-due]').forEach((el) => {
  el.textContent = countdown(Math.round((Number(el.dataset.due) - Date.now()) / 1000));
}), 1000);

const emergency = (title) => infoSheet(title, `
  <p><b>If someone is in danger, call 911 now.</b></p>
  <a class="btn primary" href="tel:911" style="display:block;text-align:center;font-size:1.2rem;padding:16px">📞 Call 911</a>
  <h3 style="margin-top:14px">Executive Director contacts</h3>
  ${D().users.filter((x) => x.role === 'ed').map((x) => `<div class="row"><span class="grow">${esc(x.name)}<small>Phone: (placeholder — add the ED's number here)</small></span></div>`).join('') || '<p class="empty">No ED on file.</p>'}
  <p class="muted">Your urgent alert has been recorded on this device. Alerts reach other people's phones only once the secure backend is connected — until then, call.</p>`);

register({
  id: 'field', title: 'Field safety', icon: '🦺', group: 'Field', roles: ['ed', 'outreach', 'lead', 'volunteer'],
  collections: { fieldShifts: [] },
  demo: () => ({ fieldShifts: [
    { id: 'fs1', userId: 'u5', area: 'Hilltop corridor', purpose: 'Weekly outreach walk', partner: 'Casey N.', intervalMin: 60,
      start: new Date(Date.now() - 30 * 3600000).toISOString(), lastCheckin: new Date(Date.now() - 28 * 3600000).toISOString(),
      checkins: [], endedAt: new Date(Date.now() - 27 * 3600000).toISOString(), alerts: [] },
    { id: 'fs2', userId: 'u5', area: 'Tacoma Ave & S 11th', purpose: 'Supply drop-off', partner: '', intervalMin: 30,
      start: new Date(Date.now() - 2 * 3600000).toISOString(), lastCheckin: new Date(Date.now() - 50 * 60000).toISOString(),
      checkins: [], endedAt: null, alerts: [] },
  ] }),

  view() {
    const u = store.user, my = mine();
    const others = shifts().filter((s) => !s.endedAt && s !== my && (u.role === 'ed' || s.userId === u.id));
    const past = shifts().filter((s) => s.endedAt && (u.role === 'ed' || s.userId === u.id)).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 8);
    const card = (s) => `<div class="row"><span class="grow">${esc(s.area)} <small>${esc(name(s.userId))} · ${esc(s.purpose)} · started ${time(s.start)} · every ${s.intervalMin} min
      ${openAlerts(s).length ? ' · <span class="flag">NEEDS HELP</span>' : ''}</small></span>${pill(s)}
      ${u.role === 'ed' ? `<button class="btn small" data-act="field-end" data-id="${s.id}">Close out</button>` : ''}</div>`;
    return `<div class="head"><h1>Field safety</h1></div>
      <p class="muted">Alerts reach other people's phones only once the secure backend is connected. Until then, keep your phone on, tell your partner your plan, and call for help if needed.</p>
      ${my ? (() => { const st = checkinStatus(my); return `<section class="card ${st === 'overdue' ? 'alert' : ''}" aria-live="polite">
        <div class="head"><h3>Shift in progress</h3>${pill(my)}</div>
        <p>${esc(my.area)} · ${esc(my.purpose)}${my.partner ? ` · with ${esc(my.partner)}` : ''}</p>
        <div style="text-align:center;margin:8px 0"><div style="font-size:2.6rem;font-weight:800" data-due="${dueAt(my)}">${countdown(secondsLeft(my))}</div>
          <small class="muted">until next check-in (every ${my.intervalMin} min)</small></div>
        <button class="btn primary" style="width:100%;font-size:1.35rem;padding:22px" data-act="field-checkin">I'm OK — check in</button>
        <button class="btn" style="width:100%;margin-top:10px;border-color:var(--bad);color:var(--bad);padding:16px;font-size:1.1rem" data-act="field-help">🚨 Need help</button>
        <button class="btn ghost" data-act="field-end" data-id="${my.id}">End shift</button></section>`; })()
      : `<section class="card"><h3>No active shift</h3><p class="muted">Start a shift before you go out. You'll be asked to check in on a timer.</p>
          <button class="btn primary" data-act="field-start">Start shift</button></section>`}
      ${others.length ? `<section class="card"><h3>${u.role === 'ed' ? 'All active shifts' : 'Your active shifts'}</h3>${others.map(card).join('')}</section>` : ''}
      <section class="card"><h3>Recent shifts</h3>${past.map((s) => `<div class="row"><span class="date">${fmtDate(s.start.slice(0, 10))}</span>
        <span class="grow">${esc(s.area)}<small>${esc(name(s.userId))} · ${esc(s.purpose)} · ${(s.checkins || []).length} check-ins${(s.alerts || []).length ? ` · ${s.alerts.length} help alert(s)` : ''}</small></span></div>`).join('') || '<p class="empty">None yet.</p>'}</section>`;
  },

  forms: {
    'field-start'() {
      if (mine()) return toast('You already have a shift in progress');
      sheet('Start field shift', `${field('Location / area', '<input name="area" required maxlength="80" placeholder="e.g. Hilltop corridor">')}
        ${field('Purpose', '<input name="purpose" required maxlength="80" placeholder="e.g. Outreach walk">')}
        ${field('Partner (optional)', '<input name="partner" maxlength="60">')}
        ${field('Check in every', `<select name="interval">${options(INTERVALS.map((n) => [String(n), `${n} minutes`]), '30')}</select>`)}
        <p class="muted">The app may ask to send notifications so it can remind you to check in.</p>`,
      (f, form) => {
        try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* unsupported */ }
        const now = new Date().toISOString();
        store.change('Field shift started', f.get('area'), (d) => d.fieldShifts.push({ id: store.id('fs'), userId: store.user.id, area: f.get('area').trim(),
          purpose: f.get('purpose').trim(), partner: f.get('partner').trim(), intervalMin: Number(f.get('interval')), start: now, lastCheckin: now, checkins: [], endedAt: null, alerts: [] }));
      }, { submitLabel: 'Start shift' });
    },
  },

  actions: {
    'field-checkin'() {
      const s = mine(); if (!s) return false;
      const now = new Date().toISOString();
      store.change('Field check-in', s.area, () => { s.lastCheckin = now; s.checkins.push(now); });
      notified.delete(s.id);
      toast("Checked in — thanks!");
      return true;
    },
    'field-help'() {
      const s = mine(); if (!s) return false;
      store.change('URGENT: field help requested', `${s.area} — ${store.user.name}`, () => s.alerts.push({ id: store.id('al'), at: new Date().toISOString() }));
      emergency('Help alert recorded');
      return true;
    },
    'field-end'(el) {
      const s = shifts().find((x) => x.id === el.dataset.id);
      if (!s || (s.userId !== store.user.id && !has('ed'))) return false;
      store.change('Field shift ended', `${s.area} — ${name(s.userId)}`, () => { s.endedAt = new Date().toISOString(); (s.alerts || []).forEach((a) => { a.resolved = true; }); });
      toast('Shift ended');
      return true;
    },
  },

  today() {
    const list = attentionShifts(shifts(), store.user);
    if (!list.length) return '';
    return todayCard('⚠ Field check-in alert', list.map((s) => `<div class="row"><span class="grow"><b>${esc(name(s.userId))}</b> — ${esc(s.area)}
      <small>${openAlerts(s).length ? 'URGENT: asked for help' : `${countdown(secondsLeft(s))} · every ${s.intervalMin} min`}</small></span>${pill(s)}</div>`),
    '#/f/field', 'Open field safety', 'alert');
  },
});
