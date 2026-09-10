#!/usr/bin/env node
// BRAND.json is the single source for user-facing application branding.
//
// Usage:
//   node scripts/sync-brand.mjs          # synchronize managed files
//   node scripts/sync-brand.mjs --check  # verify without writing

import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const BRAND_SCAN_ROOTS = [
  '.github', 'docs', 'pinvou-cli', 'pinvou-knowledge', 'pinvou3-app/resources',
  'pinvou3-app/scripts', 'pinvou3-app/src', 'pinvou3-app/src-tauri/resources',
  'pinvou3-app/src-tauri/src', 'pinvou3-app/src-tauri/tests', 'pinvou3-app/tests',
  'remote-control-relay', 'scripts',
];
const BRAND_SCAN_FILES = [
  'AGENTS.md', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'CONTRIBUTING.zh-CN.md',
  'README.md', 'SUPPORT.md', 'THIRD_PARTY_NOTICES.md', 'TRADEMARKS.md',
];
const BRAND_TEXT_EXTENSIONS = new Set([
  '.cjs', '.desktop', '.html', '.js', '.jsx', '.json', '.md', '.mjs', '.plist',
  '.ps1', '.py', '.rs', '.service', '.sh', '.toml', '.ts', '.tsx', '.yaml', '.yml',
]);
const BRAND_SCAN_IGNORED_DIRECTORIES = new Set(['.git', 'dist', 'node_modules', 'target']);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function brandContentMatches(current, expected) {
  const normalizeLineEndings = (content) => content.replace(/\r\n?/gu, '\n');
  return normalizeLineEndings(current) === normalizeLineEndings(expected);
}

function replaceRequired(content, pattern, replacement, target) {
  if (!pattern.test(content)) {
    throw new Error(`${target}: 未找到品牌同步锚点 ${pattern}`);
  }
  pattern.lastIndex = 0;
  return content.replace(pattern, replacement);
}

function escapeJavaScriptSingleQuoted(value) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

function escapeRust(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function validateBrand(brand, repoRoot) {
  if (!brand || typeof brand.displayName !== 'string' || !brand.displayName.trim()) {
    throw new Error('BRAND.json: displayName 必须是非空字符串');
  }
  if (!brand.icons || typeof brand.icons.frontend !== 'string' || !brand.icons.frontend) {
    throw new Error('BRAND.json: icons.frontend 必须是非空字符串');
  }
  if (!Array.isArray(brand.icons.native) || brand.icons.native.length === 0) {
    throw new Error('BRAND.json: icons.native 必须包含至少一个原生图标路径');
  }
  if (!Array.isArray(brand.legacyDisplayNames)) {
    throw new Error('BRAND.json: legacyDisplayNames 必须是数组');
  }
  const macosScale = Number(brand.icons.macosContentScale);
  if (!brand.icons.macosSource || !brand.icons.macosPadded || !(macosScale > 0 && macosScale <= 1)) {
    throw new Error('BRAND.json: macOS 图标源、留白图和内容比例配置无效');
  }

  const assetPaths = [
    resolve(repoRoot, 'pinvou3-app/src', brand.icons.frontend),
    resolve(repoRoot, 'pinvou3-app/src-tauri', brand.icons.macosSource),
    resolve(repoRoot, 'pinvou3-app/src-tauri', brand.icons.macosPadded),
    ...brand.icons.native.map((path) => resolve(repoRoot, 'pinvou3-app/src-tauri', path)),
  ];
  for (const path of assetPaths) {
    if (!existsSync(path)) throw new Error(`BRAND.json 引用的图标不存在: ${path}`);
  }
}

function brandTextFiles(repoRoot) {
  const files = BRAND_SCAN_FILES.map((path) => resolve(repoRoot, path));
  const visit = (path) => {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = resolve(path, entry.name);
      if (entry.isDirectory() && !BRAND_SCAN_IGNORED_DIRECTORIES.has(entry.name)) visit(child);
      else if (entry.isFile() && BRAND_TEXT_EXTENSIONS.has(extname(entry.name))) files.push(child);
    }
  };
  for (const path of BRAND_SCAN_ROOTS) visit(resolve(repoRoot, path));
  return files;
}

