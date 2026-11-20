// Feature modules plug into the app through this registry.
//
// A feature is an object:
// {
//   id: 'board',                     // route: #/f/board/<a>/<b>
//   title: 'Board', icon: '🏛️',       // shown on the More hub
//   group: 'People' | 'Operations' | 'Money' | 'Community' | 'Admin',
//   roles: ['ed','board'],           // who sees it on the More hub (omit = everyone)
//   openViews: ['kiosk'],            // optional: sub-pages any signed-in role may open despite `roles`
//   collections: { meetings: [] },   // data collections it owns (added to existing saved data if missing)
//   demo: (iso) => ({ meetings: [...] }),  // fictional demo records; iso(offsetDays) -> 'YYYY-MM-DD'
//   view: (a, b) => html,            // page for #/f/<id>/<a>/<b>
//   forms: { 'board-add-meeting': (el) => sheet(...) },     // data-act handlers that open a form
//   actions: { 'board-vote': (el) => true },                // data-act click handlers; return true to re-render
//   changes: { 'board-attend': (el) => true },              // data-act change handlers (checkbox/select)
//   today: () => html,               // optional card(s) on the Today screen ('' for none)
//   settings: { mileageRate: 0.76 }, // optional default settings (store.data.settings)
// }
//
// All data changes must go through store.change(action, detail, fn) for the audit log.
// All user text must be escaped with esc() from ui.js.
// data-act names must be prefixed with the feature id to avoid clashes.

export const features = [];
export const register = (f) => { features.push(f); return f; };
export const feature = (id) => features.find((f) => f.id === id);
