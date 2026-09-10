#!/usr/bin/env node

import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PLATFORMS = [
  { key: 'linux-x64', suffix: 'linux-x64.deb', format: 'deb', restartAfterInstall: true },
  { key: 'linux-arm64', suffix: 'linux-arm64.deb', format: 'deb', restartAfterInstall: true },
  { key: 'windows-x64', suffix: 'windows-x64-setup.exe', format: 'exe', restartAfterInstall: false },
  { key: 'macos-universal', suffix: 'macos-universal.dmg', format: 'dmg', restartAfterInstall: true },
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`Invalid argument near ${key || '<end>'}`);
    }
    args[key.slice(2)] = value;
  }
  return args;
}

function readSha256(path) {
  const sha256 = readFileSync(path, 'utf8').trim().split(/\s+/u)[0]?.toLowerCase() || '';
  if (!/^[0-9a-f]{64}$/u.test(sha256)) {
    throw new Error(`Invalid SHA-256 file: ${path}`);
  }
  return sha256;
}

export function generateUpdateManifest({ version, repository, assetsDir, pubDate, notes }) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(version)) {
    throw new Error(`Invalid SemVer version: ${version}`);
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
    throw new Error(`Invalid GitHub repository: ${repository}`);
  }
  const tag = `v${version}`;
  const encodedTag = encodeURIComponent(tag);
  const platforms = {};

  for (const platform of PLATFORMS) {
    const filename = `pinvou-agent_${version}-${platform.suffix}`;
    const assetPath = resolve(assetsDir, filename);
    const checksumPath = `${assetPath}.sha256`;
    const size = statSync(assetPath).size;
    if (size <= 0) throw new Error(`Release asset is empty: ${assetPath}`);
    platforms[platform.key] = {
      version,
      url: `https://github.com/${repository}/releases/download/${encodedTag}/${filename}`,
      format: platform.format,
      sha256: readSha256(checksumPath),
      size,
      restart_after_install: platform.restartAfterInstall,
    };
  }

  return {
    schema_version: 1,
    version,
    notes: notes || `智灵 v${version}`,
    pub_date: pubDate,
    platforms,
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const required = ['version', 'repository', 'assets', 'output', 'pub-date'];
  for (const key of required) {
    if (!args[key]) throw new Error(`Missing --${key}`);
  }
  const manifest = generateUpdateManifest({
    version: args.version,
    repository: args.repository,
    assetsDir: resolve(args.assets),
    pubDate: args['pub-date'],
    notes: args.notes,
  });
  writeFileSync(resolve(args.output), `${JSON.stringify(manifest, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] || '')).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
