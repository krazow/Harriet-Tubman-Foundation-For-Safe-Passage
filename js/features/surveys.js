import { register } from './registry.js';
import { store } from '../store.js';
import { $, esc, D, toast, sheet, field, options, today, fmtDate, download, toCSV } from '../ui.js';
import { TYPES, STATUS_NEXT, FINDING_STATUS, FINDING_LABEL, parseTags, aggregate, tagFrequency, cleanAnswer, responsesCSV } from '../rules/surveys.js';
import { has, pageHead, para } from './p3util.js';

const surveys = () => D().surveys || [];
const responses = () => D().surveyResponses || [];
const notes = () => D().listeningNotes || [];
const get = (id) => surveys().find((s) => s.id === id);
const build = () => has('ed', 'lead', 'outreach');
const review = () => has('ed', 'lead', 'board', 'outreach');
const typeLabel = (t) => TYPES.find(([k]) => k === t)?.[1] || t;
const THEMES = ['housing', 'safety', 'food', 'jobs', 'health', 'transportation', 'youth', 'trust', 'services'];
const pillCls = { draft: '', open: 'approved', closed: 'pending' };
const taken = {}; // kiosk state per survey: true after submit -> thank-you screen

const tagList = (tags) => (tags || []).map((t) => `<span class="chip">#${esc(t)}</span>`).join(' ');
const freqHtml = (f) => f.length ? `<div class="chips">${f.map((x) => `<span class="chip">#${esc(x.tag)} · ${x.count}</span>`).join('')}</div>` : '<p class="empty">No tags yet.</p>';
const datalist = '<datalist id="themes">' + THEMES.map((t) => `<option value="${t}">`).join('') + '</datalist>';
const tabNav = (cur) => `<nav class="tabs"><a href="#/f/surveys" class="${cur === 'surveys' ? 'on' : ''}">Surveys</a><a href="#/f/surveys/listening" class="${cur === 'listening' ? 'on' : ''}">Listening sessions</a></nav>`;

function takeView(s) {
  if (!s || s.status !== 'open') return '<a class="back" href="#/f/surveys">‹ Surveys</a><p class="empty">This survey is not open.</p>';
  if (taken[s.id]) return `<section class="card" style="text-align:center;padding:30px 14px"><h1>Thank you!</h1><p>Your answers were saved without your name.</p>
    <button class="btn primary" style="font-size:1.2rem;padding:16px 28px" data-act="surveys-next" data-id="${s.id}">Next person</button>
    <p><a class="back" href="#/f/surveys">Done — leave kiosk</a></p></section>`;
  return `<a class="back" href="#/f/surveys">‹ Surveys</a><h1>${esc(s.title)}</h1><p>${para(s.intro || '')}</p>
    <p class="muted">Answers are anonymous. Works offline on this device. Skip anything you like.</p>
    <form id="survey-form" novalidate>${s.questions.map((q, i) => `<fieldset><legend>${i + 1}. ${esc(q.text)}${q.contact ? ' (optional)' : ''}</legend>
      ${q.type === 'text' ? `<textarea name="q_${q.id}" aria-label="${esc(q.text)}" maxlength="1000"></textarea>`
        : q.type === 'scale' ? `<div class="seg">${[1, 2, 3, 4, 5].map((n) => `<label style="flex:1;text-align:center;padding:12px 0"><input type="radio" name="q_${q.id}" value="${n}"><br>${n}</label>`).join('')}</div><small class="muted">1 = low · 5 = high</small>`
        : q.options.map((o) => `<label class="row check"><input type="${q.type === 'single' ? 'radio' : 'checkbox'}" name="q_${q.id}" value="${esc(o)}"><span class="grow">${esc(o)}</span></label>`).join('')}</fieldset>`).join('')}
      <button type="button" class="btn primary" style="width:100%;padding:16px" data-act="surveys-submit" data-id="${s.id}">Submit</button></form>`;
}

