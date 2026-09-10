const { mkdtempSync, mkdirSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const APP_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');
const TAURI_ROOT = path.join(APP_ROOT, 'src-tauri');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}

function main() {
  if (process.platform !== 'darwin') throw new Error('macOS icon generation must run on macOS');
  const brand = JSON.parse(readFileSync(path.join(REPO_ROOT, 'BRAND.json'), 'utf8'));
  const source = path.join(TAURI_ROOT, brand.icons.macosSource);
  const padded = path.join(TAURI_ROOT, brand.icons.macosPadded);
  const scale = String(brand.icons.macosContentScale);
  const scratch = mkdtempSync(path.join(tmpdir(), 'zhiling-macos-icon-'));
  const iconset = path.join(scratch, 'AppIcon.iconset');
  mkdirSync(iconset);
  try {
    run('/usr/bin/swift', [path.join(__dirname, 'macos-icon.swift'), source, padded, scale]);
    for (const [name, pixels] of [
      ['icon_16x16.png', 16], ['icon_16x16@2x.png', 32],
      ['icon_32x32.png', 32], ['icon_32x32@2x.png', 64],
      ['icon_128x128.png', 128], ['icon_128x128@2x.png', 256],
      ['icon_256x256.png', 256], ['icon_256x256@2x.png', 512],
      ['icon_512x512.png', 512], ['icon_512x512@2x.png', 1024],
    ]) {
      run('/usr/bin/sips', ['-z', String(pixels), String(pixels), padded, '-o', path.join(iconset, name)]);
    }
    run('/usr/bin/iconutil', ['-c', 'icns', iconset, '-o', path.join(TAURI_ROOT, 'icons/icon.icns')]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  console.log(`macOS icon generated at ${path.join(TAURI_ROOT, 'icons/icon.icns')}`);
}

main();
