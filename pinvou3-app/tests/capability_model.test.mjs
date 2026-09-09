import assert from 'node:assert/strict';
import test from 'node:test';

import {
  capabilityKindForEntry,
  resolveLiveCapabilitySelection,
} from '../src/features/capabilities/capability-model.mjs';

test('marketplace sources place new entries in the matching capability tab', () => {
  assert.equal(capabilityKindForEntry({ id: 'plain-skill' }, 'skill'), 'skill');
  assert.equal(capabilityKindForEntry({ id: 'new-mcp' }, 'connector'), 'connector');
  assert.equal(capabilityKindForEntry({ id: 'bundle-skill', companionBundle: true }, 'skill'), 'connector');
  assert.equal(capabilityKindForEntry({ id: 'persona' }, 'expert'), 'expert');
});

test('explicit connector markers keep imported and legacy entries out of skills', () => {
  assert.equal(capabilityKindForEntry({ userUploaded: true, mcpServer: true }), 'connector');
  assert.equal(capabilityKindForEntry({ oauthMcp: true }), 'connector');
  assert.equal(capabilityKindForEntry({ feishuCli: true }), 'connector');
});

test('detail selection follows refreshed install and connection state', () => {
  const selected = { id: 't1', backendId: 'feishu', installed: false, actions: [{ id: 'connect' }] };
  const live = resolveLiveCapabilitySelection(selected, [
    { id: 't1', backendId: 'feishu', installed: true, actions: [{ id: 'disconnect' }] },
  ]);
  assert.equal(live.installed, true);
  assert.equal(live.actions[0].id, 'disconnect');
});