function resultsView(s) {
  if (!s || !review()) return '<p class="empty">Not available.</p>';
  const ag = aggregate(s, responses()), rs = responses().filter((r) => r.surveyId === s.id);
  return `<a class="back" href="#/f/surveys/${s.id}">‹ ${esc(s.title)}</a><h1>Results</h1><p class="muted">${ag.count} response(s)</p>
    ${ag.questions.filter((q) => !q.contact).map((q) => `<section class="card"><h3>${esc(q.text)}</h3><p class="muted">${q.answered} answered · ${typeLabel(q.type)}</p>
      ${q.counts ? Object.entries(q.counts).map(([o, n]) => `<div class="row"><span class="grow">${esc(o)}<div class="bar"><i style="width:${q.answered ? Math.round(n / q.answered * 100) : 0}%"></i></div></span><b>${n}</b></div>`).join('')
        : q.dist ? `<p><b>${q.average ?? '—'}</b> average (1–5)</p>${q.dist.map((n, i) => `<div class="row"><span class="grow">Rated ${i + 1}</span><b>${n}</b></div>`).join('')}`
        : rs.filter((r) => r.answers?.[q.id]).slice(0, 30).map((r) => `<div class="row"><span class="grow">${para(r.answers[q.id])}<small>${tagList(r.tags?.[q.id])}</small></span>
          ${build() ? `<button class="btn small" data-act="surveys-tag" data-id="${r.id}" data-q="${q.id}">Tag</button>` : ''}</div>`).join('') || '<p class="empty">No answers.</p>'}</section>`).join('')}
    <section class="card"><h3>Theme tags</h3>${freqHtml(tagFrequency(rs, []))}</section>
    ${has('ed', 'lead') && ag.questions.some((q) => q.contact && q.texts?.length) ? `<section class="card"><h3>Contact requests</h3><p class="muted">Only people who chose to share contact info.</p>
      ${ag.questions.filter((q) => q.contact).flatMap((q) => q.texts).map((t) => `<div class="row"><span class="grow">${esc(t)}</span></div>`).join('')}</section>` : ''}
    <section class="card"><div class="head"><h3>Findings &amp; community review</h3>${build() ? `<button class="btn small" data-act="surveys-finding" data-id="${s.id}">+ Finding</button>` : ''}</div>
      ${(s.findings || []).map((f) => `<div class="row" style="align-items:flex-start"><span class="grow">${para(f.text)}
        ${(f.comments || []).map((c) => `<small>💬 ${esc(c.text)} — ${esc(store.userName(c.by))}, ${fmtDate(c.date)}</small>`).join('')}</span>
        <span style="text-align:right"><span class="pill ${f.status === 'final' ? 'approved' : f.status === 'review' ? 'pending' : ''}">${FINDING_LABEL[f.status]}</span><br>
        <button class="btn small ghost" data-act="surveys-comment" data-id="${s.id}" data-f="${f.id}">Comment</button>
        ${build() && f.status !== 'final' ? `<button class="btn small" data-act="surveys-advance" data-id="${s.id}" data-f="${f.id}">${f.status === 'draft' ? 'Send to review' : 'Mark final'}</button>` : ''}</span></div>`).join('') || '<p class="empty">No findings yet.</p>'}</section>
    <button class="btn" data-act="surveys-csv" data-id="${s.id}">Export responses (CSV)</button>`;
}

