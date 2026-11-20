// Binary file store (documents, photos) in IndexedDB — localStorage is too small for files.
// Records reference files by id; keys are namespaced by workspace so demo and live never mix.
const DB = 'spo-files';
let dbp;
function db() {
  dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('files', mode);
    const out = fn(t.objectStore('files'));
    t.oncomplete = () => res(out?.result);
    t.onerror = () => rej(t.error);
  });
}

export const files = {
  /** Save a File/Blob; returns its id. */
  async put(workspace, blob) {
    const id = `${workspace}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    await tx('readwrite', (s) => s.put({ blob, name: blob.name || 'file', type: blob.type, size: blob.size }, id));
    return id;
  },
  async get(id) { return tx('readonly', (s) => s.get(id)); },
  async remove(id) { return tx('readwrite', (s) => s.delete(id)); },
  /** Open a stored file in a new tab. */
  async open(id) {
    const rec = await this.get(id);
    if (!rec) return false;
    const url = URL.createObjectURL(rec.blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  },
};
