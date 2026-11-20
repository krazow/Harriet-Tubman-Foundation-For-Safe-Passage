// Announcements: audience and read tracking.
export const visibleTo = (a, user) => !a.audience?.length || a.audience.includes('everyone') || a.audience.includes(user.role) || a.authorId === user.id;
export const isUnread = (a, user) => visibleTo(a, user) && !(a.readBy || []).includes(user.id);
export const unreadFor = (list, user) => sortFeed(list.filter((a) => isUnread(a, user)));
/** Pinned first, then newest. */
export const sortFeed = (list) => [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
export const feedFor = (list, user) => sortFeed(list.filter((a) => visibleTo(a, user)));
export const canPost = (user) => ['ed', 'lead', 'board'].includes(user?.role);
export const canManage = (a, user) => user?.role === 'ed' || a.authorId === user?.id;
