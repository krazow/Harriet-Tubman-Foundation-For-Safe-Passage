import { register } from './registry.js';
import { store } from '../store.js';
import { esc, D, toast, sheet, field, today, fmtDate } from '../ui.js';
import { ROLES } from '../rules.js';
import { visibleTo, isUnread, unreadFor, feedFor, canPost, canManage } from '../rules/announcements.js';
import { pageHead, para, todayCard } from './p3util.js';

const list = () => D().announcements || [];
const audText = (a) => (!a.audience?.length || a.audience.includes('everyone') ? 'Everyone' : a.audience.map((r) => ROLES[r]).join(', '));

// On app open: one local notification for unread announcements (once per announcement per user), only if permission was granted.
setTimeout(() => {
  try {
    if (!store.data || !store.user || !('Notification' in window) || Notification.permission !== 'granted') return;
    const key = `spo:${store.meta.workspace}:ann-notified:${store.user.id}`;
    const seen = JSON.parse(localStorage.getItem(key) || '[]');
    const fresh = unreadFor(list(), store.user).filter((a) => !seen.includes(a.id));
    if (!fresh.length) return;
    new Notification(`${fresh.length} new announcement${fresh.length > 1 ? 's' : ''}`, { body: fresh.slice(0, 3).map((a) => a.title).join(' · ') });
    localStorage.setItem(key, JSON.stringify([...seen, ...fresh.map((a) => a.id)]));
  } catch { /* notifications unsupported */ }
}, 2000);

register({
  id: 'announcements', title: 'Announcements', icon: '📣', group: 'Team',
  collections: { announcements: [] },
  demo: (iso) => ({ announcements: [
    { id: 'an1', title: 'Winter coat drive starts Monday', body: 'Drop-offs at the Foundation office, 10am–4pm. Please sort by size. Volunteers needed Thursday.', authorId: 'u1', date: iso(-2), pinned: true, audience: ['everyone'], readBy: ['u1'] },
    { id: 'an2', title: 'Board packet for next meeting', body: 'The draft budget and the grant pipeline summary are ready for review.', authorId: 'u1', date: iso(-1), pinned: false, audience: ['board', 'treasurer', 'ed'], readBy: ['u1', 'u3'] },
    { id: 'an3', title: 'Field safety reminder', body: 'Start a shift in the app before every outreach walk and check in on time. If you ever feel unsafe, call 911 first.', authorId: 'u4', date: iso(-5), pinned: false, audience: ['outreach', 'volunteer', 'lead'], readBy: ['u4', 'u5'] },
    { id: 'an4', title: 'Thank you, volunteers!', body: 'Last weekend\'s workshop setup went smoothly because of you.', authorId: 'u4', date: iso(-8), pinned: false, audience: ['everyone'], readBy: ['u2', 'u3', 'u4', 'u5', 'u6'] },
  ] }),

  view() {
    const u = store.user, feed = feedFor(list(), u), unread = unreadFor(list(), u).length;
    return `${pageHead('Announcements', canPost(u) ? '<button class="btn primary" data-act="announcements-post">+ Post</button>' : '')}
      <p class="muted">${unread ? `<b>${unread} unread</b> ` : 'All caught up. '}${unread ? '<button class="btn small" data-act="announcements-readall">Mark all read</button>' : ''}</p>
      ${feed.map((a) => `<section class="card" ${isUnread(a, u) ? 'style="border-left:5px solid var(--accent)"' : ''}><div class="head"><h3>${a.pinned ? '📌 ' : ''}${esc(a.title)}</h3>${isUnread(a, u) ? '<span class="pill pending">New</span>' : ''}</div>
        <p class="muted">${esc(store.userName(a.authorId))} · ${fmtDate(a.date)} · For: ${esc(audText(a))}</p><p>${para(a.body)}</p>
        ${isUnread(a, u) ? `<button class="btn small" data-act="announcements-read" data-id="${a.id}">Mark read</button>` : ''}
        ${canManage(a, u) && canPost(u) ? `<button class="btn small ghost" data-act="announcements-pin" data-id="${a.id}">${a.pinned ? 'Unpin' : 'Pin'}</button><button class="btn small ghost" data-act="announcements-del" data-id="${a.id}">Delete</button>` : ''}</section>`).join('') || '<p class="empty card">Nothing posted yet.</p>'}`;
  },

  forms: {
    'announcements-post'() {
      if (!canPost(store.user)) return;
      sheet('Post announcement', `${field('Title', '<input name="title" required maxlength="100">')}${field('Message', '<textarea name="body" required maxlength="1500"></textarea>')}
        <fieldset><legend>Audience</legend><label class="row check"><input type="checkbox" name="aud" value="everyone" checked><span class="grow">Everyone</span></label>
        ${Object.entries(ROLES).map(([k, l]) => `<label class="row check"><input type="checkbox" name="aud" value="${k}"><span class="grow">${esc(l)}</span></label>`).join('')}</fieldset>
        <label class="row check"><input type="checkbox" name="pinned"><span class="grow">Pin to the top</span></label>`,
      (f) => {
        const aud = f.getAll('aud');
        store.change('Announcement posted', f.get('title'), (d) => d.announcements.push({ id: store.id('an'), title: f.get('title').trim(), body: f.get('body').trim(), authorId: store.user.id,
          date: today(), pinned: f.has('pinned'), audience: aud.length ? aud : ['everyone'], readBy: [store.user.id] }));
      });
    },
  },

  actions: {
    'announcements-read'(el) {
      const a = list().find((x) => x.id === el.dataset.id); if (!a) return false;
      store.change('Announcement read', a.title, () => { a.readBy = [...new Set([...(a.readBy || []), store.user.id])]; });
      return true;
    },
    'announcements-readall'() {
      const un = unreadFor(list(), store.user); if (!un.length) return false;
      store.change('Announcements read', `${un.length} marked read`, () => un.forEach((a) => { a.readBy = [...new Set([...(a.readBy || []), store.user.id])]; }));
      return true;
    },
    'announcements-pin'(el) {
      const a = list().find((x) => x.id === el.dataset.id); if (!a || !canManage(a, store.user)) return false;
      store.change(a.pinned ? 'Announcement unpinned' : 'Announcement pinned', a.title, () => { a.pinned = !a.pinned; });
      return true;
    },
    'announcements-del'(el) {
      const a = list().find((x) => x.id === el.dataset.id); if (!a || !canManage(a, store.user)) return false;
      if (!confirm(`Delete "${a.title}"?`)) return false;
      store.change('Announcement deleted', a.title, (d) => { d.announcements = d.announcements.filter((x) => x !== a); });
      return true;
    },
  },

  today() {
    const un = unreadFor(list(), store.user);
    if (!un.length) return '';
    return todayCard(`Unread announcements (${un.length})`, un.map((a) => `<div class="row"><span class="grow">${a.pinned ? '📌 ' : ''}${esc(a.title)}<small>${esc(store.userName(a.authorId))} · ${fmtDate(a.date)}</small></span></div>`), '#/f/announcements', 'Read announcements');
  },
});
