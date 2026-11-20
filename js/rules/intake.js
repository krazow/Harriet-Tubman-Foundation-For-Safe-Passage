// Pure intake rules: PIN check, submission cleaning, conversion to a participant.
export const NEEDS = { housing: 'Housing', employment: 'Employment', legal: 'Legal help', financial: 'Financial coaching', healing: 'Healing arts', mentorship: 'Mentorship' };
export const DEFAULT_PIN = '2468';
export const validPin = (s) => /^\d{4}$/.test(String(s ?? ''));
export const checkPin = (input, setting) => String(input ?? '') === (validPin(setting) ? String(setting) : DEFAULT_PIN);

/** Text that looks like a Social Security number or a date of birth: we never store these. */
export const looksSensitive = (s) => /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/.test(String(s)) || /\b(dob|date of birth|ssn|social security)\b/i.test(String(s))
  || /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(String(s));

const clip = (s, n) => String(s ?? '').trim().slice(0, n);
export function cleanSubmission(raw) {
  const s = {
    firstName: clip(raw.firstName, 40), lastName: clip(raw.lastName, 40),
    contactMethod: ['phone', 'text', 'email', 'none'].includes(raw.contactMethod) ? raw.contactMethod : 'none',
    phone: clip(raw.phone, 20), email: clip(raw.email, 80),
    needs: (raw.needs || []).filter((k) => k in NEEDS), language: clip(raw.language, 30) || 'English',
    consent: raw.consent === true, note: clip(raw.note, 300),
  };
  if (!s.firstName) return { error: 'Please tell us your first name.' };
  if (!s.consent) return { error: 'Please check the box to agree.' };
  if ([s.firstName, s.lastName, s.note, s.phone, s.email].some(looksSensitive)) return { error: 'Please do not enter Social Security numbers, birth dates or ID numbers.' };
  return { value: s };
}

export function toParticipant(sub, { id, leadId, today, by, noteId }) {
  const bits = [`Self-intake. Prefers: ${sub.contactMethod}`, sub.phone && `phone ${sub.phone}`, sub.email && `email ${sub.email}`, `language ${sub.language}`, sub.note && `Note: ${sub.note}`].filter(Boolean);
  return { id, name: `${sub.firstName} ${sub.lastName}`.trim(), needs: [...sub.needs], consent: !!sub.consent, leadId, created: today, goals: [],
    notes: [{ id: noteId, by, date: today, text: bits.join('; ') }] };
}