function manageView(s) {
  if (!s) return '<p class="empty">Not found.</p>';
  const n = responses().filter((r) => r.surveyId === s.id).length;
  return `<a class="back" href="#/f/surveys">‹ Surveys</a><div class="head"><h1>${esc(s.title)}</h1><span class="pill ${pillCls[s.status]}">${s.status}</span></div>
    <p>${para(s.intro || '')}</p><p class="muted">${n} response(s)</p>
    ${s.status === 'open' ? `<a class="btn primary" href="#/f/surveys/take/${s.id}">Take survey (kiosk)</a>` : ''}
    ${review() && n ? `<a class="btn" href="#/f/surveys/results/${s.id}">Results</a>` : ''}
    ${build() && STATUS_NEXT[s.status] ? `<button class="btn" data-act="surveys-status" data-id="${s.id}">${s.status === 'draft' ? 'Open for responses' : 'Close survey'}</button>` : ''}
    <section class="card"><div class="head"><h3>Questions</h3>${build() && s.status === 'draft' ? `<button class="btn small" data-act="surveys-question" data-id="${s.id}">+ Question</button>` : ''}</div>
      ${s.questions.map((q, i) => `<div class="row"><span class="grow">${i + 1}. ${esc(q.text)}<small>${typeLabel(q.type)}${q.contact ? ' · contact me (optional)' : ''}${q.options?.length ? ` · ${q.options.map(esc).join(' / ')}` : ''}</small></span></div>`).join('') || '<p class="empty">No questions yet.</p>'}
      ${s.status !== 'draft' ? '<p class="muted">Questions are locked once a survey is open.</p>' : ''}</section>`;
}

