import { register } from './registry.js';
import { store } from '../store.js';
import { esc, today, fmtDate, D, toast, sheet, field, options, empty, download } from '../ui.js';
import { files } from '../files.js';
import { daysUntil } from '../rules.js';
import { DOC_CATEGORIES, expiringDocs } from '../rules/documents.js';
import { todayCard, duePill, dueClass } from './p2util.js';

let cat = '';
const isEd = () => store.user.role === 'ed';

function addForm() {
  sheet('Add document', `
    ${field('File', '<input type="file" name="file" required>')}
    ${field('Title', '<input name="title" required maxlength="100">')}
    ${field('Category', `<select name="category">${options(DOC_CATEGORIES.map((c) => [c, c]))}</select>`)}
    ${field('Document date', `<input name="date" type="date" value="${today()}" required>`)}
    ${field('Expires (optional)', '<input name="expires" type="date">')}`,
  async (f, fm) => {
    if (!fm.reportValidity()) return false;
    const file = f.get('file');
    if (!file || !file.size) { toast('Choose a file'); return false; }
    const fileId = await files.put(store.meta.workspace, file);
    store.change('Document added', f.get('title'), (d) => d.documents.push({
      id: store.id('doc'), title: f.get('title').trim(), category: f.get('category'), date: f.get('date'), expires: f.get('expires') || '',
      fileId, fileName: file.name, size: file.size, addedBy: store.user.id }));
    toast('Document saved');
  });
}

register({
  id: 'documents', title: 'Documents', icon: '🗂️', group: 'Admin', roles: ['ed', 'treasurer', 'board'],
  collections: { documents: [] },
  demo: (iso) => ({ documents: [
    { id: 'doc1', title: 'Bylaws (adopted)', category: 'Bylaws', date: iso(-400), expires: '', fileId: null, fileName: 'bylaws-demo.pdf', addedBy: 'u1' },
    { id: 'doc2', title: 'Conflict of interest policy', category: 'Policies', date: iso(-300), expires: '', fileId: null, fileName: 'coi-policy-demo.pdf', addedBy: 'u1' },
    { id: 'doc3', title: 'General liability insurance policy', category: 'Insurance', date: iso(-340), expires: iso(24), fileId: null, fileName: 'liability-demo.pdf', addedBy: 'u2' },
    { id: 'doc4', title: 'Form 990 (prior year)', category: 'Tax filings', date: iso(-190), expires: '', fileId: null, fileName: 'form-990-demo.pdf', addedBy: 'u2' },
    { id: 'doc5', title: 'Fiscal sponsor agreement (demo)', category: 'Contracts', date: iso(-200), expires: iso(160), fileId: null, fileName: 'sponsor-demo.pdf', addedBy: 'u1' },
    { id: 'doc6', title: 'Northwest Community Fund award letter', category: 'Grants', date: iso(-120), expires: '', fileId: null, fileName: 'award-demo.pdf', addedBy: 'u1' },
  ] }),
  view() {
    const list = D().documents.filter((d) => !cat || d.category === cat).sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="head"><h1>Documents</h1><button class="btn primary" data-act="documents-add">+ Document</button></div>
      <section class="card">${field('Category', `<select data-act="documents-filter">${options([['', 'All categories'], ...DOC_CATEGORIES.map((c) => [c, c])], cat)}</select>`)}</section>
      <section class="card">${list.map((d) => { const n = d.expires ? daysUntil(d.expires) : null;
        return `<div class="row"><span class="grow">${esc(d.title)}<small>${esc(d.category)} · ${fmtDate(d.date)}${d.expires ? ` · expires ${fmtDate(d.expires)} (${duePill(n)})` : ''}${d.fileId ? '' : ' · no file attached (demo)'}</small></span>
          <span class="acts">${n !== null && n <= 30 ? `<span class="pill ${dueClass(n)}">${n < 0 ? 'Expired' : 'Expiring'}</span>` : ''}
          ${d.fileId ? `<button class="btn small" data-act="documents-open" data-id="${d.id}">Open</button><button class="btn small ghost" data-act="documents-download" data-id="${d.id}">Save</button>` : ''}
          ${isEd() ? `<button class="btn small ghost" data-act="documents-delete" data-id="${d.id}" aria-label="Delete ${esc(d.title)}">🗑</button>` : ''}</span></div>`; }).join('') || empty('No documents in this category.')}</section>`;
  },
  forms: { 'documents-add': addForm },
  actions: {
    'documents-open': (el) => { const d = D().documents.find((x) => x.id === el.dataset.id); files.open(d.fileId).then((ok) => ok || toast('File not found on this device')); return false; },
    'documents-download': (el) => { const d = D().documents.find((x) => x.id === el.dataset.id);
      files.get(d.fileId).then((r) => (r ? download(d.fileName || d.title, r.blob) : toast('File not found on this device'))); return false; },
    'documents-delete': (el) => {
      if (!isEd()) return false;
      const d = D().documents.find((x) => x.id === el.dataset.id);
      if (!confirm(`Delete "${d.title}"? This cannot be undone.`)) return false;
      if (d.fileId) files.remove(d.fileId);
      store.change('Document deleted', d.title, (data) => { data.documents = data.documents.filter((x) => x.id !== d.id); });
      return true;
    },
  },
  changes: { 'documents-filter': (el) => { cat = el.value; return true; } },
  today() {
    if (store.user.role !== 'ed') return '';
    return todayCard('Documents expiring (30 days)', expiringDocs(D().documents || [], today()).map((d) => ({ t: d.title, sub: d.category, pill: d.days < 0 ? 'Expired' : duePill(d.days), cls: dueClass(d.days) })), '#/f/documents');
  },
});
