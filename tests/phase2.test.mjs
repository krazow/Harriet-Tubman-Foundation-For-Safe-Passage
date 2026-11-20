import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, addYears, diffDays } from '../js/rules/dates.js';
import { followUpsDue, filterReferrals } from '../js/rules/referrals.js';
import { defaultVoting, quorumNeeded, quorumStatus, motionResult } from '../js/rules/board.js';
import { coiStatus, coiMissingFor, isComplete } from '../js/rules/coi.js';
import { form990Due, nextOccurrence, completeItem, dueSoon } from '../js/rules/compliance.js';
import { expiringDocs } from '../js/rules/documents.js';
import { rangePreset, buildReport, reportRows } from '../js/rules/reports.js';
import { requiredApprovals, openSlots, travelStatus, canApproveTravel, needsJustification, validateRequest } from '../js/rules/travel.js';

const users = [
  { id: 'ed', role: 'ed' }, { id: 'tr', role: 'treasurer' }, { id: 'b1', role: 'board' }, { id: 'b2', role: 'board' },
  { id: 'ld', role: 'lead' }, { id: 'vo', role: 'volunteer' },
];

test('date helpers', () => {
  assert.equal(addDays('2026-02-27', 3), '2026-03-02');
  assert.equal(diffDays('2026-03-10', '2026-03-01'), 9);
  assert.equal(addYears('2024-02-29', 1), '2025-02-28');
});

test('referral follow-ups: only sent, due within 3 days or overdue', () => {
  const r = [
    { id: 1, status: 'sent', followUp: '2026-05-01' }, { id: 2, status: 'sent', followUp: '2026-05-04' },
    { id: 3, status: 'sent', followUp: '2026-05-05' }, { id: 4, status: 'connected', followUp: '2026-04-01' }, { id: 5, status: 'sent' },
  ];
  assert.deepEqual(followUpsDue(r, '2026-05-01').map((x) => x.ref.id), [1, 2]);
  assert.equal(followUpsDue(r, '2026-05-01')[1].days, 3);
  assert.equal(filterReferrals([{ status: 'sent', service: 'Legal', partner: 'Legal Aid (demo)' }], { service: 'Legal', q: 'aid' }).length, 1);
  assert.equal(filterReferrals([{ status: 'sent', service: 'Legal', partner: 'X' }], { status: 'declined' }).length, 0);
});

test('quorum is more than half of voting members', () => {
  assert.equal(quorumNeeded(3), 2);
  assert.equal(quorumNeeded(4), 3);
  assert.equal(quorumNeeded(5), 3);
  assert.equal(quorumNeeded(0), 0);
  assert.equal(quorumNeeded(6, 2 / 3), 5);
  assert.deepEqual(defaultVoting(users), ['ed', 'tr', 'b1', 'b2']);
});

test('quorum ignores non-voting attendees', () => {
  const m = { voting: ['ed', 'tr', 'b1'], attendance: ['ed', 'ld', 'vo'] };
  assert.deepEqual(quorumStatus(m), { voting: 3, present: 1, needed: 2, met: false });
  m.attendance.push('b1');
  assert.equal(quorumStatus(m).met, true);
  assert.equal(quorumStatus({ voting: [], attendance: ['ed'] }).met, false);
});

test('motion result: quorum + yes > no', () => {
  const m = { voting: ['ed', 'tr', 'b1', 'b2'], attendance: ['ed', 'tr', 'b1'] };
  const mo = (votes) => ({ votes });
  assert.equal(motionResult(m, mo({ ed: 'yes', tr: 'yes', b1: 'no' })).result, 'passed');
  assert.equal(motionResult(m, mo({ ed: 'yes', tr: 'no', b1: 'abstain' })).result, 'failed'); // tie fails
  assert.equal(motionResult(m, mo({ ed: 'yes', tr: 'abstain', b1: 'abstain' })).result, 'passed');
  assert.equal(motionResult(m, mo({})).result, 'open');
  // absent member's vote is ignored
  const r = motionResult(m, mo({ ed: 'no', b2: 'yes', tr: 'yes', b1: 'yes' }));
  assert.deepEqual([r.yes, r.no], [2, 1]);
  const low = { voting: ['ed', 'tr', 'b1', 'b2'], attendance: ['ed', 'tr'] };
  assert.equal(motionResult(low, mo({ ed: 'yes', tr: 'yes' })).result, 'no quorum');
});

