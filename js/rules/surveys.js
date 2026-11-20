// Surveys and listening sessions: pure aggregation.
export const TYPES = [['text', 'Open text'], ['single', 'Single choice'], ['multi', 'Multiple choice'], ['scale', 'Scale 1–5']];
export const STATUS_NEXT = { draft: 'open', open: 'closed' };
export const FINDING_STATUS = ['draft', 'review', 'final'];
export const FINDING_LABEL = { draft: 'Draft', review: 'In community review', final: 'Final' };

export const normTag = (t) => String(t).trim().toLowerCase().replace(/\s+/g, '-').replace(/^#/, '');
export const parseTags = (s) => [...new Set(String(s || '').split(/[,;\n]/).map(normTag).filter(Boolean))];

/** Per-question results. Contact-me answers are kept out of the anonymous results. */
export function aggregate(survey, responses) {
  const rs = responses.filter((r) => r.surveyId === survey.id);
  return {
    count: rs.length,
    questions: survey.questions.map((q) => {
      const vals = rs.map((r) => r.answers?.[q.id]).filter((v) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length));
      const out = { id: q.id, text: q.text, type: q.type, answered: vals.length, contact: !!q.contact };
      if (q.type === 'single' || q.type === 'multi') {
        out.counts = Object.fromEntries((q.options || []).map((o) => [o, 0]));
        for (const v of vals) for (const o of [].concat(v)) if (o in out.counts) out.counts[o] += 1;
      } else if (q.type === 'scale') {
        const nums = vals.map(Number).filter((n) => n >= 1 && n <= 5);
        out.dist = [1, 2, 3, 4, 5].map((n) => nums.filter((x) => x === n).length);
        out.average = nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : null;
      } else out.texts = vals.map(String);
      return out;
    }),
  };
}

/** Frequency of theme tags across tagged responses (r.tags = {qid: [tags]}) and listening notes (n.tags = [tags]). */
export function tagFrequency(responses = [], notes = []) {
  const f = {};
  for (const r of responses) for (const list of Object.values(r.tags || {})) for (const t of list) f[t] = (f[t] || 0) + 1;
  for (const n of notes) for (const t of n.tags || []) f[t] = (f[t] || 0) + 1;
  return Object.entries(f).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count }));
}

/** Clean one submitted answer to the shape the question expects; '' when empty/invalid. */
export function cleanAnswer(q, raw) {
  if (q.type === 'multi') return [].concat(raw || []).filter((o) => (q.options || []).includes(o));
  if (q.type === 'single') return (q.options || []).includes(raw) ? raw : '';
  if (q.type === 'scale') { const n = Number(raw); return n >= 1 && n <= 5 ? n : ''; }
  return String(raw || '').trim().slice(0, 1000);
}

/** Anonymous CSV rows: no response id, no names; contact-me questions excluded. */
export function responsesCSV(survey, responses) {
  const qs = survey.questions.filter((q) => !q.contact);
  return [['Date', ...qs.map((q) => q.text)], ...responses.filter((r) => r.surveyId === survey.id)
    .map((r) => [r.date, ...qs.map((q) => [].concat(r.answers?.[q.id] ?? '').join('; '))])];
}
