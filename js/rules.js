// Pure business rules. No DOM, no storage — imported by the app and by tests.

export const ROLES = {
  ed: 'Executive Director',
  treasurer: 'Treasurer',
  board: 'Board member',
  lead: 'Program lead',
  outreach: 'Outreach / driver',
  volunteer: 'Volunteer',
};

// Expenses at or above this amount need both the Treasurer and the ED.
export const LARGE_EXPENSE = 500;

/**
 * Approval slots an expense needs. Each slot is a list of roles that can fill it.
 * - Related-party (board member, family, or their business): Board + Treasurer.
 * - Large (>= LARGE_EXPENSE): Treasurer + ED.
 * - Everything else: Treasurer or ED.
 */
export function requiredApprovals(expense, submitterRole) {
  let slots;
  if (expense.relatedParty) slots = [['board'], ['treasurer']];
  else if (Number(expense.amount) >= LARGE_EXPENSE) slots = [['treasurer'], ['ed']];
  else return [['treasurer', 'ed']];
  // Nobody approves their own expense, so when the submitter holds a required
  // role, someone else stands in: a board member for the Treasurer or ED,
  // the ED for the Treasurer on related-party items.
  if (submitterRole === 'treasurer' || submitterRole === 'ed') {
    const stand = expense.relatedParty ? 'ed' : 'board';
    slots = slots.map((s) => (s.length === 1 && s[0] === submitterRole ? [stand] : s));
  }
  return slots;
}

/** Match existing approvals to slots; returns the unfilled slots. */
export function openSlots(expense, users) {
  const submitterRole = users.find((x) => x.id === expense.submittedBy)?.role;
  const slots = requiredApprovals(expense, submitterRole).map((roles) => ({ roles, filled: false }));
  for (const a of expense.approvals || []) {
    const u = users.find((x) => x.id === a.userId);
    if (!u) continue;
    const slot = slots.find((s) => !s.filled && s.roles.includes(u.role));
    if (slot) slot.filled = true;
  }
  return slots.filter((s) => !s.filled).map((s) => s.roles);
}

export function expenseStatus(expense, users) {
  if (expense.rejected) return 'rejected';
  return openSlots(expense, users).length === 0 ? 'approved' : 'pending';
}

/** Can this user approve this expense right now? Nobody approves their own. */
export function canApprove(expense, user, users) {
  if (!user || expense.rejected) return false;
  if (expense.submittedBy === user.id) return false;
  if ((expense.approvals || []).some((a) => a.userId === user.id)) return false;
  return openSlots(expense, users).some((roles) => roles.includes(user.role));
}

/** Spending against a grant counts approved expenses only. */
export function grantSummary(grant, expenses, users) {
  const spent = expenses
    .filter((e) => e.grantId === grant.id && expenseStatus(e, users) === 'approved')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const pending = expenses
    .filter((e) => e.grantId === grant.id && expenseStatus(e, users) === 'pending')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const amount = Number(grant.amount || 0);
  return {
    spent: round2(spent),
    pending: round2(pending),
    remaining: round2(amount - spent),
    pct: amount > 0 ? Math.round((spent / amount) * 100) : 0,
    over: spent > amount,
  };
}

export function daysUntil(dateStr, today = new Date()) {
  const d = new Date(dateStr + 'T00:00:00');
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d - t) / 86400000);
}

/** Grant reports and deliverables due within `days` (overdue included). */
export function upcomingDeadlines(grants, today = new Date(), days = 14) {
  const out = [];
  for (const g of grants) {
    for (const d of g.deadlines || []) {
      if (d.done) continue;
      const n = daysUntil(d.date, today);
      if (n <= days) out.push({ grantId: g.id, grant: g.name, label: d.label, date: d.date, days: n });
    }
  }
  return out.sort((a, b) => a.days - b.days);
}

/** Case notes are visible to the ED and the participant's assigned lead only. */
export function canSeeCaseNotes(user, participant) {
  if (!user) return false;
  return user.role === 'ed' || participant.leadId === user.id;
}

export function canSeeMoney(user) {
  return ['ed', 'treasurer', 'board'].includes(user?.role);
}

/** Unique participants and hours per program from sessions. */
export function programStats(programId, sessions) {
  const list = sessions.filter((s) => s.programId === programId);
  const people = new Set(list.flatMap((s) => s.attendees || []));
  const hours = list.reduce((sum, s) => sum + Number(s.hours || 0), 0);
  return { sessions: list.length, people: people.size, hours: round2(hours) };
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function money(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
