import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles/base.css';
import { dict } from '../../src/shared/i18n.js';
import { ConversationTimeline } from '../../src/features/conversation/ConversationTimeline.jsx';
import { ComposerInput } from '../../src/features/chat/ComposerInput.jsx';
import { ComposerContextUsage } from '../../src/features/chat/ComposerContextUsage.jsx';
import brandMark from '../../src/assets/brand/brand-blue.png';

function Fixture() {
  const [running, setRunning] = useState(true);
  const [failed, setFailed] = useState(false);
  const [extraProcessItems, setExtraProcessItems] = useState([]);
  const [value, setValue] = useState('/视觉设计 /数据库操作 ');
  const [tokens, setTokens] = useState({ input: 48400, max: 300000 });
  window.__presentation = {
    complete: () => setRunning(false),
    fail: () => setFailed(true),
    setTokens,
    appendProcessItems: (count = 1) => setExtraProcessItems(current => [
      ...current,
      ...Array.from({ length: count }, (_, index) => ({
        id: `extra-${current.length + index}`,
        type: 'reasoning',
        text: `新增思考 ${current.length + index + 1}`,
        status: 'completed',
        startedAt: 8000 + current.length + index,
        completedAt: 9000 + current.length + index,
      })),
    ]),
  };
  const turn = {
    id: 'fixture', status: running ? 'running' : 'completed', startedAt: 1000, completedAt: running ? null : 17000,
    userText: '帮我整理一份事务型通知，说明应该包含哪些内容。',
    presentation: [
      { id: 'reason-1', type: 'reasoning', text: '先阅读要求，再提取通知的基本结构。', status: 'completed', startedAt: 1000, completedAt: 4000 },
      { id: 'tools', type: 'tool_group', items: [{ id: 'file', type: 'tool', status: failed ? 'failed' : running ? 'in_progress' : 'completed', startedAt: 4000, completedAt: 7000, tool: { name: 'File', title: '读取通知模板', kind: 'File', rawInput: { path: '通知.md' }, rawOutput: failed ? 'File not found' : '已读取模板内容' } }] },
      { id: 'reason-2', type: 'reasoning', text: '根据通知要素组织正文。', status: 'completed', startedAt: 7000, completedAt: 14000 },
      ...extraProcessItems,
      { id: 'answer', type: 'agent_message', status: 'completed', phase: 'final', text: '事务型通知通常很短（200–600 字、无附件），可以按下面的结构组织。\n\n### 通知正文\n\n```text\n关于开展项目交流的通知\n\n各相关部门：\n为便于项目协作，现将有关安排通知如下。\n```\n\n写作时确认这三件事：\n\n1. **事由明确**：交代为什么发这份通知。\n2. **安排具体**：说明时间、地点和参与人员。\n3. **行动清楚**：告诉收件人下一步需要做什么。' },
    ],
  };
  return <main className="mx-auto max-w-[850px] p-5">
    <ConversationTimeline turns={[turn]} now={17000} copy={dict.zh.uiConversation}
      groupProcess
      assistantAvatar={<div className="mt-1 w-7 shrink-0"><img src={brandMark} alt="" className="h-5 w-5" /></div>} />
    <div className="mt-7 rounded-[24px] border border-black/10 p-4 shadow-sm dark:border-white/10">
      <ComposerInput data-testid="fixture-input" value={value} onChange={event => setValue(event.target.value)}
        skills={[{ title: '视觉设计' }, { title: '数据库操作' }]} maxLength={10000} placeholder={dict.zh.placeholder} className="w-full outline-none" />
      <div className="flex justify-end items-center gap-2 mt-2">
        <ComposerContextUsage tokens={tokens} copy={dict.zh.ctxUsageTooltip} /><span className="text-sm">qwen3.8-max</span>
      </div>
    </div>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
