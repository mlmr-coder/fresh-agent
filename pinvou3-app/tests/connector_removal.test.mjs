import assert from 'node:assert/strict';
import test from 'node:test';
import { canRemoveConnector, removeConnector } from '../src/features/tools/connector-removal.mjs';

test('registered connectors remain removable when disabled or authorization has expired', () => {
  assert.equal(canRemoveConnector({ backendId: 'feishu', packageInstalled: true, installed: false }), true);
  assert.equal(canRemoveConnector({ backendId: 'remote', mcpConfigured: true }), true);
  assert.equal(canRemoveConnector({ backendId: 'remote' }), false);
  assert.equal(canRemoveConnector({ backendId: 'builtin', builtin: true, installed: true }), false);
});

test('CLI deletion logs out and removes companion skills before deleting app registration', async () => {
  for (const id of ['feishu', 'wecom', 'dingtalk', 'tmeet', 'ima', 'remote']) {
    const calls = [];
    await removeConnector({ backendId: id, packageInstalled: true }, async (...args) => { calls.push(args); return { ok: true }; });
    const expected = id === 'remote' ? [] : [[`${id}_logout`]];
    if (!['ima', 'remote'].includes(id)) expected.push([`${id}_apply_skills`]);
    expected.push(['uninstall_marketplace_tool', { toolId: id }]);
    assert.deepEqual(calls, expected);
  }
});

test('logout and skill cleanup failures do not block removing the local registration', async () => {
  for (const failAt of ['feishu_logout', 'feishu_apply_skills']) {
    const calls = [];
    const result = await removeConnector({ backendId: 'feishu', installed: true }, async cmd => {
      calls.push(cmd);
      if (cmd === failAt) throw new Error('cleanup failed');
      return { ok: true };
    });
    assert.equal(calls.includes('uninstall_marketplace_tool'), true);
    assert.deepEqual(result.cleanupFailures, [failAt]);
  }
  const calls = [];
  const result = await removeConnector({ backendId: 'ima', installed: true }, async cmd => {
    calls.push(cmd);
    return cmd === 'ima_logout' ? { ok: false } : undefined;
  });
  assert.deepEqual(calls, ['ima_logout', 'uninstall_marketplace_tool']);
  assert.deepEqual(result.cleanupFailures, ['ima_logout']);
});

test('uninstall failure is reported and uninstalled entries cannot trigger teardown', async () => {
  await assert.rejects(removeConnector({ backendId: 'remote', installed: true }, async () => { throw new Error('storage failure'); }), /storage failure/);
  await assert.rejects(removeConnector({ backendId: 'remote' }, async () => assert.fail('must not invoke')), /connector_not_installed/);
});

test('combined cards delete the owning connector, while standalone legacy skills retain skill uninstall', async () => {
  const tool = { backendId: 'government-writing', connectorId: 'gongwen', companionBundle: true, installed: true };
  assert.equal(canRemoveConnector(tool), false);
  const calls = [];
  await removeConnector({ ...tool, packageInstalled: true }, async (...args) => calls.push(args));
  assert.deepEqual(calls, [['uninstall_marketplace_tool', { toolId: 'gongwen' }]]);
});
