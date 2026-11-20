// Local data store with two separate workspaces: "demo" (fake data) and "live".
// Live data stays on this device until the backend (Supabase) is connected.
import { demoData, DEMO_USERS } from './demo-data.js';

const KEY = (ws) => `spo:${ws}:data`;
const META = 'spo:meta';

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
    this.data = read(KEY(ws), null) || (ws === 'demo' ? demoData() : emptyLive());
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
    write(KEY('demo'), demoData());
    if (this.isDemo) this.load();
  },

  id(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },

  /** Every change goes through here so it lands in the audit log. */
  change(action, detail, fn) {
    fn(this.data);
    this.data.audit.unshift({ id: this.id('a'), at: new Date().toISOString(), userId: this.meta.userId, action, detail });
    this.data.audit = this.data.audit.slice(0, 500);
    this.save();
  },

  userName(id) { return this.data.users.find((u) => u.id === id)?.name || 'Unknown'; },
  exportJSON() { return JSON.stringify(this.data, null, 2); },
};

export { DEMO_USERS };