test('COI status: needs signature, date and either no-conflicts or an interest', () => {
  const ok = { userId: 'ed', year: 2026, noConflicts: true, signature: 'A', date: '2026-01-05' };
  assert.equal(isComplete(ok), true);
  assert.equal(isComplete({ ...ok, signature: ' ' }), false);
  assert.equal(isComplete({ userId: 'x', noConflicts: false, interests: [], signature: 'A', date: '2026-01-01' }), false);
  assert.equal(isComplete({ noConflicts: false, interests: [{ org: 'Acme' }], signature: 'A', date: '2026-01-01' }), true);
  const s = coiStatus(users, [ok, { ...ok, userId: 'tr', year: 2025 }], 2026);
  assert.deepEqual(s.map((x) => [x.user.id, x.status]), [['ed', 'filed'], ['tr', 'missing'], ['b1', 'missing'], ['b2', 'missing']]);
  assert.equal(coiMissingFor(users[0], [ok], 2026), false);
  assert.equal(coiMissingFor(users[1], [ok], 2026), true);
  assert.equal(coiMissingFor(users[4], [], 2026), false); // lead not required
});

test('Form 990 due date', () => {
  assert.equal(form990Due(12, 2025), '2026-05-15');
  assert.equal(form990Due(6, 2026), '2026-11-15');
  assert.equal(form990Due(9, 2026), '2027-02-15');
});

test('compliance rollover and due soon', () => {
  assert.equal(nextOccurrence(5, 15, '2026-11-20'), '2027-05-15');
  assert.equal(nextOccurrence(5, 15, '2026-05-15'), '2026-05-15');
  const it = { id: 'c1', title: '990', due: '2026-05-15', recurring: 'yearly', done: false };
  const { item, next } = completeItem(it, '2026-05-01', 'c2');
  assert.equal(item.done, true);
  assert.equal(item.doneDate, '2026-05-01');
  assert.deepEqual([next.id, next.due, next.done, next.title], ['c2', '2027-05-15', false, '990']);
  assert.equal(completeItem({ ...it, recurring: null }, '2026-05-01', 'z').next, null);
  const items = [it, { id: 'a', due: '2026-06-30', done: false }, { id: 'b', due: '2026-04-01', done: false }, { id: 'c', due: '2026-04-01', done: true }];
  assert.deepEqual(dueSoon(items, '2026-05-01', 30).map((x) => x.id), ['b', 'c1']);
});

test('expiring documents', () => {
  const d = [{ id: 1, expires: '2026-05-20' }, { id: 2, expires: '2026-07-01' }, { id: 3 }, { id: 4, expires: '2026-04-01' }];
  assert.deepEqual(expiringDocs(d, '2026-05-01', 30).map((x) => x.id), [4, 1]);
});

