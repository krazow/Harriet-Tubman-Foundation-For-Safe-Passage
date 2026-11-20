# Accessibility (WCAG 2.1 AA)

## Checked (automated and by keyboard in Chrome)
- Every form control has a label: `field()` wraps label and input with for/id; the people search has `aria-label`. A script checked each main screen for unlabeled inputs, buttons and links.
- Icon-only buttons have `aria-label` (close, check-in names the event). Decorative emoji in the nav, quick buttons, hub and case-notes heading are `aria-hidden`.
- Navigation: the active tab has `aria-current="page"` (bottom nav and Money tabs); the workspace toggle uses `aria-pressed`. Each route sets a page title.
- Focus: `main` receives focus after each route change; a "Skip to main content" link is first on the page; after a re-render focus returns to the same control where possible.
- Sheets (`sheet`, `infoSheet`): `role="dialog"` and `aria-modal`, the page behind is `inert`, Tab and Shift+Tab stay inside, Escape closes, and focus returns to the opener.
- Colour contrast (text at least 4.5:1) in light and dark mode for ink, muted text, accent text, accent buttons, error text and status pills. `tests/phase4.test.mjs` computes these from `css/app.css`. Accent and muted colours were darkened in light mode; dark mode has its own accent, success and error colours.
- Touch targets are at least 44 by 44 px for buttons, tabs, nav links, icon buttons and hub tiles (measured in the browser).
- `prefers-reduced-motion` turns off transitions, including the toast.
- Large-text mode (Settings or More) raises the base font size to 125%. Kiosk mode uses larger type and targets.

## Remaining
- Real screen-reader testing (VoiceOver, TalkBack, NVDA); focus order and announcements are checked only by script.
- The browser's own validation bubbles are used for required fields; inline error text linked with `aria-describedby` is not built.
- Uncommon text spacing and 200% zoom reflow were not tested on every feature page.
- Pages added by other modules were only spot-checked for labels and target sizes.
- The kiosk PIN prompt is a normal sheet; the staff-exit flow has not been tested with assistive tech.
