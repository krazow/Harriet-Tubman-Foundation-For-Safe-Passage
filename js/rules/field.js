// Field safety shifts: pure rules.
export const INTERVALS = [15, 30, 60, 90];
export const DUE_SOON_MIN = 5;

export const dueAt = (s) => new Date(s.lastCheckin || s.start).getTime() + Number(s.intervalMin) * 60000;

/** 'ended' | 'overdue' | 'due-soon' (within 5 min of the deadline) | 'ok'. */
export function checkinStatus(s, now = new Date()) {
  if (s.endedAt) return 'ended';
  const left = dueAt(s) - new Date(now).getTime();
  if (left < 0) return 'overdue';
  return left <= DUE_SOON_MIN * 60000 ? 'due-soon' : 'ok';
}

/** Whole seconds until the next check-in (negative when overdue). */
export const secondsLeft = (s, now = new Date()) => Math.round((dueAt(s) - new Date(now).getTime()) / 1000);

export function countdown(sec) {
  const a = Math.abs(sec), m = Math.floor(a / 60), s = a % 60;
  if (sec >= 0) return `${m}:${String(s).padStart(2, '0')}`;
  // Overdue: plain words, so "20 min overdue" can't be misread as a clock time.
  const h = Math.floor(m / 60);
  const words = h ? `${h} h ${m % 60} min` : m ? `${m} min` : `${s} sec`;
  return `${words} overdue`;
}

export const openAlerts = (s) => (s.alerts || []).filter((a) => !a.resolved);
export const activeShifts = (shifts) => shifts.filter((s) => !s.endedAt);
export const overdueShifts = (shifts, now = new Date()) => activeShifts(shifts).filter((s) => checkinStatus(s, now) === 'overdue');

/** Shifts that need attention on Today: overdue or with an unresolved help alert. Ed sees all; others only their own. */
export function attentionShifts(shifts, user, now = new Date()) {
  return activeShifts(shifts).filter((s) => (user.role === 'ed' || s.userId === user.id)
    && (checkinStatus(s, now) === 'overdue' || openAlerts(s).length));
}
