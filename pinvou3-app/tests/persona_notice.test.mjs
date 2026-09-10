import assert from 'node:assert/strict';
import { test } from 'node:test';
import { removedPersonaName } from '../src/features/personas/persona-notice.mjs';

test('historical expert removals work in either persisted language', () => {
  assert.equal(removedPersonaName({ type: 'system', text: '🎴 已卸下专家卡牌: 前端开发者' }), '前端开发者');
  assert.equal(removedPersonaName({ type: 'system', text: '🎴 Expert card removed: Frontend developer' }), 'Frontend developer');
});

test('ordinary messages and quoted removal notices remain unchanged', () => {
  assert.equal(removedPersonaName({ type: 'system', text: 'Connection restored' }), null);
  assert.equal(removedPersonaName({ type: 'user', text: '🎴 已卸下专家卡牌: 前端开发者' }), null);
  assert.equal(removedPersonaName({ type: 'system', text: '引用：🎴 已卸下专家卡牌: 前端开发者' }), null);
  assert.equal(removedPersonaName({ type: 'system' }), null);
});
