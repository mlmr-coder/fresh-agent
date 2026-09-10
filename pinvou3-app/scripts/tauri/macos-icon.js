const { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } = require('node:fs');
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

function copyIfChanged(source, destination) {
  if (existsSync(destination) && readFileSync(source).equals(readFileSync(destination))) return false;
  copyFileSync(source, destination);
  return true;
}

function syncMacosIcon({ platform = process.platform } = {}) {
  if (platform !== 'darwin') return false;
  const brand = JSON.parse(readFileSync(path.join(REPO_ROOT, 'BRAND.json'), 'utf8'));
  const source = path.join(TAURI_ROOT, brand.icons.macosSource);
  const padded = path.join(TAURI_ROOT, brand.icons.macosPadded);
  const scale = String(brand.icons.macosContentScale);
  const scratch = mkdtempSync(path.join(tmpdir(), 'pinvou3-macos-icon-'));
  const generatedPadded = path.join(scratch, 'macos-icon.png');
  const generatedIcns = path.join(scratch, 'icon.icns');
  const iconset = path.join(scratch, 'AppIcon.iconset');
  mkdirSync(iconset);
  try {
    run('/usr/bin/swift', [path.join(__dirname, 'macos-icon.swift'), source, generatedPadded, scale]);
    for (const [name, pixels] of [
      ['icon_16x16.png', 16], ['icon_16x16@2x.png', 32],
      ['icon_32x32.png', 32], ['icon_32x32@2x.png', 64],
      ['icon_128x128.png', 128], ['icon_128x128@2x.png', 256],
      ['icon_256x256.png', 256], ['icon_256x256@2x.png', 512],
      ['icon_512x512.png', 512], ['icon_512x512@2x.png', 1024],
    ]) {
      run('/usr/bin/sips', ['-z', String(pixels), String(pixels), generatedPadded, '-o', path.join(iconset, name)]);
    }
    run('/usr/bin/iconutil', ['-c', 'icns', iconset, '-o', generatedIcns]);
    const paddedChanged = copyIfChanged(generatedPadded, padded);
    const icnsChanged = copyIfChanged(generatedIcns, path.join(TAURI_ROOT, 'icons/icon.icns'));
    const changed = paddedChanged || icnsChanged;
    console.log(`macOS icon ${changed ? 'updated' : 'unchanged'} at ${path.join(TAURI_ROOT, 'icons/icon.icns')}`);
    return Boolean(changed);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (require.main === module) syncMacosIcon();

module.exports = { copyIfChanged, syncMacosIcon };
