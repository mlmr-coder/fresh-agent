import assert from 'node:assert/strict';
import {
  marketplaceSkillForDisplay,
  mergeSkillDisplayCatalogues,
  readSkillDisplayCache,
  skillReferenceNames,
  writeSkillDisplayCache,
} from '../src/features/chat/skill-display-catalogue.js';

const marketplace = marketplaceSkillForDisplay({
  id: 'archify',
  title: '架构图',
  icon: 'Presentation',
  color: 'bg-violet',
});
const current = {
  name: 'archify',
  catalogue_id: 'archify',
  title: '架构图设计',
  aliases: ['diagram'],
  icon: 'Presentation',
  color: 'bg-violet',
};
const merged = mergeSkillDisplayCatalogues([marketplace], [current]);
assert.equal(merged.length, 1);
assert.equal(merged[0].title, '架构图设计');
const lexical = (left, right) => left.localeCompare(right);
assert.deepEqual(skillReferenceNames(merged[0]).sort(lexical), ['archify', 'diagram', '架构图', '架构图设计'].sort(lexical));

const values = new Map();
const storage = {
  getItem: key => values.get(key) || null,
  setItem: (key, value) => values.set(key, value),
};
writeSkillDisplayCache(merged, storage);
const restored = readSkillDisplayCache(storage);
assert.equal(restored[0].name, 'archify');
assert.equal(restored[0].title, '架构图设计');
assert.equal(restored[0].icon, 'Presentation');
assert.deepEqual(readSkillDisplayCache({ getItem: () => '{broken' }), []);
console.log('skill display catalogue: PASS');