function synchronizeLegacyDisplayNames(repoRoot, brand, checkOnly) {
  const legacyNames = [...new Set(
    brand.legacyDisplayNames
      .map((name) => String(name || '').trim())
      .filter((name) => name && name !== brand.displayName.trim()),
  )];
  if (legacyNames.length === 0) return [];
  const stale = [];
  for (const path of brandTextFiles(repoRoot)) {
    const content = readFileSync(path, 'utf8');
    if (!legacyNames.some((name) => content.includes(name))) continue;
    stale.push(path.slice(repoRoot.length + 1));
    if (!checkOnly) {
      let next = content;
      for (const name of legacyNames) next = next.replaceAll(name, brand.displayName.trim());
      writeFileSync(path, next);
    }
  }
  return stale;
}

function managedFiles(repoRoot, brand) {
  const displayName = brand.displayName.trim();
  const appRoot = resolve(repoRoot, 'pinvou3-app');
  const tauriRoot = resolve(appRoot, 'src-tauri');
  const targets = [];

  const addGenerated = (relativePath, content) => {
    targets.push({ path: resolve(repoRoot, relativePath), content, relativePath });
  };
  const addTransformed = (relativePath, transform) => {
    const path = resolve(repoRoot, relativePath);
    targets.push({ path, content: transform(readFileSync(path, 'utf8')), relativePath });
  };

  addGenerated(
    'pinvou3-app/src/shared/brand.js',
    `// Generated by scripts/sync-brand.mjs from BRAND.json. Do not edit directly.\n` +
      `export const BRAND_NAME = '${escapeJavaScriptSingleQuoted(displayName)}';\n` +
      `export const BRAND_ICON_PATH = '${escapeJavaScriptSingleQuoted(brand.icons.frontend)}';\n`,
  );
  addGenerated(
    'pinvou3-app/src-tauri/src/core/brand.rs',
    `// Generated by scripts/sync-brand.mjs from BRAND.json. Do not edit directly.\n` +
      `pub const DISPLAY_NAME: &str = "${escapeRust(displayName)}";\n`,
  );

  const tauriConfigPath = resolve(tauriRoot, 'tauri.conf.json');
  const tauriConfig = readJson(tauriConfigPath);
  tauriConfig.productName = displayName;
  for (const window of tauriConfig.app?.windows ?? []) {
    if (window.label === 'main') window.title = displayName;
  }
  tauriConfig.bundle.icon = [...brand.icons.native];
  targets.push({
    path: tauriConfigPath,
    content: jsonText(tauriConfig),
    relativePath: 'pinvou3-app/src-tauri/tauri.conf.json',
  });

  const macConfigPath = resolve(tauriRoot, 'config/platforms/macos/tauri.conf.json');
  const macConfig = readJson(macConfigPath);
  for (const window of macConfig.app?.windows ?? []) {
    if (window.label === 'main') window.title = displayName;
  }
  macConfig.bundle.macOS.bundleName = displayName;
  targets.push({
    path: macConfigPath,
    content: jsonText(macConfig),
    relativePath: 'pinvou3-app/src-tauri/config/platforms/macos/tauri.conf.json',
  });

  const packagePath = resolve(appRoot, 'package.json');
  const packageJson = readJson(packagePath);
  packageJson.description = `${displayName}智能助手桌面应用`;
  targets.push({
    path: packagePath,
    content: jsonText(packageJson),
    relativePath: 'pinvou3-app/package.json',
  });

  addTransformed('pinvou3-app/src/index.html', (content) =>
    replaceRequired(content, /<title>[^<]*<\/title>/u, `<title>${displayName}</title>`, 'src/index.html'));
  addTransformed('pinvou3-app/src/pet.html', (content) =>
    replaceRequired(content, /<title>[^<]*<\/title>/u, `<title>${displayName} 桌伴公仔</title>`, 'src/pet.html'));
  addTransformed('pinvou3-app/src-tauri/Cargo.toml', (content) => {
    let next = replaceRequired(
      content,
      /^description\s*=\s*"[^"]*"/mu,
      `description = "${displayName}智能助手桌面应用后端"`,
      'src-tauri/Cargo.toml',
    );
    next = replaceRequired(
      next,
      /^authors\s*=\s*\[[^\n]*\]/mu,
      `authors = ["${displayName} contributors"]`,
      'src-tauri/Cargo.toml',
    );
    return next;
  });
  addTransformed('pinvou3-app/src-tauri/packaging/macos/Info.plist', (content) => {
    let next = content;
    for (const key of ['CFBundleDisplayName', 'CFBundleName']) {
      const pattern = new RegExp(`(<key>${key}<\\/key>\\s*<string>)[^<]*(<\\/string>)`, 'u');
      next = replaceRequired(next, pattern, `$1${displayName}$2`, 'packaging/macos/Info.plist');
    }
    next = replaceRequired(
      next,
      /(<key>NSMicrophoneUsageDescription<\/key>\s*<string>)[^<]*(<\/string>)/u,
      `$1${displayName} 需要访问麦克风以提供语音输入功能。$2`,
      'packaging/macos/Info.plist',
    );
    next = replaceRequired(
      next,
      /(<key>NSSpeechRecognitionUsageDescription<\/key>\s*<string>)[^<]*(<\/string>)/u,
      `$1${displayName} 需要语音识别权限以将您的语音转换为文字；系统支持时在本机处理，否则音频可能发送至 Apple Speech 服务。$2`,
      'packaging/macos/Info.plist',
    );
    return replaceRequired(
      next,
      /(<key>NSLocalNetworkUsageDescription<\/key>\s*<string>)[^<]*(<\/string>)/u,
      `$1${displayName} 需要访问本地网络，以连接局域网内的模型服务（如 vLLM、Ollama 等）。$2`,
      'packaging/macos/Info.plist',
    );
  });
  addTransformed('pinvou3-app/src-tauri/packaging/linux/deb/pinvou3.desktop', (content) => {
    const replacements = [
      [/^Name=.*$/mu, `Name=${displayName} 智能助手`],
      [/^Name\[en\]=.*$/mu, `Name[en]=${displayName} Assistant`],
      [/^Name\[zh_CN\]=.*$/mu, `Name[zh_CN]=${displayName}智能助手`],
      [/^Keywords=.*$/mu, `Keywords=AI;LLM;assistant;chat;pinvou;${displayName};智能助手;`],
    ];
    return replacements.reduce(
      (next, [pattern, replacement]) => replaceRequired(next, pattern, replacement, 'packaging/linux/deb/pinvou3.desktop'),
      content,
    );
  });

  return targets;
}

export function main(repoRoot = REPO_ROOT, { checkOnly = process.argv.includes('--check') } = {}) {
  try {
    const brand = readJson(resolve(repoRoot, 'BRAND.json'));
    validateBrand(brand, repoRoot);
    const stale = synchronizeLegacyDisplayNames(repoRoot, brand, checkOnly);
    for (const target of managedFiles(repoRoot, brand)) {
      const current = existsSync(target.path) ? readFileSync(target.path, 'utf8') : '';
      if (brandContentMatches(current, target.content)) continue;
      if (checkOnly) stale.push(target.relativePath);
      else writeFileSync(target.path, target.content);
    }
    if (stale.length > 0) {
      console.error(`品牌配置未同步：${stale.join('、')}。请运行 node scripts/sync-brand.mjs`);
      return 1;
    }
    console.log(checkOnly ? '品牌配置已同步' : `品牌配置已同步为“${brand.displayName.trim()}”`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

function isCliEntry() {
  if (!process.argv[1]) return false;
  const entry = resolve(process.argv[1]);
  if (entry === SCRIPT_PATH) return true;
  try {
    return realpathSync(entry) === realpathSync(SCRIPT_PATH);
  } catch {
    return false;
  }
}

if (isCliEntry()) process.exit(main());