register({
  id: 'surveys', title: 'Surveys & listening', icon: '🗣️', group: 'Community',
  collections: { surveys: [], surveyResponses: [], listeningNotes: [] },
  demo: (iso) => {
    const q = [{ id: 'q1', type: 'single', text: 'What is the biggest need in your neighborhood?', options: ['Housing', 'Food', 'Safe spaces', 'Jobs'] },
      { id: 'q2', type: 'scale', text: 'How safe do you feel getting to services?' },
      { id: 'q3', type: 'multi', text: 'Which supports would you use?', options: ['Rides', 'Mentoring', 'Legal help', 'Financial coaching'] },
      { id: 'q4', type: 'text', text: 'What should we do differently?' },
      { id: 'q5', type: 'text', text: 'Want us to contact you? Leave a phone or email (optional).', contact: true }];
    const mk = (i, a, tags) => ({ id: `sr${i}`, surveyId: 'sv1', date: iso(-i), answers: a, tags });
    return { surveys: [
      { id: 'sv1', title: 'Neighborhood needs check-in (demo)', intro: 'Help us hear what matters most. No names needed.', status: 'open', questions: q,
        findings: [{ id: 'f1', text: 'Housing and transportation come up together: people can reach services only with a ride.', status: 'review', comments: [{ id: 'c1', by: 'u3', date: iso(-1), text: 'Does this match what we heard at the library session?' }] }, { id: 'f2', text: 'Neighbors want more evening hours.', status: 'draft', comments: [] }] },
      { id: 'sv2', title: 'Workshop feedback (draft)', intro: 'Quick feedback after a workshop.', status: 'draft', questions: [{ id: 'q1', type: 'scale', text: 'How useful was today?' }, { id: 'q2', type: 'text', text: 'Anything to add?' }], findings: [] },
    ], surveyResponses: [
      mk(6, { q1: 'Housing', q2: 2, q3: ['Rides', 'Legal help'], q4: 'More evening hours and rides to appointments.' }, { q4: ['transportation', 'hours'] }),
      mk(5, { q1: 'Housing', q2: 3, q3: ['Mentoring'], q4: 'Rent keeps going up; need help finding a place.' }, { q4: ['housing'] }),
      mk(3, { q1: 'Food', q2: 4, q3: ['Financial coaching', 'Rides'], q5: 'demo@example.org' }, {}),
      mk(2, { q1: 'Safe spaces', q2: 3, q3: ['Mentoring', 'Legal help'], q4: 'A place for teens after school.' }, { q4: ['youth', 'safety'] }),
      mk(1, { q1: 'Jobs', q2: 5, q3: ['Financial coaching'], q4: 'Help with resumes.' }, { q4: ['jobs'] }),
    ], listeningNotes: [
      { id: 'ln1', date: iso(-14), place: 'Hilltop Community Center', attendees: 18, notes: 'Neighbors worried about bus route changes and winter shelter capacity.', tags: ['transportation', 'housing'], by: 'u4' },
      { id: 'ln2', date: iso(-30), place: 'Tacoma Public Library', attendees: 11, notes: 'Parents asked for youth programming and safe places after school.', tags: ['youth', 'safety'], by: 'u5' },
    ] };
  },

  view(a, b) {
    if (a === 'take') return takeView(get(b));
    if (a === 'results') return resultsView(get(b));
    if (a === 'listening') {
      const list = [...notes()].sort((x, y) => y.date.localeCompare(x.date));
      return `${pageHead('Listening sessions', review() ? '<button class="btn primary" data-act="surveys-note">+ Notes</button>' : '')}${tabNav('listening')}
        ${review() ? `<section class="card"><h3>Theme frequency</h3>${freqHtml(tagFrequency([], notes()))}</section>
        ${list.map((n) => `<section class="card"><h3>${esc(n.place)}</h3><p class="muted">${fmtDate(n.date)} · ${n.attendees} attended</p><p>${para(n.notes)}</p>${tagList(n.tags)}</section>`).join('') || '<p class="empty card">None yet.</p>'}`
          : '<p class="empty card">Listening notes are for staff and board.</p>'}`;
    }
    if (a) return manageView(get(a));
    const open = surveys().filter((s) => s.status === 'open');
    return `${pageHead('Surveys', build() ? '<button class="btn primary" data-act="surveys-new">+ Survey</button>' : '')}${tabNav('surveys')}
      <section class="card"><h3>Take a survey</h3><p class="muted">Kiosk mode: hand the phone to the next person after each submit.</p>
        ${open.map((s) => `<a class="row" href="#/f/surveys/take/${s.id}"><span class="grow">${esc(s.title)}</span><span class="btn small primary">Start</span></a>`).join('') || '<p class="empty">No open surveys.</p>'}</section>
      ${review() ? `<section class="card"><h3>All surveys</h3>${surveys().map((s) => `<a class="row" href="#/f/surveys/${s.id}"><span class="grow">${esc(s.title)}<small>${s.questions.length} questions · ${responses().filter((r) => r.surveyId === s.id).length} responses</small></span><span class="pill ${pillCls[s.status]}">${s.status}</span></a>`).join('') || '<p class="empty">None.</p>'}</section>` : ''}`;
  },

  forms: {
    'surveys-new'() {
      if (!build()) return;
      sheet('New survey', `${field('Title', '<input name="title" required maxlength="80">')}${field('Introduction', '<textarea name="intro" maxlength="400"></textarea>')}`,
        (f) => store.change('Survey created', f.get('title'), (d) => d.surveys.push({ id: store.id('sv'), title: f.get('title').trim(), intro: f.get('intro').trim(), status: 'draft', questions: [], findings: [] })));
    },
    'surveys-question'(el) {
      const s = get(el.dataset.id); if (!s || !build() || s.status !== 'draft') return;
      sheet('Add question', `${field('Question', '<input name="text" required maxlength="160">')}
        ${field('Type', `<select name="type">${options(TYPES)}</select>`)}
        ${field('Choices (one per line, for choice questions)', '<textarea name="opts" maxlength="600"></textarea>')}
        <label class="row check"><input type="checkbox" name="contact"><span class="grow">This is an optional "contact me" question<small>The only place a survey may ask for contact info.</small></span></label>`,
      (f) => {
        const type = f.get('type'), opts = f.get('opts').split('\n').map((x) => x.trim()).filter(Boolean), contact = f.has('contact');
        if (!contact && (type === 'single' || type === 'multi') && opts.length < 2) { toast('Add at least two choices'); return false; }
        const q = { id: store.id('q'), type: contact ? 'text' : type, text: f.get('text').trim() };
        if (!contact && (type === 'single' || type === 'multi')) q.options = opts;
        if (contact) q.contact = true;
        store.change('Survey question added', s.title, () => s.questions.push(q));
      });
    },
    'surveys-tag'(el) {
      const r = responses().find((x) => x.id === el.dataset.id), q = el.dataset.q; if (!r || !build()) return;
      sheet('Theme tags', `${datalist}<p class="muted">${para(r.answers[q])}</p>${field('Tags (comma separated)', `<input name="tags" list="themes" value="${esc((r.tags?.[q] || []).join(', '))}">`)}`,
        (f) => store.change('Response tagged', f.get('tags'), () => { r.tags = { ...(r.tags || {}), [q]: parseTags(f.get('tags')) }; }));
    },
    'surveys-finding'(el) {
      const s = get(el.dataset.id); if (!s || !build()) return;
      sheet('Add finding', field('Finding', '<textarea name="text" required maxlength="500"></textarea>'),
        (f) => store.change('Finding added', s.title, () => (s.findings ||= []).push({ id: store.id('f'), text: f.get('text').trim(), status: 'draft', comments: [] })));
    },
    'surveys-comment'(el) {
      const s = get(el.dataset.id), fi = s?.findings.find((x) => x.id === el.dataset.f); if (!fi || !review()) return;
      sheet('Reviewer comment', field('Comment', '<textarea name="text" required maxlength="400"></textarea>'),
        (f) => store.change('Finding comment', s.title, () => fi.comments.push({ id: store.id('c'), by: store.user.id, date: today(), text: f.get('text').trim() })));
    },
    'surveys-note'() {
      if (!review()) return;
      sheet('Listening session notes', `${datalist}${field('Date', `<input name="date" type="date" value="${today()}" required>`)}${field('Place', '<input name="place" required maxlength="80">')}
        ${field('Attendees (count)', '<input name="attendees" type="number" min="0" required value="0">')}${field('Notes (no names)', '<textarea name="notes" required maxlength="1500"></textarea>')}
        ${field('Theme tags (comma separated)', '<input name="tags" list="themes">')}`,
      (f) => store.change('Listening session logged', f.get('place'), (d) => d.listeningNotes.push({ id: store.id('ln'), date: f.get('date'), place: f.get('place').trim(),
        attendees: Number(f.get('attendees')) || 0, notes: f.get('notes').trim(), tags: parseTags(f.get('tags')), by: store.user.id })));
    },
  },

  actions: {
    'surveys-status'(el) {
      const s = get(el.dataset.id); if (!s || !build() || !STATUS_NEXT[s.status]) return false;
      if (s.status === 'draft' && !s.questions.length) { toast('Add a question first'); return false; }
      store.change(`Survey ${STATUS_NEXT[s.status]}`, s.title, () => { s.status = STATUS_NEXT[s.status]; });
      return true;
    },
    'surveys-submit'(el) {
      const s = get(el.dataset.id), form = $('#survey-form'); if (!s || s.status !== 'open' || !form) return false;
      const fd = new FormData(form), answers = {};
      for (const q of s.questions) {
        const v = cleanAnswer(q, q.type === 'multi' ? fd.getAll(`q_${q.id}`) : fd.get(`q_${q.id}`));
        if (v !== '' && !(Array.isArray(v) && !v.length)) answers[q.id] = v;
      }
      if (!Object.keys(answers).length) { toast('Answer at least one question'); return false; }
      // Anonymous: the response stores no user id and only the date.
      store.change('Survey response submitted', s.title, (d) => d.surveyResponses.push({ id: store.id('sr'), surveyId: s.id, date: today(), answers, tags: {} }), { anonymous: true });
      taken[s.id] = true;
      return true;
    },
    'surveys-next'(el) { delete taken[el.dataset.id]; return true; },
    'surveys-advance'(el) {
      const s = get(el.dataset.id), f = s?.findings.find((x) => x.id === el.dataset.f); if (!f || !build()) return false;
      const next = FINDING_STATUS[FINDING_STATUS.indexOf(f.status) + 1]; if (!next) return false;
      store.change('Finding status', `${FINDING_LABEL[next]}: ${f.text.slice(0, 40)}`, () => { f.status = next; });
      return true;
    },
    'surveys-csv'(el) {
      const s = get(el.dataset.id); if (!s || !review()) return false;
      download(`survey-${s.title.replace(/\W+/g, '-')}-${today()}.csv`, toCSV(responsesCSV(s, responses())), 'text/csv'); return false;
    },
  },
});
