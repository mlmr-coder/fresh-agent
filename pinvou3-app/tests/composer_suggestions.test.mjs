import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/features/chat/composer-suggestions.js', import.meta.url), 'utf8');
const { composerToken, composerSuggestions, insertComposerSuggestion } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

for (const text of ['user@example.com', 'https://example.com', '/tmp/file', 'plain text', '@"selected file" ']) {
  assert.equal(composerToken(text, text.length), null, text);
}
const text = '请先 /vis 再分析';
const token = composerToken(text, 7);
assert.equal(token.query, 'vis');
assert.deepEqual(insertComposerSuggestion(text, token, '/visualizer'), { value: '请先 /visualizer  再分析', caret: 15 });
assert.equal(composerToken('请看 @报', 5).kind, 'files');
const skills = [{ name: 'visualizer', title: '数据分析可视化', description: '数据可视化', aliases: ['chart'], icon: 'LineChart', color: 'bg-blue' }];
assert.equal(composerSuggestions('skills', skills, 'CHART')[0].insertion, '/数据分析可视化');
assert.equal(composerSuggestions('skills', skills, 'CHART')[0].code, 'visualizer');
assert.equal(composerSuggestions('skills', skills, '数据')[0].kind, 'skill');
assert.equal(composerSuggestions('skills', skills, '数据')[0].icon, 'LineChart');
const files = [{ name: '报告 1.csv', path: '/session/attachments/报告 1.csv' }];
assert.equal(composerSuggestions('files', files, '报告')[0].insertion, '@"/session/attachments/报告 1.csv"');
assert.deepEqual(composerSuggestions('skills', [], 'visualizer'), []);
assert.equal(composerToken('帮我/数据', 5).query, '数据');
assert.equal(composerToken('start/vis', 9).query, 'vis');
console.log('composer suggestions: PASS');

const { composerSegments, composerSkillSegments, skillIconShapes } = await import(new URL('../src/features/chat/composer-input-dom.js', import.meta.url));
const catalogue = [{ title: '视觉设计' }, { title: '数据库操作' }];
assert.deepEqual(composerSegments('先用/视觉设计 /数据库操作 分析', catalogue), [
  { text: '先用' }, { text: '/视觉设计', name: '视觉设计' }, { text: ' ' },
  { text: '/数据库操作', name: '数据库操作' }, { text: ' 分析' },
]);
for (const raw of ['https://视觉设计', '/tmp/视觉设计', '/视觉设计/file', '/视觉设计中', '/uninstalled ']) {
  assert.deepEqual(composerSegments(raw, catalogue), [{ text: raw }]);
}
assert.deepEqual(composerSegments('/视觉设计', catalogue), [{ text: '/视觉设计', name: '视觉设计' }]);
assert.deepEqual(composerSegments('', catalogue), []);
const enriched = composerSkillSegments('/数据分析可视化 请分析', skills);
assert.equal(enriched[0].skill.icon, 'LineChart');
assert.equal(skillIconShapes(enriched[0].skill.icon)[0][1].d, 'M3 3v18h18M19 9l-5 5-4-4-3 3');
const codeReference = composerSkillSegments('/visualizer 请分析', skills, true);
assert.equal(codeReference[0].text, '/visualizer');
assert.equal(codeReference[0].name, '数据分析可视化');
assert.equal(codeReference[0].skill.icon, 'LineChart');
const aliasReference = composerSkillSegments('/chart 请分析', skills, true);
assert.equal(aliasReference[0].text, '/chart');
assert.equal(aliasReference[0].name, '数据分析可视化');
const chatViewSource = readFileSync(new URL('../src/features/chat/ChatView.jsx', import.meta.url), 'utf8');
assert.ok(chatViewSource.includes('data-testid="user-message-skill"')
  && chatViewSource.includes('skills={suggestions.displaySkills}')
  && chatViewSource.includes("skills || [], true")
  && chatViewSource.includes('conversationVariant={conversationVariant} skills={skills}')
  && chatViewSource.includes('segment.skill?.icon'), 'sent messages must render skill references using catalogue metadata');
console.log('composer skill tokens: PASS');
