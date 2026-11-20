// Checks that the PWA shell is complete: manifest, icons, and every cached file exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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

test('app, service worker and package versions match', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  assert.match(readFileSync(join(root, 'js/app.js'), 'utf8'), new RegExp(`VERSION = '${pkg}'`));
  assert.match(readFileSync(join(root, 'sw.js'), 'utf8'), new RegExp(`spo-v${pkg}`));
});
