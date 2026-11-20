import { register } from './registry.js';
import { store } from '../store.js';
import { esc, D, toast, sheet, field, today, fmtDate } from '../ui.js';
import { money } from '../rules.js';
import { shiftHours, slotsLeft, isSignedUp, canSignUp, hoursForUser, totalsByPerson, totalsByMonth, inKindValue } from '../rules/volunteers.js';
import { has, monthLabel, tabs, pageHead } from './p3util.js';

const shifts = () => D().volunteerShifts || [];
const manage = () => has('ed', 'lead');
const hourValue = () => Number(D().settings.volunteerHourValue) || 0;
const name = (id) => store.userName(id);
const t12 = (t) => new Date(`2000-01-01T${t}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

register({
  id: 'volunteers', title: 'Volunteer shifts', icon: '🙌', group: 'Community',
  collections: { volunteerShifts: [] },
  settings: { volunteerHourValue: 0 },
  demo: (iso) => ({ volunteerShifts: [
    { id: 'vs1', title: 'Community garden day', date: iso(5), start: '09:00', end: '12:00', place: 'Hilltop Community Garden', slots: 6, signups: [{ userId: 'u6', attended: false, hours: 0 }, { userId: 'u5', attended: false, hours: 0 }] },
    { id: 'vs2', title: 'Pack hygiene kits', date: iso(9), start: '13:00', end: '15:30', place: 'Foundation office', slots: 4, signups: [] },
    { id: 'vs3', title: 'Know Your Rights workshop setup', date: iso(-8), start: '16:00', end: '18:00', place: 'Tacoma Public Library', slots: 3, signups: [{ userId: 'u6', attended: true, hours: 2 }, { userId: 'u4', attended: true, hours: 2.5 }] },
    { id: 'vs4', title: 'Winter coat drive sorting', date: iso(-35), start: '10:00', end: '14:00', place: 'Foundation office', slots: 5, signups: [{ userId: 'u6', attended: true, hours: 4 }, { userId: 'u3', attended: true, hours: 3.5 }] },
  ] }),

  view(tab) {
    const u = store.user, all = shifts();
    const t = tabs('volunteers', [['shifts', 'Shifts'], ['hours', 'Hours']], tab === 'hours' ? 'hours' : 'shifts');
    if (tab === 'hours') {
      const rate = hourValue(), seeAll = has('ed', 'lead', 'treasurer', 'board');
      const mine = hoursForUser(all, u.id), people = totalsByPerson(all), months = totalsByMonth(all);
      const total = people.reduce((n, p) => n + p.total, 0), val = inKindValue(total, rate);
      return `${pageHead('Volunteer hours')}${t}
        <section class="card"><h3>My hours</h3><div class="stats"><div class="stat"><b>${mine}</b><span>Total hours</span></div>
          <div class="stat"><b>${all.filter((s) => isSignedUp(s, u.id) && !s.signups.find((x) => x.userId === u.id).attended && s.date >= today()).length}</b><span>Upcoming</span></div></div>
          ${(people.find((p) => p.userId === u.id) ? Object.entries(people.find((p) => p.userId === u.id).months) : []).map(([m, h]) => `<div class="row"><span class="grow">${monthLabel(m)}</span><b>${h} h</b></div>`).join('')}</section>
        ${seeAll ? `<section class="card"><h3>Totals by person</h3>${people.map((p) => `<div class="row"><span class="grow">${esc(name(p.userId))}<small>${Object.entries(p.months).map(([m, h]) => `${monthLabel(m)}: ${h}h`).join(' · ')}</small></span><b>${p.total} h</b></div>`).join('') || '<p class="empty">No attended hours yet.</p>'}</section>
        <section class="card"><h3>Totals by month</h3>${months.map((m) => `<div class="row"><span class="grow">${monthLabel(m.month)}</span><b>${m.hours} h</b></div>`).join('') || '<p class="empty">None.</p>'}</section>
        <section class="card"><h3>In-kind value</h3>
          ${val === null ? `<p>Set the hourly value to see the in-kind value of ${total} volunteer hours.</p>` : `<p><b>${money(val)}</b> = ${total} hours × ${money(rate)}/hour</p>`}
          ${u.role === 'ed' ? `<button class="btn" data-act="volunteers-rate">${val === null ? 'Set the hourly value' : 'Change hourly value'}</button>` : val === null ? '<p class="muted">The Executive Director sets the hourly value.</p>' : ''}</section>` : ''}`;
    }
    const up = all.filter((s) => s.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
    const past = all.filter((s) => s.date < today()).sort((a, b) => b.date.localeCompare(a.date));
    const row = (s) => {
      const su = s.signups.find((x) => x.userId === u.id);
      return `<div class="card"><div class="head"><h3>${esc(s.title)}</h3><span class="pill ${slotsLeft(s) ? '' : 'pending'}">${slotsLeft(s)} of ${s.slots} open</span></div>
        <p class="muted">${fmtDate(s.date)} · ${t12(s.start)}–${t12(s.end)} (${shiftHours(s)} h) · ${esc(s.place)}</p>
        ${s.signups.length ? `<p class="muted">Signed up: ${s.signups.map((x) => `${esc(name(x.userId))}${x.attended ? ` ✔ ${x.hours}h` : ''}`).join(', ')}</p>` : ''}
        ${s.date >= today() ? (su ? `<button class="btn" data-act="volunteers-cancel" data-id="${s.id}">Cancel my spot</button>` : canSignUp(s, u.id) ? `<button class="btn primary" data-act="volunteers-signup" data-id="${s.id}">Sign up</button>` : '<span class="muted">Full</span>')
          : su ? `<span class="pill ${su.attended ? 'approved' : ''}">${su.attended ? `Attended ${su.hours} h` : 'Not marked'}</span>` : ''}
        ${manage() ? `<button class="btn small" data-act="volunteers-attend" data-id="${s.id}">Mark attended</button> <button class="btn small ghost" data-act="volunteers-edit" data-id="${s.id}">Edit</button>` : ''}</div>`;
    };
    return `${pageHead('Volunteer shifts', manage() ? '<button class="btn primary" data-act="volunteers-edit">+ Shift</button>' : '')}${t}
      <h2>Upcoming</h2>${up.map(row).join('') || '<p class="empty card">No upcoming shifts.</p>'}
      <h2>Past</h2>${past.slice(0, 8).map(row).join('') || '<p class="empty card">None.</p>'}`;
  },

  forms: {
    'volunteers-edit'(el) {
      if (!manage()) return;
      const s = shifts().find((x) => x.id === el.dataset.id) || { title: '', date: today(), start: '09:00', end: '12:00', place: '', slots: 5 };
      sheet(el.dataset.id ? 'Edit shift' : 'New volunteer shift', `${field('Title', `<input name="title" required maxlength="80" value="${esc(s.title)}">`)}
        ${field('Date', `<input name="date" type="date" required value="${esc(s.date)}">`)}
        ${field('Start', `<input name="start" type="time" required value="${esc(s.start)}">`)}${field('End', `<input name="end" type="time" required value="${esc(s.end)}">`)}
        ${field('Place', `<input name="place" required maxlength="80" value="${esc(s.place)}">`)}
        ${field('Volunteer slots', `<input name="slots" type="number" min="1" max="100" required value="${s.slots}">`)}`,
      (f) => {
        if (f.get('end') <= f.get('start')) { toast('End must be after start'); return false; }
        const v = { title: f.get('title').trim(), date: f.get('date'), start: f.get('start'), end: f.get('end'), place: f.get('place').trim(), slots: Number(f.get('slots')) };
        if (s.id) store.change('Volunteer shift edited', v.title, () => Object.assign(s, v));
        else store.change('Volunteer shift created', v.title, (d) => d.volunteerShifts.push({ id: store.id('vs'), ...v, signups: [] }));
      });
    },
    'volunteers-attend'(el) {
      const s = shifts().find((x) => x.id === el.dataset.id);
      if (!manage() || !s) return;
      if (!s.signups.length) return toast('No one has signed up for this shift');
      sheet(`Attendance — ${s.title}`, s.signups.map((x, i) => `<div class="row check"><label class="grow" style="display:flex;gap:10px;align-items:center">
        <input type="checkbox" name="att${i}" ${x.attended ? 'checked' : ''} style="width:22px;height:22px"> ${esc(name(x.userId))}</label>
        <input type="number" name="hrs${i}" min="0" max="24" step="0.25" value="${x.hours || shiftHours(s)}" aria-label="Hours for ${esc(name(x.userId))}" style="width:80px;padding:8px;border-radius:8px;border:1px solid var(--line)"></div>`).join(''),
      (f) => store.change('Volunteer attendance recorded', s.title, () => s.signups.forEach((x, i) => {
        x.attended = f.has(`att${i}`); x.hours = x.attended ? Number(f.get(`hrs${i}`)) || 0 : 0;
      })));
    },
    'volunteers-rate'() {
      if (!has('ed')) return;
      sheet('Hourly value of volunteer time', `${field('Dollars per hour', `<input name="v" type="number" min="0" step="0.01" value="${hourValue() || ''}" required>`)}
        <p class="muted">Use the figure your accountant or funder recognizes. It is only used to show in-kind value.</p>`,
      (f) => { store.change('Volunteer hourly value set', `$${f.get('v')}`, (d) => { d.settings.volunteerHourValue = Number(f.get('v')); }); });
    },
  },

  actions: {
    'volunteers-signup'(el) {
      const s = shifts().find((x) => x.id === el.dataset.id);
      if (!s || !canSignUp(s, store.user.id)) return false;
      store.change('Volunteer signed up', `${s.title} — ${store.user.name}`, () => s.signups.push({ userId: store.user.id, attended: false, hours: 0 }));
      toast("You're signed up"); return true;
    },
    'volunteers-cancel'(el) {
      const s = shifts().find((x) => x.id === el.dataset.id);
      if (!s) return false;
      store.change('Volunteer cancelled', `${s.title} — ${store.user.name}`, () => { s.signups = s.signups.filter((x) => x.userId !== store.user.id); });
      return true;
    },
  },
});
