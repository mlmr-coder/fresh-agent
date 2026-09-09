import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { generateUpdateManifest, main } from '../generate-update-manifest.mjs';

const VERSION = '1.2.3';
const ASSETS = [
  'linux-x64.deb',
  'linux-arm64.deb',
  'windows-x64-setup.exe',
  'macos-universal.dmg',
];

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'fresh-agent-manifest-'));
  for (const suffix of ASSETS) {
    const path = join(dir, `pinvou-agent_${VERSION}-${suffix}`);
    writeFileSync(path, `asset:${suffix}`);
    writeFileSync(`${path}.sha256`, `${'a'.repeat(64)}  ${path}\n`);
  }
  return dir;
}

test('generates the four platform entries used by the updater', () => {
  const dir = fixture();
  try {
    const manifest = generateUpdateManifest({
      version: VERSION,
      repository: 'mlmr-coder/fresh-agent',
      assetsDir: dir,
      pubDate: '2026-09-09T00:00:00Z',
    });
    assert.deepEqual(Object.keys(manifest.platforms), [
      'linux-x64',
      'linux-arm64',
      'windows-x64',
      'macos-universal',
    ]);
    assert.equal(manifest.platforms['macos-universal'].format, 'dmg');
    assert.equal(manifest.platforms['windows-x64'].restart_after_install, false);
    assert.match(
      manifest.platforms['linux-x64'].url,
      /mlmr-coder\/fresh-agent\/releases\/download\/v1\.2\.3\/pinvou-agent_1\.2\.3-linux-x64\.deb$/u,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI writes latest.json', () => {
  const dir = fixture();
  const output = join(dir, 'latest.json');
  try {
    main([
      '--version', VERSION,
      '--repository', 'mlmr-coder/fresh-agent',
      '--assets', dir,
      '--output', output,
      '--pub-date', '2026-09-09T00:00:00Z',
    ]);
    assert.equal(JSON.parse(readFileSync(output, 'utf8')).version, VERSION);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
