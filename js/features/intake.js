// Self-intake kiosk (#/f/intake/kiosk) and the staff queue (#/f/intake).
import { register } from './registry.js';
import { store } from '../store.js';
import { D, users, esc, today, fmtDate, field, options, checkRow, sheet, toast, empty, pill, ui } from '../ui.js';
import { NEEDS, validPin, checkPin, cleanSubmission, toParticipant } from '../rules/intake.js';

const isKiosk = () => /^#\/f\/intake\/kiosk/.test(location.hash);
const sync = () => document.body.classList.toggle('kiosk', isKiosk());
window.addEventListener('hashchange', sync);
sync();

let done = false, tries = 0, lockedUntil = 0;
const STAFF = ['ed', 'lead', 'outreach'];
const LANGS = ['English', 'Spanish', 'Somali', 'Vietnamese', 'Russian', 'Other (staff will help)'];

function kiosk() {
  if (done) return `<div class="kiosk-wrap"><h1>Thank you</h1><p class="kiosk-lead">A staff member will talk with you soon. You can hand the device back.</p>
    <button class="btn primary kiosk-btn" data-act="intake-next">Next person</button></div>`;
  return `<div class="kiosk-wrap"><h1>Welcome</h1>
    <p class="kiosk-lead">Tell us a little about how we can help. It takes about a minute. You can skip anything you do not want to share.</p>
    <form id="intake-form" class="kiosk-form" novalidate>
      ${field('First name', '<input name="firstName" required maxlength="40" autocomplete="off">')}
      ${field('Last initial or last name (optional)', '<input name="lastName" maxlength="40" autocomplete="off">')}
      ${field('How should we reach you?', `<select name="contactMethod">${options([['none', 'Not sure / find me here'], ['phone', 'Phone call'], ['text', 'Text message'], ['email', 'Email']])}</select>`)}
      ${field('Phone (optional)', '<input name="phone" type="tel" maxlength="20" autocomplete="off">')}
      ${field('Email (optional)', '<input name="email" type="email" maxlength="80" autocomplete="off">')}
      <fieldset><legend>What kind of help are you looking for? Pick any.</legend>${Object.entries(NEEDS).map(([k, l]) => checkRow('needs', k, l)).join('')}</fieldset>
      ${field('Preferred language', `<select name="language">${options(LANGS.map((l) => [l, l]))}</select>`)}
      ${field('Anything else you want us to know?', '<textarea name="note" maxlength="300"></textarea>')}
      <fieldset><legend>Your say</legend>${checkRow('consent', 'yes', 'I agree that the Foundation can keep what I wrote here to help me.', false,
        'Only staff who work with you can see it. You can ask us to remove it any time. We never ask for Social Security numbers, birth dates or ID numbers, so please do not write them.')}</fieldset>
      <button type="button" class="btn primary kiosk-btn" data-act="intake-submit">Send</button>
    </form>
    <p><button type="button" class="btn ghost" data-act="intake-exit">Staff exit</button></p></div>`;
}

function staff() {
  const u = store.user;
  const q = D().intakeQueue.filter((x) => x.status === 'pending');
  return `<div class="head"><h1>Self-intake</h1><a class="btn primary" href="#/f/intake/kiosk">Start kiosk mode</a></div>
    <p class="muted">Kiosk mode turns this device into a sign-in form for visitors. Leave it with a visitor, and use the staff PIN to exit.</p>
    <section class="card"><h3>Waiting for review (${q.length})</h3>
      ${q.map((x) => `<div class="row"><span class="grow"><b>${esc(`${x.firstName} ${x.lastName}`.trim())}</b>
        <small>${fmtDate(x.at)} · ${esc(x.needs.map((n) => NEEDS[n]).join(', ') || 'No needs picked')} · ${esc(x.language)}</small>
        <small>Contact: ${esc(x.contactMethod)}${x.phone ? ' ' + esc(x.phone) : ''}${x.email ? ' ' + esc(x.email) : ''}</small>
        ${x.note ? `<small>${esc(x.note)}</small>` : ''}</span>
        <span class="acts"><button class="btn small primary" data-act="intake-accept" data-id="${esc(x.id)}">Accept</button>
        <button class="btn small ghost" data-act="intake-dismiss" data-id="${esc(x.id)}">Dismiss</button></span></div>`).join('') || empty('No one waiting.')}
    </section>
    ${u.role === 'ed' ? '<section class="card"><h3>Kiosk PIN</h3><p class="muted">Staff use this 4-digit PIN to leave kiosk mode.</p><button class="btn" data-act="intake-pin">Change PIN</button></section>' : ''}`;
}

