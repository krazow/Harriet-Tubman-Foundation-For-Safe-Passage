// Fictional demo data. Every name here is invented — no real people or records.

function iso(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export const DEMO_USERS = [
  { id: 'u1', name: 'Avery Johnson', role: 'ed' },
  { id: 'u2', name: 'Morgan Lee', role: 'treasurer' },
  { id: 'u3', name: 'Jordan Price', role: 'board' },
  { id: 'u4', name: 'Riley Carter', role: 'lead' },
  { id: 'u5', name: 'Sam Ortiz', role: 'outreach' },
  { id: 'u6', name: 'Casey Nguyen', role: 'volunteer' },
];

export function demoData() {
  return {
    users: DEMO_USERS,
    programs: [
      { id: 'p1', name: 'Healing Arts', color: '#b5652b' },
      { id: 'p2', name: 'Mentorship', color: '#2f6f5e' },
      { id: 'p3', name: 'Financial Empowerment', color: '#3a5a8c' },
      { id: 'p4', name: 'Advocacy', color: '#7a3d6b' },
      { id: 'p5', name: 'Housing Support', color: '#6b6b2f' },
    ],
    participants: [
      { id: 'c1', name: 'Dana Brooks', needs: ['housing', 'employment'], consent: true, leadId: 'u4', created: iso(-40),
        goals: [{ id: 'g1', text: 'Complete rental application', done: true }, { id: 'g2', text: 'Start job training', done: false }],
        notes: [{ id: 'n1', by: 'u4', date: iso(-10), text: 'Toured transitional unit; wants to move in by next month.' }] },
      { id: 'c2', name: 'Marcus Hill', needs: ['financial'], consent: true, leadId: 'u4', created: iso(-25),
        goals: [{ id: 'g3', text: 'Open a checking account', done: false }], notes: [] },
      { id: 'c3', name: 'Tasha Green', needs: ['healing', 'legal'], consent: true, leadId: 'u1', created: iso(-12),
        goals: [], notes: [] },
      { id: 'c4', name: 'Leon Wright', needs: ['employment', 'mentorship'], consent: false, leadId: 'u4', created: iso(-3),
        goals: [], notes: [] },
    ],
    sessions: [
      { id: 's1', programId: 'p1', date: iso(-6), hours: 2, attendees: ['c1', 'c3'], note: 'Mural planning' },
      { id: 's2', programId: 'p3', date: iso(-4), hours: 1.5, attendees: ['c2'], note: 'Budget basics' },
      { id: 's3', programId: 'p2', date: iso(-2), hours: 1, attendees: ['c4', 'c1'], note: 'First match meeting' },
      { id: 's4', programId: 'p1', date: iso(1), hours: 2, attendees: [], note: 'Painting session' },
    ],
    events: [
      { id: 'e1', name: 'Community Listening Session', date: iso(3), place: 'Hilltop Community Center', checkins: 0 },
      { id: 'e2', name: 'Know Your Rights Workshop', date: iso(-8), place: 'Tacoma Public Library', checkins: 37 },
    ],
    grants: [
      { id: 'gr1', name: 'General Operating Support', funder: 'Northwest Community Fund (demo)', amount: 50000,
        start: iso(-120), end: iso(245),
        deadlines: [{ id: 'd1', label: 'Mid-year report', date: iso(9), done: false }, { id: 'd2', label: 'Final report', date: iso(260), done: false }] },
      { id: 'gr2', name: 'Financial Coaching Pilot', funder: 'State Reinvestment Program (demo)', amount: 25000,
        start: iso(-60), end: iso(120),
        deadlines: [{ id: 'd3', label: 'Quarterly data upload', date: iso(4), done: false }] },
    ],
    expenses: [
      { id: 'x1', date: iso(-5), vendor: 'Art Supply Co.', amount: 186.4, category: 'Supplies', programId: 'p1', grantId: 'gr1',
        submittedBy: 'u4', relatedParty: false, approvals: [{ userId: 'u2', date: iso(-4) }] },
      { id: 'x2', date: iso(-3), vendor: 'Hall rental', amount: 750, category: 'Facilities', programId: 'p4', grantId: 'gr1',
        submittedBy: 'u1', relatedParty: false, approvals: [{ userId: 'u2', date: iso(-2) }] },
      { id: 'x3', date: iso(-1), vendor: 'Price Catering LLC', amount: 420, category: 'Food', programId: 'p4', grantId: 'gr1',
        submittedBy: 'u5', relatedParty: true, approvals: [] },
      { id: 'x4', date: iso(-1), vendor: 'Gas — outreach van', amount: 64.12, category: 'Mileage/fuel', programId: 'p5', grantId: 'gr2',
        submittedBy: 'u5', relatedParty: false, approvals: [] },
    ],
    tasks: [
      { id: 't1', text: 'Confirm venue for listening session', ownerId: 'u1', due: iso(1), done: false },
      { id: 't2', text: 'Collect receipts from last week', ownerId: 'u2', due: iso(2), done: false },
      { id: 't3', text: 'Follow up with Dana on housing paperwork', ownerId: 'u4', due: iso(0), done: false },
    ],
    audit: [],
  };
}
