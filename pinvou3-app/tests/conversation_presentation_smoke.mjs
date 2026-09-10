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
  await page.waitForSelector('[data-testid="conversation-process-reasoning"]');
  assert.equal(await page.$eval('[data-testid="conversation-process-reasoning"]', node => (
    getComputedStyle(node, '::-webkit-scrollbar').width
  )), '4px');
  assert.equal(await page.$('[data-testid="conversation-turn-activity"]'), null);
  assert.match(await page.$eval('[data-testid="conversation-process-summary"]', node => node.textContent), /正在工作 · 16秒/);
  const order = await page.$eval('[data-testid="conversation-ordered-content"]', node => node.textContent);
  assert.ok(order.indexOf('读取通知模板') < order.indexOf('模板已经读完'));
  assert.ok(order.indexOf('模板已经读完') < order.indexOf('根据通知要素'));
  assert.ok(order.indexOf('根据通知要素') < order.indexOf('事务型通知通常'));
  assert.equal(await page.$('[data-testid="conversation-tool-group-summary"]'), null);
  await page.screenshot({ path: '/tmp/fresh-process-running.png' });
  await page.evaluate(() => window.__presentation.appendReasoning());
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-testid="conversation-process-reasoning"]');
    return node && node.scrollHeight > node.clientHeight && node.scrollHeight - node.scrollTop - node.clientHeight <= 1;
  });
  await page.$eval('[data-testid="conversation-process-reasoning"]', node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll')); });
  await page.evaluate(() => window.__presentation.appendReasoning());
  await new Promise(resolve => { setTimeout(resolve, 300); });
  assert.equal(await page.$eval('[data-testid="conversation-process-reasoning"]', node => node.scrollTop), 0);
  await page.evaluate(() => window.__presentation.complete());
  await page.waitForFunction(() => !document.querySelector('[data-testid="conversation-process-reasoning"]'));
  assert.match(await page.$eval('[data-testid="conversation-process-summary"]', node => node.textContent), /已工作 16秒/);
  assert.match(await page.$eval('[data-testid="conversation-ordered-content"]', node => node.textContent), /模板已经读完/,
    'folding internal work must preserve user-facing commentary');
  await page.click('[data-testid="conversation-process-summary"]');
  await page.waitForSelector('[data-testid="conversation-process-reasoning"]');
  await page.click('[data-testid="conversation-process-summary"]');
  await page.hover('[data-testid="composer-context-usage"]');
  await page.waitForSelector('[data-testid="composer-context-tooltip"]');
  assert.match(await page.$eval('[role="tooltip"]', node => node.textContent), /16\.1%.*48\.4k.*300\.0k/);
  await page.screenshot({ path: '/tmp/fresh-conversation-light.png' });
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => !document.querySelector('[role="tooltip"]'));
  const layout = await page.evaluate(() => {
    const input = document.querySelector('[data-testid="fixture-input"]');
    const block = document.querySelector('.conversation-prose pre');
    const prose = block.closest('.conversation-prose');
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
  await page.waitForSelector('[data-testid="conversation-process-reasoning"]');
  // Long tool runs stay collapsed in place, without exposing command bodies.
  await page.reload({ waitUntil: 'networkidle0' });
  await page.setViewport({ width: 1200, height: 1000 });
  await page.evaluate(() => window.__presentation.addTools());
  await page.waitForSelector('[data-testid="conversation-tool-batch-summary"]');
  assert.match(await page.$eval('[data-testid="conversation-tool-batch-summary"]', node => node.textContent), /21 项工具操作.*1 项进行中/);
  assert.equal(await page.$('[data-testid="conversation-tool-batch-content"]'), null);
  assert.equal(await page.evaluate(() => document.body.textContent.includes('private-command-marker')), false);
  assert.match(await page.$eval('[data-testid="conversation-ordered-content"]', node => node.textContent), /模板已经读完/);
  await page.screenshot({ path: '/tmp/fresh-chat-tool-summary.png' });
  await page.click('[data-testid="conversation-tool-batch-summary"]');
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-testid="conversation-tool-batch-content"]');
    return node && node.scrollHeight > node.clientHeight && node.scrollHeight - node.scrollTop - node.clientHeight <= 1;
  });
  assert.ok(await page.$eval('[data-testid="conversation-tool-batch-content"]', node => node.clientHeight <= 240));
  assert.equal(await page.$eval('[data-testid="conversation-tool-batch-content"]', node => (
    getComputedStyle(node, '::-webkit-scrollbar').width
  )), '4px');
  await page.$eval('[data-testid="conversation-tool-batch-content"]', node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll')); });
  await page.evaluate(() => window.__presentation.addTools(3));
  await new Promise(resolve => { setTimeout(resolve, 100); });
  assert.equal(await page.$eval('[data-testid="conversation-tool-batch-content"]', node => node.scrollTop), 0);
  await page.evaluate(() => window.__presentation.complete());
  await page.waitForFunction(() => !document.querySelector('[data-testid="conversation-tool-batch-summary"]'));
  await page.click('[data-testid="conversation-process-summary"]');
  await page.waitForSelector('[data-testid="conversation-tool-batch-summary"]');
  assert.equal(await page.$('[data-testid="conversation-tool-batch-content"]'), null);
  assert.match(await page.$eval('[data-testid="conversation-ordered-content"]', node => node.textContent), /模板已经读完/);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(() => { window.__presentation.addTools(); window.__presentation.complete(); window.__presentation.fail(); });
  await page.waitForSelector('[data-testid="conversation-tool-batch-summary"]');
  assert.match(await page.$eval('[data-testid="conversation-tool-batch-summary"]', node => node.textContent), /1 项失败/);
  assert.deepEqual(errors, []);
  console.log('conversation presentation: PASS (collapse, failure, context hover/focus, light/dark/mobile)');
} finally {
  if (browser) await browser.close();
  if (vite) await vite.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
