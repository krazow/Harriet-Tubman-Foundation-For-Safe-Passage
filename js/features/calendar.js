// Calendar export (.ics) and 60-day agenda. Device-side: no calendar sync service.
import { register } from './registry.js';
import { store } from '../store.js';
import { D, esc, today, fmtDate, download, toast, empty, pill } from '../ui.js';
import { TYPES, typesFor, collectItems, buildICS, agenda } from '../rules/calendar.js';

const off = new Set(); // types the user switched off (default: all on)
const role = () => store.user.role;
const selected = () => typesFor(role()).filter((t) => !off.has(t));
const items = (types) => collectItems(D(), { role: role(), userId: store.user.id, types });

register({
  id: 'calendar', title: 'Calendar export', icon: '📅', group: 'Admin',
  view() {
    const sel = selected();
    const all = items(sel);
    const next = agenda(items(typesFor(role())), today(), 60);
    return `<h1>Calendar</h1>
      <p class="muted">Download an .ics file you can import into Google Calendar, Apple Calendar or Outlook. It is a snapshot made on this device; it does not update by itself.</p>
      <section class="card"><h3>Include</h3>
        ${typesFor(role()).map((t) => `<label class="row check"><input type="checkbox" data-act="calendar-type" data-t="${t}" ${sel.includes(t) ? 'checked' : ''}><span class="grow">${esc(TYPES[t].label)}</span></label>`).join('')}
        <p class="muted">${all.length} item${all.length === 1 ? '' : 's'} will be exported.</p>
        <button class="btn primary" data-act="calendar-download">Download .ics</button>
        <details><summary>How to import into Google Calendar</summary>
          <ol class="muted"><li>On a computer, open calendar.google.com.</li><li>Click the gear, then Settings, then Import &amp; export.</li><li>Choose the downloaded file, pick which calendar to add it to, and click Import.</li><li>Consider a separate calendar so you can remove the import later. Re-importing the same file will not duplicate events.</li></ol></details>
      </section>
      <section class="card"><h3>Next 60 days</h3>
        ${next.map((i) => `<div class="row"><span class="date">${fmtDate(i.date)}</span><span class="grow">${esc(i.title)}<small>${esc(i.time || 'All day')}${i.location ? ' · ' + esc(i.location) : ''}</small></span>${pill(i.category)}</div>`).join('') || empty('Nothing in the next 60 days.')}
      </section>`;
  },
  actions: {
    'calendar-download'() {
      const list = items(selected());
      if (!list.length) { toast('Nothing to export for those choices'); return false; }
      download(`safe-passage-calendar-${today()}.ics`, buildICS(list), 'text/calendar');
      store.change('Calendar exported', `${list.length} items`, () => {});
      return false;
    },
  },
  changes: { 'calendar-type'(el) { el.checked ? off.delete(el.dataset.t) : off.add(el.dataset.t); return true; } },
});
