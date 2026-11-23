# Changelog

## 0.2.1 (2026-11-22)

### Added
- **Work in progress banner:** a striped banner at the top of every screen, kiosk included, until the app is ready for real use.
- **Watch the walkthrough:** a card at the top of the More page opens the 7-minute YouTube video showing how to use every part of the app.

## 0.2.0 (2026-11-20)

### Added
- **People & governance:** referrals to partner organizations with follow-up reminders; board meetings with agenda, attendance, quorum, motions, recorded votes and printable minutes; yearly conflict-of-interest disclosures; document library with expiry reminders; compliance calendar (Form 990, WA annual report, charity registration, insurance) that rolls forward each year; report builder for any period (CSV or PDF); travel requests with board-level approval rules.
- **Field & community:** field safety shifts with a check-in timer, "Need help" and overdue alerts at the top of Today; ride log and mileage reimbursement at the IRS rate (76¢/mile, editable); outreach log; volunteer shifts, sign-ups and hours; anonymous offline surveys, listening-session notes, theme tags and community review; donors, gifts, thank-you letters, year-end summaries and grant prospects; announcements.
- **Integrations & polish:** QuickBooks Online export files with account mapping; self-intake kiosk with staff PIN; calendar export for Google Calendar; opt-in usage statistics with no personal data; organization settings; large-text mode.
- Browser smoke test that runs on every pull request and release.

### Changed
- Accessibility pass (WCAG 2.1 AA): labelled fields, keyboard focus stays inside forms, stronger colour contrast, larger touch targets, reduced motion.
- Releases now go through the shared Krazow release kit: beta first at `/beta/`, then production.

### Fixed
- The offline cache now only clears this app's own caches, so it can't remove other krazow apps' offline copies.
- Survey answers are no longer linked to the signed-in person in the activity log.

## 0.1.0 (2026-11-20)

### Added
- First version: Today screen, People, Programs and sessions, Events, Expenses with approval rules, Grants with budget vs. actual, demo mode with fictional data, works offline and installs to the home screen.
