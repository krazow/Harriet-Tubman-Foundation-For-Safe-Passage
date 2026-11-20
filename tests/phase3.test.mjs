import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../js/rules/field.js';
import * as R from '../js/rules/rides.js';
import * as O from '../js/rules/outreach.js';
import * as V from '../js/rules/volunteers.js';
import * as S from '../js/rules/surveys.js';
import * as D from '../js/rules/donors.js';
import * as A from '../js/rules/announcements.js';

const T0 = new Date('2026-07-10T12:00:00Z');
const min = (n) => new Date(T0.getTime() + n * 60000);

// ---- field
test('check-in status: ok, due-soon, overdue, ended', () => {
  const s = { lastCheckin: T0.toISOString(), intervalMin: 30 };
  assert.equal(F.checkinStatus(s, min(10)), 'ok');
  assert.equal(F.checkinStatus(s, min(24)), 'ok');
  assert.equal(F.checkinStatus(s, min(25)), 'due-soon');
  assert.equal(F.checkinStatus(s, min(30)), 'due-soon');
  assert.equal(F.checkinStatus(s, min(31)), 'overdue');
  assert.equal(F.checkinStatus({ ...s, endedAt: 'x' }, min(300)), 'ended');
});
test('check-in works for every interval and falls back to start', () => {
  for (const n of F.INTERVALS) {
    const s = { start: T0.toISOString(), intervalMin: n };
    assert.equal(F.checkinStatus(s, min(n + 1)), 'overdue');
    assert.equal(F.checkinStatus(s, min(1)), 'ok');
  }
  assert.deepEqual(F.INTERVALS, [15, 30, 60, 90]);
});
test('countdown formatting and seconds left', () => {
  const s = { lastCheckin: T0.toISOString(), intervalMin: 15 };
  assert.equal(F.secondsLeft(s, min(10)), 300);
  assert.equal(F.countdown(300), '5:00');
  assert.equal(F.countdown(65), '1:05');
  assert.equal(F.countdown(-90), '1 min overdue');
  assert.equal(F.countdown(-1200), '20 min overdue');
  assert.equal(F.countdown(-3900), '1 h 5 min overdue');
  assert.equal(F.countdown(-30), '30 sec overdue');
});
test('attention shifts: ed sees all, worker only own; help alerts count until resolved', () => {
  const mk = (id, userId, extra = {}) => ({ id, userId, lastCheckin: T0.toISOString(), intervalMin: 30, ...extra });
  const list = [mk('a', 'u5'), mk('b', 'u6'), mk('c', 'u6', { alerts: [{ id: 'x' }] }), mk('d', 'u6', { alerts: [{ id: 'x', resolved: true }] }), mk('e', 'u5', { endedAt: 'z' })];
  const now = min(10);
  assert.deepEqual(F.attentionShifts(list, { id: 'u1', role: 'ed' }, now).map((s) => s.id), ['c']);
  const late = min(45);
  assert.deepEqual(F.attentionShifts(list, { id: 'u1', role: 'ed' }, late).map((s) => s.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(F.attentionShifts(list, { id: 'u5', role: 'outreach' }, late).map((s) => s.id), ['a']);
  assert.equal(F.overdueShifts(list, late).length, 4);
});

// ---- rides
test('ride miles from odometer, typed miles, bad odometer', () => {
  assert.equal(R.rideMiles({ odoStart: 100, odoEnd: 112.5, miles: '' }), 12.5);
  assert.equal(R.rideMiles({ odoStart: '', odoEnd: '', miles: '8.24' }), 8.2);
  assert.equal(R.rideMiles({ odoStart: 200, odoEnd: 100, miles: 5 }), 5);
  assert.equal(R.rideMiles({ odoStart: 0, odoEnd: 10, miles: '' }), 10);
});
test('reimbursement at default rate', () => {
  assert.equal(R.DEFAULT_RATE, 0.76);
  assert.equal(R.reimbursement(100, 0.76), 76);
  assert.equal(R.reimbursement(12.5, 0.76), 9.5);
  assert.equal(R.reimbursement(33.3, 0.76), 25.31);
});
test('monthly summary per driver', () => {
  const rides = [
    { driverId: 'u5', date: '2026-07-02', odoStart: 0, odoEnd: 10, miles: '' },
    { driverId: 'u5', date: '2026-07-20', odoStart: '', odoEnd: '', miles: 5 },
    { driverId: 'u5', date: '2026-06-30', odoStart: '', odoEnd: '', miles: 20 },
    { driverId: 'u6', date: '2026-07-03', odoStart: '', odoEnd: '', miles: 4 },
  ];
  const s = R.monthlySummary(rides, 0.76);
  assert.equal(s.length, 3);
  assert.deepEqual(s[0], { driverId: 'u5', month: '2026-07', miles: 15, rides: 2, amount: 11.4 });
  assert.equal(s[2].month, '2026-06');
});
test('submission groups by program and skips submitted rides', () => {
  const rides = [
    { id: '1', driverId: 'u5', programId: 'p1', miles: 10, odoStart: '', odoEnd: '' },
    { id: '2', driverId: 'u5', programId: 'p1', miles: 5, odoStart: '', odoEnd: '' },
    { id: '3', driverId: 'u5', programId: 'p2', miles: 20, odoStart: '', odoEnd: '', submitted: 'x9' },
    { id: '4', driverId: 'u6', programId: 'p2', miles: 20, odoStart: '', odoEnd: '' },
    { id: '5', driverId: 'u5', programId: 'p3', miles: 0, odoStart: '', odoEnd: '' },
  ];
  const g = R.groupForSubmission(rides, 'u5', 0.76);
  assert.deepEqual(g, [{ programId: 'p1', miles: 15, rideIds: ['1', '2'], amount: 11.4 }]);
});
test('mileage expense has the exact shape the approval rules expect', () => {
  const e = R.mileageExpense({ id: 'x1', date: '2026-07-10', name: 'Sam Ortiz', amount: 11.4, programId: 'p1', driverId: 'u5' });
  assert.deepEqual(e, { id: 'x1', date: '2026-07-10', vendor: 'Mileage reimbursement — Sam Ortiz', amount: 11.4, category: 'Mileage/fuel', programId: 'p1', grantId: null, submittedBy: 'u5', relatedParty: false, approvals: [] });
});
test('ride validation', () => {
  assert.match(R.validateRide({ odoStart: '50', odoEnd: '40', miles: '' }), /Odometer/);
  assert.match(R.validateRide({ odoStart: '', odoEnd: '', miles: '' }), /Enter/);
  assert.equal(R.validateRide({ odoStart: '', odoEnd: '', miles: '3' }), '');
});

// ---- outreach
test('outreach monthly totals and csv', () => {
  const logs = [
    { date: '2026-07-01', place: 'A', people: 10, items: { food: 5, water: 3 }, referrals: 2, notes: 'x, "y"' },
    { date: '2026-07-09', place: 'B', people: 4, items: { food: 1 }, referrals: 0 },
    { date: '2026-06-09', place: 'C', people: 7, items: {}, referrals: 1 },
  ];
  const t = O.monthlyTotals(logs);
  assert.deepEqual(t[0], { month: '2026-07', contacts: 2, people: 14, referrals: 2, items: 9, byItem: { food: 6, water: 3 } });
  assert.equal(t[1].people, 7);
  const rows = O.csvRows(logs);
  assert.equal(rows[0].length, rows[1].length);
  assert.equal(rows[1][0], '2026-06-09');
  assert.equal(rows[2].at(-1), 'x, "y"');
  assert.equal(O.itemLabel('harm'), 'Harm-reduction info');
});

// ---- volunteers
test('volunteer shift hours, slots and signup rules', () => {
  const s = { start: '09:00', end: '12:30', slots: 2, signups: [{ userId: 'a' }] };
  assert.equal(V.shiftHours(s), 3.5);
  assert.equal(V.shiftHours({ start: '12:00', end: '09:00' }), 0);
  assert.equal(V.slotsLeft(s), 1);
  assert.equal(V.canSignUp(s, 'a'), false);
  assert.equal(V.canSignUp(s, 'b'), true);
  assert.equal(V.canSignUp({ ...s, signups: [{ userId: 'a' }, { userId: 'b' }] }, 'c'), false);
});
test('volunteer hours totals by person and month; in-kind value', () => {
  const shifts = [
    { date: '2026-06-10', title: 'a', signups: [{ userId: 'u6', attended: true, hours: 2 }, { userId: 'u4', attended: true, hours: 1.5 }, { userId: 'u5', attended: false, hours: 9 }] },
    { date: '2026-07-02', title: 'b', signups: [{ userId: 'u6', attended: true, hours: 4 }] },
  ];
  assert.equal(V.hoursForUser(shifts, 'u6'), 6);
  assert.equal(V.hoursForUser(shifts, 'u5'), 0);
  const p = V.totalsByPerson(shifts);
  assert.deepEqual(p[0], { userId: 'u6', total: 6, months: { '2026-06': 2, '2026-07': 4 } });
  assert.deepEqual(V.totalsByMonth(shifts), [{ month: '2026-07', hours: 4 }, { month: '2026-06', hours: 3.5 }]);
  assert.equal(V.inKindValue(7.5, 0), null);
  assert.equal(V.inKindValue(7.5, undefined), null);
  assert.equal(V.inKindValue(7.5, 20), 150);
});

// ---- surveys
const survey = { id: 's', questions: [
  { id: 'q1', type: 'single', text: 'Need', options: ['Housing', 'Food'] },
  { id: 'q2', type: 'scale', text: 'Safe' },
  { id: 'q3', type: 'multi', text: 'Use', options: ['Rides', 'Legal'] },
  { id: 'q4', type: 'text', text: 'More' },
  { id: 'q5', type: 'text', text: 'Contact', contact: true },
] };
const resp = [
  { id: 'r1', surveyId: 's', date: '2026-07-01', answers: { q1: 'Housing', q2: 2, q3: ['Rides', 'Legal'], q4: 'rent', q5: 'me@example.org' }, tags: { q4: ['housing', 'cost'] } },
  { id: 'r2', surveyId: 's', date: '2026-07-02', answers: { q1: 'Housing', q2: 5, q3: ['Rides'] }, tags: { q4: ['housing'] } },
  { id: 'r3', surveyId: 's', date: '2026-07-03', answers: { q1: 'Food', q2: 3 }, tags: {} },
  { id: 'rx', surveyId: 'other', date: '2026-07-03', answers: { q1: 'Food' } },
];
test('survey aggregation: counts, averages, texts', () => {
  const a = S.aggregate(survey, resp);
  assert.equal(a.count, 3);
  assert.deepEqual(a.questions[0].counts, { Housing: 2, Food: 1 });
  assert.equal(a.questions[1].average, 3.33);
  assert.deepEqual(a.questions[1].dist, [0, 1, 1, 0, 1]);
  assert.deepEqual(a.questions[2].counts, { Rides: 2, Legal: 1 });
  assert.deepEqual(a.questions[3].texts, ['rent']);
  assert.equal(a.questions[4].contact, true);
  assert.equal(S.aggregate(survey, []).questions[1].average, null);
});
test('tag frequency spans responses and listening notes', () => {
  const f = S.tagFrequency(resp, [{ tags: ['housing', 'youth'] }, { tags: ['youth'] }]);
  assert.deepEqual(f, [{ tag: 'housing', count: 3 }, { tag: 'youth', count: 2 }, { tag: 'cost', count: 1 }]);
  assert.deepEqual(S.parseTags(' #Housing, safety ; housing\nMental Health'), ['housing', 'safety', 'mental-health']);
});
test('answers are cleaned to valid choices', () => {
  assert.deepEqual(S.cleanAnswer(survey.questions[2], ['Rides', 'Bogus']), ['Rides']);
  assert.equal(S.cleanAnswer(survey.questions[0], 'Nope'), '');
  assert.equal(S.cleanAnswer(survey.questions[1], '9'), '');
  assert.equal(S.cleanAnswer(survey.questions[1], '4'), 4);
  assert.equal(S.cleanAnswer(survey.questions[3], '  hi  '), 'hi');
});
test('response CSV is anonymous and leaves out contact-me answers', () => {
  const rows = S.responsesCSV(survey, resp);
  assert.deepEqual(rows[0], ['Date', 'Need', 'Safe', 'Use', 'More']);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[1], ['2026-07-01', 'Housing', '2', 'Rides; Legal', 'rent']);
  assert.ok(!JSON.stringify(rows).includes('me@example.org'));
  assert.ok(!JSON.stringify(rows).includes('r1'));
});
test('survey and finding status flow', () => {
  assert.deepEqual([S.STATUS_NEXT.draft, S.STATUS_NEXT.open, S.STATUS_NEXT.closed], ['open', 'closed', undefined]);
  assert.deepEqual(S.FINDING_STATUS, ['draft', 'review', 'final']);
});

// ---- donors
const gifts = [
  { donorId: 'a', date: '2026-02-01', amount: 100, type: 'check' },
  { donorId: 'a', date: '2026-03-01', amount: 50.5, type: 'online' },
  { donorId: 'b', date: '2026-04-01', amount: 0, type: 'in-kind' },
  { donorId: 'b', date: '2026-04-02', amount: 999, type: 'in-kind' },
  { donorId: 'c', date: '2025-12-31', amount: 70, type: 'cash' },
];
test('donor totals ignore in-kind value and filter by year', () => {
  assert.deepEqual(D.donorTotals(gifts, 2026), [{ donorId: 'a', total: 150.5, count: 2, inKind: 0 }, { donorId: 'b', total: 0, count: 2, inKind: 2 }]);
  assert.equal(D.grandTotal(gifts, 2026), 150.5);
  assert.equal(D.grandTotal(gifts), 220.5);
  assert.deepEqual(D.giftYears(gifts), ['2026', '2025']);
});
test('IRS acknowledgment wording', () => {
  assert.match(D.acknowledgment({ type: 'cash' }), /No goods or services were provided/);
  const k = D.acknowledgment({ type: 'in-kind', description: '4 tables' });
  assert.match(k, /4 tables/);
  assert.match(k, /No goods or services were provided/);
  assert.match(k, /not stated a value/);
  assert.doesNotMatch(k, /\$/);
  assert.equal(D.designationText({ designation: 'general' }), 'General support');
  assert.equal(D.designationText({ designation: 'program:p1' }, 'Healing Arts'), 'Healing Arts');
});
test('prospects due within 14 days (researching only) and pipeline totals', () => {
  const now = new Date('2026-07-10T09:00:00');
  const ps = [
    { id: 1, stage: 'researching', deadline: '2026-07-12', ask: 100 },
    { id: 2, stage: 'researching', deadline: '2026-07-24', ask: 200 },
    { id: 3, stage: 'researching', deadline: '2026-07-25', ask: 300 },
    { id: 4, stage: 'applied', deadline: '2026-07-11', ask: 400 },
    { id: 5, stage: 'researching', deadline: '2026-07-01', ask: 50 },
    { id: 6, stage: 'researching', deadline: '', ask: 1 },
  ];
  assert.deepEqual(D.dueProspects(ps, now).map((p) => [p.id, p.days]), [[5, -9], [1, 2], [2, 14]]);
  const t = D.pipelineTotals(ps);
  assert.deepEqual(t.researching, { count: 5, ask: 651 });
  assert.deepEqual(t.applied, { count: 1, ask: 400 });
  assert.deepEqual(t.awarded, { count: 0, ask: 0 });
});

// ---- announcements
test('announcement audience, unread and ordering', () => {
  const ed = { id: 'u1', role: 'ed' }, vol = { id: 'u6', role: 'volunteer' }, board = { id: 'u3', role: 'board' };
  const list = [
    { id: '1', date: '2026-07-01', audience: ['everyone'], readBy: [], authorId: 'u1' },
    { id: '2', date: '2026-07-02', audience: ['board'], readBy: [], authorId: 'u1' },
    { id: '3', date: '2026-06-01', audience: ['volunteer', 'lead'], readBy: ['u6'], authorId: 'u4', pinned: true },
    { id: '4', date: '2026-07-05', audience: [], readBy: [], authorId: 'u1' },
  ];
  assert.deepEqual(A.feedFor(list, vol).map((a) => a.id), ['3', '4', '1']);
  assert.deepEqual(A.unreadFor(list, vol).map((a) => a.id), ['4', '1']);
  assert.deepEqual(A.unreadFor(list, board).map((a) => a.id), ['4', '2', '1']);
  assert.equal(A.isUnread(list[1], vol), false);
  assert.equal(A.visibleTo(list[1], ed), true); // author sees own post
  assert.equal(A.canPost(vol), false);
  assert.equal(A.canPost(board), true);
  assert.equal(A.canManage(list[2], { id: 'u4', role: 'lead' }), true);
  assert.equal(A.canManage(list[2], { id: 'u3', role: 'board' }), false);
});
