#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { startUiTestServer } = require('./ui_test_server');

function loadPuppeteer() {
  try { return require('puppeteer-core'); } catch { /* fall through */ }
  const npx = path.join(os.homedir(), '.npm', '_npx');
  if (fs.existsSync(npx)) {
    for (const d of fs.readdirSync(npx)) {
      const p = path.join(npx, d, 'node_modules', 'puppeteer-core');
      if (fs.existsSync(p)) { try { return require(p); } catch { /* next */ } }
    }
  }
  console.error('SKIP: 找不到 puppeteer-core');
  process.exit(2);
}

const puppeteer = loadPuppeteer();
const CHROME = process.env.CHROME || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find(p => fs.existsSync(p));

if (!CHROME) {
  console.error('SKIP: 未找到 Chrome/Edge');
  process.exit(2);
}

async function main() {
  const { url } = await startUiTestServer();
  const INDEX = url + '?mockUpdate=1';
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 820 });
  await page.evaluateOnNewDocument(() => {
    const listeners = {};
    const invoke = async (command) => {
      if (command === 'get_settings') return { theme: 'genesis', language: 'zh-Hans' };
      if (command === 'get_app_version') return '1.1.0';
      if (command === 'get_effective_model_config') return {};
      if (command === 'list_models') return { models: [], active_model_id: null };
      if (command === 'list_sessions' || command === 'list_archived_sessions' ||
          command === 'list_personas' || command === 'list_scheduled_tasks' ||
          command === 'list_scheduled_runs') return [];
      if (command === 'check_for_update') {
        return {
          available: true,
          latest_version: '1.2.0',
          current_version: '1.1.0',
          platform: 'linux',
          notes: 'UI smoke update',
        };
      }
      if (command === 'download_update') {
        window.__UPDATE_DOWNLOADS__ = (window.__UPDATE_DOWNLOADS__ || 0) + 1;
        if (window.__UPDATE_DOWNLOADS__ === 1) throw new Error('Download unavailable');
        listeners['update:progress']?.({ payload: { downloaded: 42, total: 100 } });
        return new Promise(resolve => { window.__RESOLVE_UPDATE_DOWNLOAD__ = resolve; });
      }
      if (command === 'install_update') return null;
      if (command === 'restart_app') {
        window.__UPDATE_RESTARTS__ = (window.__UPDATE_RESTARTS__ || 0) + 1;
        return null;
      }
      if (command === 'get_super_permission_status') return false;
      if (command === 'get_backend_status') return {};
      if (command === 'find_resumable_run' || command === 'get_active_persona') return null;
      return null;
    };
    window.__TAURI__ = {
      core: { invoke },
      event: {
        listen: async (name, handler) => { listeners[name] = handler; return () => { delete listeners[name]; }; },
        emit: async () => {},
      },
      dialog: { open: async () => null },
      window: {
        getCurrentWindow: () => ({
          minimize() {}, maximize() {}, close() {}, toggleMaximize() {}, startDragging() {},
          isMaximized: async () => false,
          onResized: async () => () => {},
        }),
      },
    };
  });
  page.on('pageerror', err => { throw err; });
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('BROWSER:', msg.text());
  });

  await page.goto(INDEX, { waitUntil: 'networkidle0' });
  await page.click('[data-sidebar-toggle]');
  await page.waitForFunction(() => document.querySelector('[data-testid="app-sidebar"]')
    ?.getBoundingClientRect().width >= 220, { timeout: 2000 });
  await page.waitForSelector('[data-testid="sidebar-update-action"]', { timeout: 10000 });
  const updateAction = await page.$eval('[data-testid="sidebar-update-action"]', el => ({
    text: el.innerText,
    title: el.title,
  }));
  if (!updateAction.text.includes('v1.1.0')) {
    throw new Error('侧栏没有显示当前版本');
  }
  if (!updateAction.title.includes('v1.2.0')) throw new Error('升级箭头没有标明目标版本');
  if (process.env.UPDATE_NOTICE_SCREENSHOT) {
    await page.screenshot({ path: process.env.UPDATE_NOTICE_SCREENSHOT });
  }

  await page.click('[data-testid="sidebar-update-action"]');
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="sidebar-update-action"]')?.title.includes('Download unavailable'),
  { timeout: 5000 });
  await page.click('[data-testid="sidebar-update-action"]');
  await page.waitForSelector('[data-testid="sidebar-update-progress"]', { timeout: 5000 });
  await page.waitForFunction(() => {
    const progress = document.querySelector('[data-testid="sidebar-update-progress"]');
    return progress && progress.style.width === '42%';
  }, { timeout: 5000 });
  await page.evaluate(() => window.__RESOLVE_UPDATE_DOWNLOAD__?.('/tmp/fresh-agent-1.2.0-linux.deb'));
  await page.waitForSelector('[data-testid="sidebar-update-ready"]', { timeout: 5000 });
  await page.waitForFunction(() => window.__UPDATE_RESTARTS__ === 1, { timeout: 5000 });
  await page.click('[data-testid="sidebar-update-ready"]');
  await page.waitForFunction(() => window.__UPDATE_RESTARTS__ === 2, { timeout: 5000 });
  if (await page.evaluate(() => window.__UPDATE_DOWNLOADS__ !== 2)) {
    throw new Error('Restart action must not download or install again');
  }

  await browser.close();
  console.log('update_notice_ui_smoke: ok');
}

// eslint-disable-next-line unicorn/prefer-top-level-await -- smoke script keeps its existing async main() structure
main().catch(err => {
  console.error('FAIL:', err && err.stack || err);
  process.exit(1);
});