test('report range presets', () => {
  assert.deepEqual(rangePreset('lastMonth', '2026-03-15'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(rangePreset('lastMonth', '2026-01-10'), { from: '2025-12-01', to: '2025-12-31' });
  assert.deepEqual(rangePreset('lastQuarter', '2026-05-10'), { from: '2026-01-01', to: '2026-03-31' });
  assert.deepEqual(rangePreset('lastQuarter', '2026-02-10'), { from: '2025-10-01', to: '2025-12-31' });
  assert.deepEqual(rangePreset('ytd', '2026-05-10'), { from: '2026-01-01', to: '2026-05-10' });
});

const data = () => ({
  users, programs: [{ id: 'p1', name: 'Arts' }, { id: 'p2', name: 'Mentor' }], grants: [{ id: 'g1', name: 'Op' }],
  participants: [{ id: 'c1', created: '2026-01-10' }, { id: 'c2', created: '2025-01-10' }],
  sessions: [
    { id: 's1', programId: 'p1', date: '2026-01-05', hours: 2, attendees: ['c1', 'c2'] },
    { id: 's2', programId: 'p1', date: '2026-01-12', hours: 1.5, attendees: ['c1'] },
    { id: 's3', programId: 'p2', date: '2026-01-20', hours: 1, attendees: ['c2'] },
    { id: 's4', programId: 'p2', date: '2026-03-01', hours: 9, attendees: ['c2'] },
  ],
  events: [{ id: 'e1', date: '2026-01-15', checkins: 30 }, { id: 'e2', date: '2026-02-15', checkins: 5 }],
  expenses: [
    { id: 'x1', date: '2026-01-06', amount: 100, category: 'Supplies', programId: 'p1', grantId: 'g1', submittedBy: 'ld', approvals: [{ userId: 'tr' }] },
    { id: 'x2', date: '2026-01-07', amount: 50.5, category: 'Food', programId: 'p2', grantId: null, submittedBy: 'ld', approvals: [{ userId: 'ed' }] },
    { id: 'x3', date: '2026-01-08', amount: 999, category: 'Food', programId: 'p2', submittedBy: 'ld', approvals: [] },
  ],
});

test('report math', () => {
  const r = buildReport(data(), { from: '2026-01-01', to: '2026-01-31' });
  assert.equal(r.peopleServed, 2);
  assert.equal(r.sessions, 3);
  assert.equal(r.hours, 4.5);
  assert.deepEqual(r.programs.map((p) => [p.name, p.people, p.sessions, p.hours]), [['Arts', 2, 2, 3.5], ['Mentor', 1, 1, 1]]);
  assert.deepEqual(r.events, { count: 1, checkins: 30 });
  assert.equal(r.newParticipants, 1);
  assert.equal(r.expenses.total, 150.5); // unapproved x3 excluded
  assert.deepEqual(r.expenses.byGrant.map((x) => x.name), ['Op', 'No grant']);
  assert.equal(r.referrals, null);
  assert.equal(r.volunteer, null);
});

test('report filters by program and grant, referrals and volunteer shifts optional', () => {
  const d = data();
  d.referrals = [{ sent: '2026-01-03' }, { sent: '2026-02-03' }];
  d.volunteerShifts = [{ date: '2026-01-04', hours: 3 }, { start: '2026-01-09T10:00', hours: '2' }, { date: '2026-04-01', hours: 8 }, { weird: true }];
  const r = buildReport(d, { from: '2026-01-01', to: '2026-01-31', programId: 'p2' });
  assert.equal(r.sessions, 1);
  assert.equal(r.expenses.total, 50.5);
  assert.equal(r.referrals, 1);
  assert.deepEqual(r.volunteer, { shifts: 2, hours: 5 });
  assert.equal(buildReport(d, { from: '2026-01-01', to: '2026-01-31', grantId: 'g1' }).expenses.total, 100);
  assert.ok(reportRows(r).length > 10);
});

test('travel: standard request goes to ED, ED traveler to Treasurer', () => {
  assert.deepEqual(requiredApprovals({ travelClass: 'economy' }, 'lead'), [['ed']]);
  assert.deepEqual(requiredApprovals({ travelClass: 'economy' }, 'volunteer'), [['ed']]);
  assert.deepEqual(requiredApprovals({ travelClass: 'economy' }, 'ed'), [['board'], ['treasurer']]); // ED traveling needs board too
});

test('travel: first class, charter, ED or board traveler need Board + Treasurer and justification', () => {
  for (const c of ['first', 'charter']) assert.deepEqual(requiredApprovals({ travelClass: c }, 'lead'), [['board'], ['treasurer']]);
  assert.deepEqual(requiredApprovals({ travelClass: 'economy' }, 'board'), [['board'], ['treasurer']]);
  assert.deepEqual(requiredApprovals({ travelClass: 'first' }, 'treasurer'), [['board'], ['ed']]);
  assert.equal(needsJustification({ travelClass: 'first' }, 'lead'), true);
  assert.equal(needsJustification({ travelClass: 'premium' }, 'lead'), false);
  assert.ok(validateRequest({ travelClass: 'first', justification: ' ' }, 'lead').length);
  assert.equal(validateRequest({ travelClass: 'first', justification: 'Medical need' }, 'lead').length, 0);
  assert.ok(validateRequest({ travelClass: 'economy', start: '2026-05-05', end: '2026-05-01' }, 'lead').length);
});

test('travel: approval flow, never own', () => {
  const r = { id: 't', travelerId: 'ld', travelClass: 'economy', approvals: [] };
  assert.equal(travelStatus(r, users), 'pending');
  assert.equal(canApproveTravel(r, users[0], users), true);
  assert.equal(canApproveTravel(r, users[1], users), false);
  r.approvals.push({ userId: 'ed' });
  assert.equal(travelStatus(r, users), 'approved');
  assert.equal(canApproveTravel(r, users[0], users), false);

  const f = { id: 'f', travelerId: 'b1', travelClass: 'economy', approvals: [] };
  assert.equal(canApproveTravel(f, users[2], users), false); // own
  assert.equal(canApproveTravel(f, users[3], users), true); // other board member
  assert.equal(canApproveTravel(f, users[0], users), false); // ED can't fill board slot
  f.approvals.push({ userId: 'b2' });
  assert.equal(travelStatus(f, users), 'pending');
  assert.deepEqual(openSlots(f, users), [['treasurer']]);
  assert.equal(canApproveTravel(f, users[1], users), true);
  f.approvals.push({ userId: 'tr' });
  assert.equal(travelStatus(f, users), 'approved');
  assert.equal(travelStatus({ ...f, rejected: { userId: 'ed' } }, users), 'rejected');
});
