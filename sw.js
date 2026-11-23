// Service worker: cache-first app shell so the app opens and works offline.
// Cache names must start with CACHE_PREFIX: every krazow app shares krazow.github.io,
// so this worker only ever deletes its own caches. The release kit stamps VERSION.
const CACHE_PREFIX = 'safepassage-';
const VERSION = CACHE_PREFIX + '0.2.1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js',
  './js/demo-data.js',
  './js/features/announcements.js',
  './js/features/board.js',
  './js/features/calendar.js',
  './js/features/coi.js',
  './js/features/compliance.js',
  './js/features/documents.js',
  './js/features/donors.js',
  './js/features/field.js',
  './js/features/index.js',
  './js/features/intake.js',
  './js/features/outreach.js',
  './js/features/p2util.js',
  './js/features/p3util.js',
  './js/features/quickbooks.js',
  './js/features/referrals.js',
  './js/features/registry.js',
  './js/features/reports.js',
  './js/features/rides.js',
  './js/features/settings.js',
  './js/features/surveys.js',
  './js/features/travel.js',
  './js/features/usage.js',
  './js/features/volunteers.js',
  './js/files.js',
  './js/rules.js',
  './js/rules/announcements.js',
  './js/rules/board.js',
  './js/rules/calendar.js',
  './js/rules/coi.js',
  './js/rules/compliance.js',
  './js/rules/dates.js',
  './js/rules/documents.js',
  './js/rules/donors.js',
  './js/rules/field.js',
  './js/rules/intake.js',
  './js/rules/outreach.js',
  './js/rules/quickbooks.js',
  './js/rules/referrals.js',
  './js/rules/reports.js',
  './js/rules/rides.js',
  './js/rules/surveys.js',
  './js/rules/travel.js',
  './js/rules/usage.js',
  './js/rules/volunteers.js',
  './js/store.js',
  './js/ui.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => (k.startsWith(CACHE_PREFIX) && k !== VERSION) || /^spo-v\d/.test(k)) /* spo-v*: this app's own pre-kit cache names */.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
