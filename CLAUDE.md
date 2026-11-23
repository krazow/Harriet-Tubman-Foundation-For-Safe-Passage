# Project rules — Safe Passage Ops

- Zero-dependency PWA: plain ES modules, no bundler. Keep it that way unless a build step is clearly needed.
- Business rules live in `js/rules.js` as pure functions with tests in `tests/`. Add a test for every rule change.
- All data changes go through `store.change(action, detail, fn)` so they reach the audit log.
- Escape all user text with `esc()` before inserting it into HTML.
- Demo data (`js/demo-data.js`) must be fictional. Never use real people's names or records.
- Never store Social Security numbers. Never commit signing keys (`*.p12`, `*.jks`); CI blocks them.
- `VERSION` is the version; only `/release now` changes it (it must match `package.json`, `js/app.js` and `sw.js`; a test checks).
- The service worker may only delete caches starting with `CACHE_PREFIX` ('safepassage-'): all krazow apps share krazow.github.io.
- A "Work in Progress" banner (`#wip-banner` in index.html) shows on every screen, kiosk included. Keep it until the owner explicitly asks to remove it.
- Workflow: feature branch → PR → CI must pass → Claude merges (squash). Deploys only happen through `/release now` (beta) and `/release promote` (production) via the krazow release kit.
- Targets: PWA now; Windows installer (Electron) and Android APK (Capacitor) later. Android/Windows builds come from the release kit (enable in `release.json`); signing secrets: `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`.
