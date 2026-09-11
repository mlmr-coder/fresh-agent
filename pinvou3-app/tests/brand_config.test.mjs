import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { brandContentMatches, main as checkBrand } from '../../scripts/sync-brand.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../..');

test('all managed product surfaces match BRAND.json', () => {
  assert.equal(checkBrand(REPO_ROOT, { checkOnly: true }), 0);
});

test('brand synchronization accepts Windows line endings', () => {
  assert.equal(brandContentMatches('Lingo\r\n桌面应用\r\n', 'Lingo\n桌面应用\n'), true);
  assert.equal(brandContentMatches('Lingo\r\n桌面应用\r\n', 'Lingo\n网页应用\n'), false);
});

test('macOS app menu uses the generated display name instead of the executable name', () => {
  const menuSource = readFileSync(
    resolve(REPO_ROOT, 'pinvou3-app/src-tauri/src/platform/app_menu.rs'),
    'utf8',
  );
  assert.match(menuSource, /core::brand::DISPLAY_NAME/u);
  assert.match(menuSource, /\[\(0, "About"\), \(4, "Hide"\), \(7, "Quit"\)\]/u);
});
