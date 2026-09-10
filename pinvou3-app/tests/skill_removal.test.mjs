import assert from 'node:assert/strict';
import { canRemoveSkill, removeSkill } from '../src/features/tools/skill-removal.mjs';

assert.equal(canRemoveSkill({ backendId: 'x', installed: true }), true);
assert.equal(canRemoveSkill({ backendId: 'x', installed: false }), false);
assert.equal(canRemoveSkill({ backendId: 'x', installed: true, builtin: true }), false);

const standaloneCalls = [];
assert.deepEqual(await removeSkill({ backendId: 'x', installed: true }, async (...args) => standaloneCalls.push(args)), { removedWithConnector: false });
assert.deepEqual(standaloneCalls, [['uninstall_marketplace_skill', { skillId: 'x' }]]);

const companionCalls = [];
assert.deepEqual(await removeSkill({ backendId: 's', installed: true, companionBundle: true, connectorId: 'c', packageInstalled: true }, async (...args) => companionCalls.push(args)), { removedWithConnector: true });
assert.deepEqual(companionCalls, [['uninstall_marketplace_tool', { toolId: 'c' }]]);

await assert.rejects(() => removeSkill({ backendId: 'x', installed: false }, async () => {}), /skill_not_installed/);

console.log('skill removal tests passed');
