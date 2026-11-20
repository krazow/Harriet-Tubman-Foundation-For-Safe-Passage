// Annual conflict-of-interest disclosures for officers and board members.
export const COI_ROLES = ['ed', 'treasurer', 'board'];

export function isComplete(d) {
  if (!d || !d.signature?.trim() || !d.date) return false;
  return !!d.noConflicts || (d.interests || []).some((i) => i.org?.trim());
}

/** One row per officer/board member: filed or missing for the year. */
export function coiStatus(users, disclosures, year) {
  return users.filter((u) => COI_ROLES.includes(u.role)).map((u) => {
    const d = disclosures.filter((x) => x.userId === u.id && Number(x.year) === Number(year) && isComplete(x))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    return { user: u, status: d ? 'filed' : 'missing', disclosure: d || null };
  });
}

export const coiMissingFor = (user, disclosures, year) =>
  COI_ROLES.includes(user?.role) && !disclosures.some((x) => x.userId === user.id && Number(x.year) === Number(year) && isComplete(x));
