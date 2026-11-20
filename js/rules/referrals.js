// Referral follow-up rules. Statuses: sent -> connected | no response | declined.
import { diffDays } from './dates.js';

export const REFERRAL_STATUS = { sent: 'Sent', connected: 'Connected', noresponse: 'No response', declined: 'Declined' };
export const SERVICE_TYPES = ['Housing', 'Legal', 'Health / behavioral health', 'Employment', 'Financial', 'Food / basic needs', 'Education', 'Other'];

/** Referrals still awaiting an outcome whose follow-up is overdue or due within `days`. */
export function followUpsDue(referrals, today, days = 3) {
  return referrals
    .filter((r) => r.status === 'sent' && r.followUp)
    .map((r) => ({ ref: r, days: diffDays(r.followUp, today) }))
    .filter((x) => x.days <= days)
    .sort((a, b) => a.days - b.days);
}

export function filterReferrals(list, { status = '', service = '', q = '' } = {}) {
  const t = q.trim().toLowerCase();
  return list.filter((r) => (!status || r.status === status) && (!service || r.service === service) && (!t || (r.partner || '').toLowerCase().includes(t)));
}
