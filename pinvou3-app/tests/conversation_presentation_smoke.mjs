import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import * as puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/snap/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(candidate => fs.existsSync(candidate));
if (!chrome) { console.error('SKIP: set CHROME to a browser executable'); process.exit(2); }
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fresh-conversation-'));
let browser;
let vite;
try {
  vite = await createServer({ root: appRoot, configFile: false, appType: 'mpa', logLevel: 'error', plugins: [react()], server: { host: '127.0.0.1', port: 0, watch: null } });
  await vite.listen();
  browser = await puppeteer.launch({ executablePath: chrome, headless: true, userDataDir: profile, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1200, height: 1000 });
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/tests/fixtures/conversation_presentation.html`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="conversation-tool-group-content"]');
  await page.evaluate(() => window.__presentation.complete());
  await page.waitForFunction(() => !document.querySelector('[data-testid="conversation-tool-group-content"]'));
  assert.equal(await page.$eval('[data-testid="conversation-tool-group-summary"]', node => node.getAttribute('aria-expanded')), 'false');
  await page.click('[data-testid="conversation-tool-group-summary"]');
  await page.waitForSelector('[data-testid="conversation-tool-group-content"]');
  await page.click('[data-testid="conversation-tool-group-summary"]');
  await page.hover('[data-testid="composer-context-usage"]');
  await page.waitForSelector('[data-testid="composer-context-tooltip"]');
  assert.match(await page.$eval('[role="tooltip"]', node => node.textContent), /16\.1%.*48\.4k.*300\.0k/);
  await page.screenshot({ path: '/tmp/fresh-conversation-light.png' });
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => !document.querySelector('[role="tooltip"]'));
  const layout = await page.evaluate(() => {
    const input = document.querySelector('[data-testid="fixture-input"]');
    const prose = document.querySelector('.conversation-prose');
    const block = prose.querySelector('pre');
    return { inputHeight: input.getBoundingClientRect().height, bodySize: getComputedStyle(prose).fontSize, textHeader: getComputedStyle(block, '::before').display, outside: document.documentElement.scrollWidth > innerWidth };
  });
  assert.ok(layout.inputHeight >= 88 && layout.inputHeight <= 200, JSON.stringify(layout));
  assert.equal(layout.textHeader, 'none');
  assert.equal(layout.outside, false);
  await page.$eval('[data-testid="composer-context-usage"]', node => node.focus());
  await page.waitForSelector('[role="tooltip"]');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[role="tooltip"]'));
  await page.evaluate(() => { document.documentElement.classList.add('dark'); window.__presentation.setTokens({ input: 290000, max: 300000 }); });
  await page.waitForFunction(() => document.querySelector('[data-testid="composer-context-usage"]')?.getAttribute('aria-label').includes('96.7%'));
  await page.screenshot({ path: '/tmp/fresh-conversation-dark.png' });
  await page.setViewport({ width: 390, height: 844 });
  await page.hover('[data-testid="composer-context-usage"]');
  await page.waitForSelector('[role="tooltip"]');
  assert.equal(await page.$eval('[role="tooltip"]', node => { const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }), true);
  await page.evaluate(() => window.__presentation.setTokens({ input: 20, max: 0 }));
  await page.waitForFunction(() => !document.querySelector('[data-testid="composer-context-usage"]'));
  // A fresh failed group must expose its details by default.
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(() => { window.__presentation.complete(); window.__presentation.fail(); });
  await page.waitForSelector('[data-testid="conversation-tool-group-content"]');
  assert.deepEqual(errors, []);
  console.log('conversation presentation: PASS (collapse, failure, context hover/focus, light/dark/mobile)');
} finally {
  if (browser) await browser.close();
  if (vite) await vite.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
