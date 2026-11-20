// Travel request approval rules.
// - Nobody approves their own request.
// - Standard: ED (Treasurer if the traveler is the ED).
// - First class / charter, or an ED / board-level traveler: Board approval + Treasurer, with written justification.
//   "Board-level" = ED, board members and the Treasurer. If the traveler holds a required role, another person fills it
//   (Treasurer slot -> ED when the Treasurer travels).
export const TRAVEL_CLASSES = { economy: 'Economy', premium: 'Premium economy', first: 'First class', charter: 'Charter' };
const BOARD_LEVEL = ['ed', 'board', 'treasurer'];

export const needsBoard = (req, travelerRole) => ['first', 'charter'].includes(req.travelClass) || BOARD_LEVEL.includes(travelerRole);
export const needsJustification = needsBoard;

export function requiredApprovals(req, travelerRole) {
  if (!needsBoard(req, travelerRole)) return [['ed']];
  return [['board'], [travelerRole === 'treasurer' ? 'ed' : 'treasurer']];
}

export function openSlots(req, users) {
  const role = users.find((u) => u.id === req.travelerId)?.role;
  const slots = requiredApprovals(req, role).map((roles) => ({ roles, filled: false }));
  for (const a of req.approvals || []) {
    const u = users.find((x) => x.id === a.userId);
    const s = u && slots.find((x) => !x.filled && x.roles.includes(u.role));
    if (s) s.filled = true;
  }
  return slots.filter((s) => !s.filled).map((s) => s.roles);
}

export function travelStatus(req, users) {
  if (req.rejected) return 'rejected';
  return openSlots(req, users).length ? 'pending' : 'approved';
}

export function canApproveTravel(req, user, users) {
  if (!user || req.rejected || req.travelerId === user.id) return false;
  if ((req.approvals || []).some((a) => a.userId === user.id)) return false;
  return openSlots(req, users).some((r) => r.includes(user.role));
}

export function validateRequest(req, travelerRole) {
  const errs = [];
  if (needsJustification(req, travelerRole) && !(req.justification || '').trim()) errs.push('A written justification is required.');
  if (req.start && req.end && req.end < req.start) errs.push('Return date is before departure.');
  return errs;
}
