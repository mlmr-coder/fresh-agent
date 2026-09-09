import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(
  new URL('../src/platform/tauri/bridge/updater.js', import.meta.url),
  'utf8',
);

function flushMicrotasks() {
  return new Promise(resolve => { setImmediate(resolve); });
}

test('hourly checks stop as soon as a newer version is found', async () => {
  let timerCallback = null;
  let timerDelay = null;
  let clearedTimer = null;
  let checks = 0;
  let nextInfo = {
    available: false,
    current_version: '1.0.0',
    latest_version: '1.0.0',
  };
  const window = {
    setTimeout(callback, delay) {
      timerCallback = callback;
      timerDelay = delay;
      return 41;
    },
    clearTimeout(timer) { clearedTimer = timer; },
  };
  const context = vm.createContext({ window });
  vm.runInContext(source, context, { filename: 'updater.js' });
  const install = window.__PINVOU_TAURI_BRIDGE_FEATURES__.updater;
  const state = {
    updateDownloading: false,
    updateReady: false,
    updateProgress: 0,
    sessions: [],
  };
  const feature = install({
    state,
    notify() {},
    async invoke(command) {
      if (command !== 'check_for_update') return null;
      checks += 1;
      return nextInfo;
    },
    listen() {},
    refreshHistoryList: async () => {},
    getBuffer() {},
    bt() { return ''; },
  });

  feature.startPeriodicUpdateChecks();
  await flushMicrotasks();
  assert.equal(checks, 1);
  assert.equal(timerDelay, 60 * 60 * 1000);
  assert.equal(clearedTimer, null);

  nextInfo = {
    available: true,
    current_version: '1.0.0',
    latest_version: '1.1.0',
  };
  await timerCallback();
  assert.equal(checks, 2);
  assert.equal(clearedTimer, 41);
  assert.equal(state.updateInfo.available, true);
});

test('manual check classifies a missing release manifest without exposing the raw GitHub error', async () => {
  const window = {
    setTimeout() { return 1; },
    clearTimeout() {},
  };
  const context = vm.createContext({ window });
  vm.runInContext(source, context, { filename: 'updater.js' });
  const install = window.__PINVOU_TAURI_BRIDGE_FEATURES__.updater;
  const state = {
    updateDownloading: false,
    updateReady: false,
    updateProgress: 0,
    sessions: [],
  };
  const feature = install({
    state,
    notify() {},
    async invoke(command) {
      if (command === 'check_for_update') {
        throw new Error('The update source returned an error: HTTP status client error (404 Not Found) for url (https://github.com/mlmr-coder/fresh-agent/releases/latest/download/latest.json)');
      }
      return null;
    },
    listen() {},
    refreshHistoryList: async () => {},
    getBuffer() {},
    bt() { return ''; },
  });

  await feature.checkForUpdate();

  assert.equal(state.updateCheckError, 'manifest_missing');
  assert.doesNotMatch(state.updateCheckError, /github|404|latest\.json/i);
});
