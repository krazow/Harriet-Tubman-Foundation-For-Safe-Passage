// Local data store with two separate workspaces: "demo" (fake data) and "live".
// Live data stays on this device until the backend (Supabase) is connected.
import { demoData, DEMO_USERS } from './demo-data.js';
import { features } from './features/registry.js';

const KEY = (ws) => `spo:${ws}:data`;
const META = 'spo:meta';
// Bump when demo content changes so devices get the new demo records.
const DEMO_VERSION = 3;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function iso(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Full demo dataset: core demo data plus every feature's demo records. */
function fullDemo() {
  const d = demoData();
  for (const f of features) Object.assign(d, f.demo ? f.demo(iso) : {});
  return d;
}

/** Make sure every collection and setting that features need exists (migrates old saved data). */
function ensureSchema(data) {
  data.settings ||= {};
  for (const f of features) {
    for (const [k, v] of Object.entries(f.collections || {})) if (!Array.isArray(data[k])) data[k] = structuredClone(v);
    for (const [k, v] of Object.entries(f.settings || {})) if (!(k in data.settings)) data.settings[k] = v;
  }
  return data;
}

function emptyLive() {
  const d = demoData();
  return {
    users: [{ id: 'u1', name: 'Administrator', role: 'ed' }],
    programs: d.programs,
    participants: [], sessions: [], events: [], grants: [], expenses: [], tasks: [], audit: [],
  };
}

export const store = {
  meta: read(META, { workspace: 'demo', userId: 'u1' }),
  data: null,

  load() {
    const ws = this.meta.workspace;
    let saved = read(KEY(ws), null);
    if (ws === 'demo' && this.meta.demoVersion !== DEMO_VERSION) { saved = null; this.meta.demoVersion = DEMO_VERSION; }
    this.data = ensureSchema(saved || (ws === 'demo' ? fullDemo() : emptyLive()));
    if (!this.data.users.find((u) => u.id === this.meta.userId)) this.meta.userId = this.data.users[0].id;
    this.save();
  },

  save() {
    write(KEY(this.meta.workspace), this.data);
    write(META, this.meta);
  },

  get isDemo() { return this.meta.workspace === 'demo'; },
  get user() { return this.data.users.find((u) => u.id === this.meta.userId); },

  setWorkspace(ws) { this.meta.workspace = ws; this.load(); },
  setUser(id) { this.meta.userId = id; this.save(); },

  resetDemo() {
    write(KEY('demo'), fullDemo());
    if (this.isDemo) this.load();
  },

  id(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },

  /** Every change goes through here so it lands in the audit log. */
  change(action, detail, fn, { anonymous = false } = {}) {
    fn(this.data);
    // anonymous: record that something happened without linking it to the signed-in person (e.g. survey answers).
    this.data.audit.unshift({ id: this.id('a'), at: anonymous ? new Date().toISOString().slice(0, 10) : new Date().toISOString(),
      userId: anonymous ? null : this.meta.userId, action, detail });
    this.data.audit = this.data.audit.slice(0, 500);
    this.save();
  },

  userName(id) { return this.data.users.find((u) => u.id === id)?.name || 'Unknown'; },
  exportJSON() { return JSON.stringify(this.data, null, 2); },
};

export { DEMO_USERS };