register({
  id: 'intake', title: 'Self-intake', icon: '📋', group: 'People', roles: STAFF, openViews: ['kiosk'],
  collections: { intakeQueue: [] },
  settings: { kioskPin: '2468' },
  demo: (iso) => ({ intakeQueue: [{ id: 'iq1', at: iso(-1), status: 'pending', firstName: 'Jamie', lastName: 'R.', contactMethod: 'text', phone: '555-0142', email: '', needs: ['housing', 'mentorship'], language: 'English', consent: true, note: 'Looking for a mentor and a place to stay.' }] }),
  view(a) {
    if (a === 'kiosk') return kiosk();
    return STAFF.includes(store.user.role) ? staff() : empty('This page is not available for your role.');
  },
  today() {
    const n = D().intakeQueue.filter((x) => x.status === 'pending').length;
    return n && STAFF.includes(store.user.role) ? `<a class="card" href="#/f/intake"><h3>Self-intake</h3><p>${n} new ${n === 1 ? 'person is' : 'people are'} waiting for review.</p></a>` : '';
  },
  forms: {
    'intake-exit'() {
      sheet('Staff exit', `${field('4-digit staff PIN', '<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autocomplete="off">')}`, (f) => {
        if (Date.now() < lockedUntil) { toast('Too many tries. Wait a moment.'); return false; }
        if (!checkPin(f.get('pin'), D().settings.kioskPin)) {
          if (++tries >= 5) { lockedUntil = Date.now() + 30000; tries = 0; }
          toast('That PIN is not right'); return false;
        }
        tries = 0; done = false; location.hash = '#/f/intake';
      }, { submitLabel: 'Exit' });
    },
    'intake-pin'() {
      sheet('Change kiosk PIN', field('New 4-digit PIN', '<input name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autocomplete="off">'), (f) => {
        if (!validPin(f.get('pin'))) { toast('Use exactly 4 digits'); return false; }
        store.change('Kiosk PIN changed', '', (d) => { d.settings.kioskPin = f.get('pin'); });
        toast('PIN changed');
      });
    },
    'intake-accept'(el) {
      const q = D().intakeQueue.find((x) => x.id === el.dataset.id);
      if (!q) return;
      const leads = users().filter((x) => ['ed', 'lead'].includes(x.role)).map((x) => [x.id, x.name]);
      sheet(`Accept ${q.firstName}`, `${field('Assigned lead', `<select name="leadId">${options(leads, leads.some(([id]) => id === store.user.id) ? store.user.id : leads[0]?.[0])}</select>`)}
        <p class="muted">This adds them to People. Contact details and their note go into a private case note.</p>`, (f) => {
        const p = toParticipant(q, { id: store.id('c'), leadId: f.get('leadId'), today: today(), by: store.user.id, noteId: store.id('n') });
        store.change('Intake accepted', p.name, (d) => {
          d.participants.push(p);
          Object.assign(q, { status: 'accepted', participantId: p.id, firstName: p.name.split(' ')[0], lastName: '', phone: '', email: '', note: '', needs: [] });
        });
        toast('Added to People');
      }, { submitLabel: 'Accept' });
    },
  },
  actions: {
    'intake-dismiss'(el) {
      const q = D().intakeQueue.find((x) => x.id === el.dataset.id);
      if (!q || !confirm('Dismiss this submission? Their details will be erased.')) return false;
      store.change('Intake dismissed', '', () => Object.assign(q, { status: 'dismissed', firstName: '', lastName: '', phone: '', email: '', note: '', needs: [] }));
      return true;
    },
    'intake-submit'(el) {
      const form = el.closest('form');
      const fd = new FormData(form);
      const r = cleanSubmission({ firstName: fd.get('firstName'), lastName: fd.get('lastName'), contactMethod: fd.get('contactMethod'), phone: fd.get('phone'),
        email: fd.get('email'), needs: fd.getAll('needs'), language: fd.get('language'), consent: fd.get('consent') === 'yes', note: fd.get('note') });
      if (r.error) { toast(r.error); form.querySelector(r.error.includes('box') ? '[name=consent]' : '[name=firstName]')?.focus(); return false; }
      store.change('Self-intake received', 'kiosk', (d) => d.intakeQueue.push({ id: store.id('iq'), at: today(), status: 'pending', ...r.value }));
      done = true;
      setTimeout(() => { if (done && isKiosk()) { done = false; ui.render(); } }, 15000);
      return true;
    },
    'intake-next'() { done = false; return true; },
  },
});

// Enter key inside the kiosk form submits it too.
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'intake-form') return;
  e.preventDefault();
  e.target.querySelector('[data-act=intake-submit]').click();
});
