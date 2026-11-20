import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  requiredApprovals, canApprove, expenseStatus, grantSummary, upcomingDeadlines,
  canSeeCaseNotes, programStats, daysUntil, LARGE_EXPENSE,
} from '../js/rules.js';
import { demoData } from '../js/demo-data.js';

const users = [
  { id: 'ed', role: 'ed' }, { id: 'tr', role: 'treasurer' }, { id: 'bd', role: 'board' },
  { id: 'ld', role: 'lead' }, { id: 'vo', role: 'volunteer' },
];
const u = (id) => users.find((x) => x.id === id);
const exp = (o) => ({ id: 'x', amount: 100, submittedBy: 'ld', approvals: [], relatedParty: false, ...o });

test('small expense needs one approval from Treasurer or ED', () => {
  assert.deepEqual(requiredApprovals(exp()), [['treasurer', 'ed']]);
  const e = exp({ approvals: [{ userId: 'ed' }] });
  assert.equal(expenseStatus(e, users), 'approved');
});

test('large expense needs both Treasurer and ED', () => {
  const e = exp({ amount: LARGE_EXPENSE, approvals: [{ userId: 'tr' }] });
  assert.equal(expenseStatus(e, users), 'pending');
  assert.equal(canApprove(e, u('tr'), users), false, 'treasurer already approved');
  assert.equal(canApprove(e, u('ed'), users), true);
  e.approvals.push({ userId: 'ed' });
  assert.equal(expenseStatus(e, users), 'approved');
});

test('nobody approves their own expense', () => {
  const e = exp({ submittedBy: 'tr' });
  assert.equal(canApprove(e, u('tr'), users), false);
  assert.equal(canApprove(e, u('ed'), users), true);
});

test('related-party expense needs Board + Treasurer; ED cannot fill either slot', () => {
  const e = exp({ relatedParty: true });
  assert.equal(canApprove(e, u('ed'), users), false);
  assert.equal(canApprove(e, u('bd'), users), true);
  e.approvals.push({ userId: 'bd' }, { userId: 'tr' });
  assert.equal(expenseStatus(e, users), 'approved');
});

test('large expense submitted by the ED goes to Treasurer + Board', () => {
  const e = exp({ amount: 750, submittedBy: 'ed' });
  assert.deepEqual(requiredApprovals(e, 'ed'), [['treasurer'], ['board']]);
  e.approvals.push({ userId: 'tr' });
  assert.equal(canApprove(e, u('bd'), users), true);
  e.approvals.push({ userId: 'bd' });
  assert.equal(expenseStatus(e, users), 'approved');
});

test('related-party expense submitted by the Treasurer goes to Board + ED', () => {
  const e = exp({ relatedParty: true, submittedBy: 'tr' });
  assert.deepEqual(requiredApprovals(e, 'treasurer'), [['board'], ['ed']]);
  e.approvals.push({ userId: 'bd' }, { userId: 'ed' });
  assert.equal(expenseStatus(e, users), 'approved');
});

test('volunteers and leads cannot approve', () => {
  assert.equal(canApprove(exp({ submittedBy: 'ed' }), u('vo'), users), false);
  assert.equal(canApprove(exp({ submittedBy: 'ed' }), u('ld'), users), false);
});

test('rejected expense is final', () => {
  const e = exp({ rejected: { userId: 'tr' } });
  assert.equal(expenseStatus(e, users), 'rejected');
  assert.equal(canApprove(e, u('ed'), users), false);
});

test('grant summary counts approved spending only', () => {
  const g = { id: 'g', amount: 1000 };
  const list = [
    exp({ grantId: 'g', amount: 200, approvals: [{ userId: 'tr' }] }),
    exp({ grantId: 'g', amount: 50.55 }),
    exp({ grantId: 'other', amount: 999, approvals: [{ userId: 'tr' }] }),
  ];
  assert.deepEqual(grantSummary(g, list, users), { spent: 200, pending: 50.55, remaining: 800, pct: 20, over: false });
});

test('deadlines within 14 days, overdue first, done ones hidden', () => {
  const now = new Date(2026, 10, 20);
  const grants = [{ id: 'g', name: 'G', deadlines: [
    { id: 'a', label: 'soon', date: '2026-11-25' }, { id: 'b', label: 'late', date: '2026-11-18' },
    { id: 'c', label: 'far', date: '2027-01-30' }, { id: 'd', label: 'done', date: '2026-11-21', done: true },
  ] }];
  const out = upcomingDeadlines(grants, now);
  assert.deepEqual(out.map((x) => x.label), ['late', 'soon']);
  assert.equal(daysUntil('2026-11-25', now), 5);
});

test('case notes: ED and assigned lead only', () => {
  const p = { leadId: 'ld' };
  assert.equal(canSeeCaseNotes(u('ed'), p), true);
  assert.equal(canSeeCaseNotes(u('ld'), p), true);
  assert.equal(canSeeCaseNotes(u('tr'), p), false);
  assert.equal(canSeeCaseNotes(u('vo'), p), false);
});

test('program stats count unique people', () => {
  const s = [{ programId: 'p', hours: 2, attendees: ['a', 'b'] }, { programId: 'p', hours: 1.5, attendees: ['a'] }];
  assert.deepEqual(programStats('p', s), { sessions: 2, people: 2, hours: 3.5 });
});

test('demo data is internally consistent', () => {
  const d = demoData();
  const ids = (k) => new Set(d[k].map((x) => x.id));
  const userIds = ids('users');
  for (const e of d.expenses) {
    assert.ok(userIds.has(e.submittedBy));
    assert.ok(!e.grantId || ids('grants').has(e.grantId));
  }
  for (const p of d.participants) assert.ok(userIds.has(p.leadId));
  for (const s of d.sessions) for (const a of s.attendees) assert.ok(ids('participants').has(a));
});
