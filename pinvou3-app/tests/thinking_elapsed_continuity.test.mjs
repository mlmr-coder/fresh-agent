import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const interactionSource = readFileSync(
  new URL('../src/platform/tauri/bridge/interaction.js', import.meta.url),
  'utf8',
);
const webBridgeSource = readFileSync(
  new URL('../src/platform/web/bridge.js', import.meta.url),
  'utf8',
);

test('thinking phases preserve the elapsed-time origin for the whole turn', () => {
  let now = 1000;
  class FakeDate extends Date {
    static now() { return now; }
  }
  const sandbox = { window: {}, Date: FakeDate };
  vm.runInNewContext(interactionSource, sandbox, { filename: 'interaction.js' });

  const state = { thinking: { active: false, phase: 'thinking', toolName: '', startedAt: 0 } };
  const interaction = sandbox.window.__PINVOU_TAURI_BRIDGE_FEATURES__.interaction({ state });

  interaction.startThinking();
  assert.equal(state.thinking.startedAt, 1000);

  now = 2500;
  interaction.thinkingTool('read_file');
  assert.equal(state.thinking.startedAt, 1000, 'entering a tool must not restart the turn timer');

  now = 4000;
  interaction.thinkingIdle();
  assert.equal(state.thinking.startedAt, 1000, 'returning from a tool or retry must keep the turn timer');

  interaction.stopThinking();
  now = 5000;
  interaction.startThinking();
  assert.equal(state.thinking.startedAt, 5000, 'a genuinely new turn starts a new timer');
});

test('web and desktop bridges use the same continuous turn timer policy', () => {
  const policy = /function activeThinkingStartedAt\(\)[\s\S]*?function startThinking\(\)[\s\S]*?activeThinkingStartedAt\(\)[\s\S]*?function thinkingTool\(name\)[\s\S]*?activeThinkingStartedAt\(\)[\s\S]*?function thinkingIdle\(\)[\s\S]*?activeThinkingStartedAt\(\)/;
  assert.match(interactionSource, policy);
  assert.match(webBridgeSource, policy);
});
