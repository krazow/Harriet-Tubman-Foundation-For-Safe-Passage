// Checks that the PWA shell is complete: manifest, icons, and every cached file exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

test('manifest is valid and its icons exist', () => {
  const m = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  for (const i of m.icons) assert.ok(existsSync(join(root, i.src)), i.src);
});

test('every file the service worker caches exists', () => {
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  const list = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  for (const f of list) if (f !== './') assert.ok(existsSync(join(root, f)), f);
});

test('every JavaScript module is cached for offline use', () => {
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.js') ? [`${dir}/${e.name}`] : []));
  for (const f of walk('js')) assert.ok(sw.includes(`'./${f}'`), `${f} missing from sw.js SHELL`);
});

test('service worker only deletes its own caches (shared krazow.github.io origin)', () => {
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE_PREFIX = 'safepassage-'/);
  assert.match(sw, /k\.startsWith\(CACHE_PREFIX\) && k !== VERSION/);
});

test('VERSION, app, service worker and package versions match', () => {
  const pkg = readFileSync(join(root, 'VERSION'), 'utf8').trim();
  assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, pkg);
  assert.match(readFileSync(join(root, 'js/app.js'), 'utf8'), new RegExp(`VERSION = '${pkg}'`));
  assert.match(readFileSync(join(root, 'sw.js'), 'utf8'), new RegExp(`CACHE_PREFIX \\+ '${pkg}'`));
});

test('More page links to the walkthrough video in a new tab', () => {
  const app = readFileSync(join(root, 'js/app.js'), 'utf8');
  assert.match(app, /WALKTHROUGH_URL = 'https:\/\/youtu\.be\/SRzzh3QiTi8'/);
  assert.match(app, /href="\$\{WALKTHROUGH_URL\}" target="_blank" rel="noopener"/);
});
