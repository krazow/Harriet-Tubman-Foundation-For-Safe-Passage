// Board meeting rules: voting members, quorum, motion results.
export const VOTING_ROLES = ['board', 'ed', 'treasurer'];

export const defaultVoting = (users) => users.filter((u) => VOTING_ROLES.includes(u.role)).map((u) => u.id);

/** Quorum is MORE than `fraction` of voting members (0.5 = a majority). */
export function quorumNeeded(votingCount, fraction = 0.5) {
  if (votingCount <= 0) return 0;
  return Math.floor(votingCount * fraction) + 1;
}

/** Voting members who are present. Attendance by non-voting people never counts. */
export function presentVoting(meeting) {
  const voting = new Set(meeting.voting || []);
  return (meeting.attendance || []).filter((id) => voting.has(id));
}

export function quorumStatus(meeting, fraction = 0.5) {
  const voting = (meeting.voting || []).length;
  const present = presentVoting(meeting).length;
  const needed = quorumNeeded(voting, fraction);
  return { voting, present, needed, met: voting > 0 && present >= needed };
}

/** Tally only votes cast by voting members who are present. Passes if quorum is met and yes > no. */
export function motionResult(meeting, motion, fraction = 0.5) {
  const ok = new Set(presentVoting(meeting));
  const t = { yes: 0, no: 0, abstain: 0 };
  for (const [uid, v] of Object.entries(motion.votes || {})) if (ok.has(uid) && v in t) t[v]++;
  const q = quorumStatus(meeting, fraction);
  const cast = t.yes + t.no + t.abstain;
  const result = !q.met ? 'no quorum' : cast === 0 ? 'open' : t.yes > t.no ? 'passed' : 'failed';
  return { ...t, quorum: q.met, result };
}
