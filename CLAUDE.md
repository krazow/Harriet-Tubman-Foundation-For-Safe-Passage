# Project rules — Safe Passage Ops

- Zero-dependency PWA: plain ES modules, no bundler. Keep it that way unless a build step is clearly needed.
- Business rules live in `js/rules.js` as pure functions with tests in `tests/`. Add a test for every rule change.
- All data changes go through `store.change(action, detail, fn)` so they reach the audit log.
- Escape all user text with `esc()` before inserting it into HTML.
- Demo data (`js/demo-data.js`) must be fictional. Never use real people's names or records.
- Never store Social Security numbers. Never commit signing keys (`*.p12`, `*.jks`); CI blocks them.
- When versioning, bump `package.json`, `VERSION` in `js/app.js` and the cache name in `sw.js` together.
- Workflow: feature branch → PR → CI must pass → Claude merges (squash). Pushes to `main` deploy to GitHub Pages.
- Targets: PWA now; Windows installer (Electron) and Android APK (Capacitor) later. Android signing secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
