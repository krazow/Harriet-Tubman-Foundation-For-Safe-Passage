# Safe Passage Ops

A mobile operations app (installable PWA) for the **Harriet Tubman Foundation for Safe Passage**, Tacoma, WA.

**Live app:** https://krazow.github.io/Harriet-Tubman-Foundation-For-Safe-Passage/

## What it does (v0.1)

- **Today**: tasks, items waiting for your approval, grant deadlines in the next 14 days, upcoming sessions and events, quick-add buttons
- **People**: participant intake with consent, needs, goals, sessions attended, private case notes (ED + assigned lead only)
- **Programs**: Healing Arts, Mentorship, Financial Empowerment, Advocacy, Housing Support; session logging with attendance; events with check-in counter
- **Money**: expenses with receipt photos, approval rules, grants with budget vs. actual, deadlines and CSV reports
- **More**: switch roles (demo), demo/live workspace, reset demo data, export, team list, activity log

### Approval rules
- Nobody approves their own expense
- Under $500: Treasurer **or** ED
- $500 and up: Treasurer **and** ED
- Related-party (board member, officer, family, or their business): Board **and** Treasurer
- If the submitter holds a required role, someone else stands in: a board member for the Treasurer or ED (or the ED for the Treasurer on related-party items)

## Demo vs. live data

The app ships with a **demo workspace** of fictional people and records for presentations, marked by a yellow "DEMO DATA" banner. The **live workspace** is kept fully separate. Until the secure backend (Supabase with row-level security) is connected, live data is stored only on the device, so **don't enter real participant details yet**.

## Develop

No build step and no dependencies.

```sh
npm start     # serves at http://localhost:8080
npm test      # Node built-in test runner
```

## Release

- Every push to `main` runs CI and deploys to GitHub Pages.
- Bump the version in `package.json`, `js/app.js` (`VERSION`) and `sw.js` (`spo-vX.Y.Z`) together; a test enforces it.
- Planned: Windows installer (Electron) and signed Android APK (Capacitor). Signing secrets live in GitHub Actions secrets, never in the repo.
