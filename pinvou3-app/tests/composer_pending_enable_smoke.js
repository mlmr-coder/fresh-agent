#!/usr/bin/env node
/**
 * 普通聊天能力开关与轮次提交 smoke：
 * - 活动会话中的连接器都能随时关闭；
 * - 活动会话中打开连接器，真实发送一轮后仍可关闭；
 * - 发送失败（mock 后端拒绝）→ 不派发提交事件，开关保持可改回；
 * - 菜单组件随切页卸载期间新一轮被受理（排队消息 flush 场景）后，
 *   重挂载仍保持正确的启用状态和可操作性。
 * 依赖先运行 `npm run build:ui`。
 */
const fs = require('fs'), path = require('path'), os = require('os');
const { startUiTestServer } = require('./ui_test_server');

function loadPuppeteer() {
  try { return require('puppeteer-core'); } catch { /* fall through */ }
  const npx = path.join(os.homedir(), '.npm', '_npx');
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) {
    const p = path.join(npx, d, 'node_modules', 'puppeteer-core');
    if (fs.existsSync(p)) try { return require(p); } catch { /* next */ }
  }
  console.error('SKIP: 找不到 puppeteer-core');
  process.exit(2);
}

const puppeteer = loadPuppeteer();
const chromeCandidates = [
  '/snap/bin/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'msedge.exe'),
].filter(Boolean);
const CHROME = process.env.CHROME ||
  chromeCandidates.find(fs.existsSync);
if (!CHROME) { console.error('SKIP: 未找到 chromium/chrome'); process.exit(2); }
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'pinvou-pending-enable-'));

function injectSource() {
  return `(function(){
    const state=window.__PENDING_ENABLE_TEST__={calls:[],disabled:['weather','obsidian'],committedEvents:0,chatShouldFail:false,chatDoneScheduled:false,holdChatDone:false};
    window.addEventListener('pinvou:chat-round-committed',()=>{state.committedEvents+=1;});
    function record(cmd,args){state.calls.push({cmd,args:args||{}});}
    // 真实事件注册表:mock 后端在 chat 受理后补发 chat:done,驱动 bridge 复位
    // busy(chat-events.js 在 chat:done 里 state.busy=false),排队/多轮发送才走得通。
    const listeners=new Map();
    function emitTauri(name,payload){ (listeners.get(name)||[]).forEach(fn=>{try{fn({event:name,payload:payload});}catch(_){}}); }
    window.__EMIT_TAURI__=emitTauri;
    const session={id:'s1',title:'S1',created_at:1,updated_at:1};
    const personas=[
      {id:'expert-a',name:'专家甲',description:'甲领域专家',dept:'engineering',source:'builtin'},
      {id:'expert-b',name:'专家乙',description:'乙领域专家',dept:'design',source:'builtin'},
    ];
    function invoke(cmd,args){
      record(cmd,args);
      switch(cmd){
        case 'chat':
          if(state.chatShouldFail) return Promise.reject(new Error('mock_backend_unavailable'));
          // 受理后异步补一个 chat:done(真实后端语义:done 表示本轮跑完、busy 复位)。
          if(!state.chatDoneScheduled&&!state.holdChatDone){
            state.chatDoneScheduled=true;
            Promise.resolve().then(()=>{state.chatDoneScheduled=false;emitTauri('chat:done',{session_id:(args&&args.sessionId)||'s1'});});
          }
          return Promise.resolve(null);
        case 'get_settings': return Promise.resolve({theme:'liquid-light',language:'zh-Hans'});
        case 'get_effective_model_config': return Promise.resolve({model:'qwen36_35b_256k',base_url:'http://127.0.0.1:8000/v1',api_key_set:true});
        case 'list_sessions': return Promise.resolve([session]);
        case 'load_session': return Promise.resolve({metadata:session,messages:[],artifacts:[]});
        case 'get_super_permission_status': return Promise.resolve(false);
        case 'list_personas': return Promise.resolve(personas);
        case 'equip_persona': return Promise.resolve(personas.find(item=>item.id===(args&&args.personaId))||null);
        case 'unequip_persona': return Promise.resolve(null);
        case 'get_backend_status': return Promise.resolve({online:true,ok:true,status:'online'});
        case 'check_for_update': return Promise.resolve({available:false});
        case 'find_resumable_run': return Promise.resolve(null);
        case 'list_workspace_files': case 'get_session_persona_events': case 'get_session_pinvou_reviews': case 'get_session_timeline': return Promise.resolve([]);
        case 'get_mode_state': return Promise.resolve({mode:'yolo',plan_phase:'none'});
        case 'get_active_persona': return Promise.resolve(null);
        case 'detect_local_vllm_setup': return Promise.resolve({eligible:false});
        case 'list_composer_connectors': case 'list_marketplace_tools': return Promise.resolve([
          {id:'gongwen',name:'公文写作',description:'公文工具',installed:true,connected:true},
          {id:'weather',name:'天气',installed:true,connected:true}, {id:'obsidian',name:'Obsidian',installed:true,connected:true},
        ]);
        case 'list_marketplace_skills': return Promise.resolve([
          {id:'weather',title:'数据分析可视化',description:'Chart.js 仪表盘',installed:true,user_uploaded:false},
          {id:'obsidian',title:'文档撰写',description:'撰写文档',installed:true,user_uploaded:false},
        ]);
        case 'list_composer_skills': return Promise.resolve([{name:'visualizer',description:'数据可视化',aliases:[]}]);
        case 'list_composer_files': return Promise.resolve([{name:'报告 1.csv',path:'/conversation/attachments/报告 1.csv'}]);
        case 'get_marketplace_tool_auth_status': return Promise.resolve({status:'connected'});
        case 'get_disabled_connectors': return Promise.resolve(state.disabled);
        case 'set_disabled_connectors': state.disabled=(args&&args.connectorIds)||[]; return Promise.resolve(null);
        case 'get_disabled_skills': return Promise.resolve([]);
        case 'get_bundle_visibility': return Promise.resolve([]);
        case 'feishu_skills_state': case 'wecom_skills_state': case 'dingtalk_skills_state': case 'tmeet_skills_state': return Promise.resolve({connected:false,enabled:true});
        default: return Promise.resolve(null);
      }
    }
    window.__TAURI__={core:{invoke},event:{listen(name,fn){const arr=listeners.get(name)||[];arr.push(fn);listeners.set(name,arr);return Promise.resolve(function(){const cur=listeners.get(name)||[];const i=cur.indexOf(fn);if(i>=0){cur.splice(i,1);listeners.set(name,cur);}});},emit(){return Promise.resolve();}},
      window:{getCurrentWindow(){return {minimize(){},maximize(){},close(){},toggleMaximize(){},isMaximized(){return Promise.resolve(false);},onResized(){return Promise.resolve(function(){});},startDragging(){}};}},
      dialog:{open(){return Promise.resolve(null);}}};
  })();`;
}

const sleep = ms => new Promise(r => { setTimeout(r, ms); });

(async () => {
  // 默认用构建产物起本地服务；设 PINVOU3_TEST_URL 可直接打正在运行的 dev server。
  const externalUrl = process.env.PINVOU3_TEST_URL || '';
  const { url } = externalUrl ? { url: externalUrl } : await startUiTestServer();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--no-first-run'], userDataDir: PROFILE });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument(injectSource());
  await page.setViewport({ width: 1360, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await sleep(1500);

  const results = [];
  const rec = (name, pass, detail = '') => { results.push({ name, pass }); console.log(`${pass ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`); };
  const readSwitch = () => page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="weather"]');
    return btn ? { disabled: btn.disabled, on: btn.className.includes('bg-[#34C759]') } : null;
  });
  const openMenu = async () => { await page.evaluate(() => document.querySelector('[data-testid="composer-tool-menu-trigger"]').click()); await sleep(300); };
  const closeMenu = async () => { await page.evaluate(() => document.querySelector('[data-testid="composer-tool-menu-trigger"]').click()); await sleep(200); };
  const openConnectors = async () => { await page.evaluate(() => document.querySelector('[data-testid="composer-tool-menu-trigger"]').click()); await sleep(300); };
  const closeConnectors = async () => { await page.evaluate(() => document.querySelector('[data-testid="composer-tool-menu-trigger"]').click()); await sleep(200); };

  // 建立活动会话，覆盖用户截图里的“聊天已经开始”状态。
  await page.evaluate(() => window.TauriBridge.sessions.switchToSession('s1'));
  await sleep(600);
  const active = await page.evaluate(() => (window.TauriBridge.state.get('sessions') || {}).activeSessionId);
  rec('活动会话已建立', active === 's1', String(active));

  await page.click('[data-testid="chat-composer-input"]');
  await page.type('[data-testid="chat-composer-input"]', '帮我/vis');
  await page.waitForSelector('[data-testid="composer-suggestions"] [role="option"]');
  await page.keyboard.press('Tab');
  await page.keyboard.type('@');
  await page.waitForSelector('[data-testid="composer-suggestions"] [role="option"]');
  await page.keyboard.press('Enter');
  const selectedDraft = await page.$eval('[data-testid="chat-composer-input"]', node => node.value);
  rec('本轮技能与文件引用插入草稿，文件空格保持完整', selectedDraft.startsWith('帮我/数据分析可视化') && selectedDraft.includes('@/') === false && selectedDraft.includes('报告 1.csv'));
  rec('选择建议时没有发送消息', await page.evaluate(() => !window.__PENDING_ENABLE_TEST__.calls.some(call => call.cmd === 'chat')));
  await page.keyboard.type('分析这份文件');
  await page.keyboard.press('Enter');
  await sleep(400);
  const sentDraft = await page.evaluate(() => window.__PENDING_ENABLE_TEST__.calls.find(call => call.cmd === 'chat')?.args.message);
  rec('发送保留技能名称和准确文件路径', !!sentDraft && sentDraft.includes('/数据分析可视化') && sentDraft.includes('/conversation/attachments/报告 1.csv') && sentDraft.includes('分析这份文件'), String(sentDraft));
  rec('发送后草稿清空，不残留技能挂载', await page.$eval('[data-testid="chat-composer-input"]', node => node.value === ''));

  const selectExpert = async (name) => {
    await page.evaluate(() => document.querySelector('[data-testid="composer-expert-trigger"]').click());
    await page.waitForSelector('[data-testid="capability-center"]');
    await sleep(250);
    await page.evaluate((expertName) => {
      const heading = [...document.querySelectorAll('h2')].find(node => node.textContent.trim() === expertName);
      const row = heading && heading.closest('.group');
      const action = row && row.querySelector('button');
      if (!action) throw new Error('expert action not found: ' + expertName);
      action.click();
    }, name);
    await page.waitForSelector('[data-testid="chat-composer-input"]');
    await sleep(250);
  };
  await selectExpert('专家甲');
  const firstExpertReturn = await page.evaluate(() => document.querySelector('[data-testid="composer-expert-trigger"]')?.getAttribute('aria-label'));
  rec('第一次选择专家后返回聊天', firstExpertReturn === '专家甲', String(firstExpertReturn));
  await selectExpert('专家乙');
  const secondExpertReturn = await page.evaluate(() => document.querySelector('[data-testid="composer-expert-trigger"]')?.getAttribute('aria-label'));
  rec('再次选择专家后仍返回聊天', secondExpertReturn === '专家乙', String(secondExpertReturn));

  const expertCloseBeforeHover = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="composer-expert-remove"]');
    return button ? Number(getComputedStyle(button).opacity) : -1;
  });
  await page.hover('[data-testid="composer-expert-trigger"]');
  await sleep(200);
  const expertCloseAfterHover = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="composer-expert-remove"]');
    return button ? Number(getComputedStyle(button).opacity) : -1;
  });
  rec('专家取消按钮默认隐藏并在悬停时显示', expertCloseBeforeHover === 0 && expertCloseAfterHover === 1, `${expertCloseBeforeHover} -> ${expertCloseAfterHover}`);
  await page.evaluate(() => document.querySelector('[data-testid="composer-expert-remove"]').click());
  await sleep(250);
  const expertRemoved = await page.evaluate(() => {
    const sessions = window.TauriBridge.state.get('sessions') || {};
    return !sessions.activePersona && !document.querySelector('[data-testid="composer-expert-remove"]');
  });
  rec('专家取消按钮可卸下当前专家', expertRemoved);

  await openConnectors();
  const connectorBefore = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="gongwen"]');
    return btn ? { disabled: btn.disabled, on: btn.className.includes('bg-[#34C759]') } : null;
  });
  rec('活动会话中的连接器可以关闭', !!connectorBefore && connectorBefore.on && !connectorBefore.disabled, JSON.stringify(connectorBefore));
  await page.evaluate(() => document.querySelector('button[aria-label="gongwen"]').click());
  await sleep(200);
  const connectorAfter = await page.evaluate(() => {
    const state = window.__PENDING_ENABLE_TEST__;
    const btn = document.querySelector('button[aria-label="gongwen"]');
    return btn ? { disabled: btn.disabled, on: btn.className.includes('bg-[#34C759]'), persisted: state.disabled.includes('gongwen') } : null;
  });
  rec('关闭连接器后立即生效并持久化', !!connectorAfter && !connectorAfter.on && !connectorAfter.disabled && connectorAfter.persisted, JSON.stringify(connectorAfter));
  await closeConnectors();

  // 当前轮次已提交后，能力表无法追回这一轮：处理中锁定连接器/连接器，结束后恢复。
  await page.evaluate(() => {
    window.__PENDING_ENABLE_TEST__.holdChatDone = true;
    return window.TauriBridge.chat.sendMessage('busy-capability-lock');
  });
  await sleep(300);
  const busyCapabilityLock = await page.evaluate(() => ({
    connectors: document.querySelector('[data-testid="composer-tool-menu-trigger"]')?.disabled,
    skills: document.querySelector('[data-testid="composer-tool-menu-trigger"]')?.disabled,
  }));
  rec('当前轮次处理中连接器不可修改', busyCapabilityLock.connectors === true && busyCapabilityLock.skills === true, JSON.stringify(busyCapabilityLock));
  await page.evaluate(() => {
    window.__PENDING_ENABLE_TEST__.holdChatDone = false;
    window.__EMIT_TAURI__('chat:done', { session_id: 's1' });
  });
  await sleep(300);
  const capabilityLockReleased = await page.evaluate(() => ({
    connectors: document.querySelector('[data-testid="composer-tool-menu-trigger"]')?.disabled,
    skills: document.querySelector('[data-testid="composer-tool-menu-trigger"]')?.disabled,
  }));
  rec('当前轮次结束后连接器恢复可修改', capabilityLockReleased.connectors === false && capabilityLockReleased.skills === false, JSON.stringify(capabilityLockReleased));

  // ---- 场景一：会话中打开 → 发送受理后仍可关闭 ----
  await openMenu();
  const before = await readSwitch();
  rec('初始为关且开关可点（允许打开）', !!before && !before.on && !before.disabled, JSON.stringify(before));

  await page.evaluate(() => document.querySelector('button[aria-label="weather"]').click());
  await sleep(300);
  const afterEnable = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="weather"]');
    const state = window.__PENDING_ENABLE_TEST__;
    return btn ? { disabled: btn.disabled, on: btn.className.includes('bg-[#34C759]'), persisted: !state.disabled.includes('weather') } : null;
  });
  rec('打开后可以立即改回', !!afterEnable && afterEnable.on && !afterEnable.disabled, JSON.stringify(afterEnable));
  rec('打开已持久化到禁用集之外', !!afterEnable && afterEnable.persisted);

  await closeMenu();
  await page.evaluate(() => window.TauriBridge.chat.sendMessage('hello'));
  await sleep(600);
  const committed = await page.evaluate(() => window.__PENDING_ENABLE_TEST__.committedEvents);
  rec('发送后轮次提交事件已派发', committed >= 1, `events=${committed}`);

  await openMenu();
  const afterSend = await readSwitch();
  rec('普通聊天发送新一轮后连接器仍可关闭', !!afterSend && afterSend.on && !afterSend.disabled, JSON.stringify(afterSend));
  await closeMenu();

  // ---- 场景二：发送失败（后端拒绝）→ 不派发提交事件，未提交的「打开」保持可改回 ----
  // 用第二个连接器（obsidian）隔离发送失败场景。
  await page.evaluate(() => { window.__PENDING_ENABLE_TEST__.chatShouldFail = true; });
  await openMenu();
  const docBefore = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="obsidian"]');
    return btn ? { disabled: btn.disabled, on: btn.className.includes('bg-[#34C759]') } : null;
  });
  rec('obsidian 初始为关且开关可点', !!docBefore && !docBefore.on && !docBefore.disabled, JSON.stringify(docBefore));

  await page.evaluate(() => document.querySelector('button[aria-label="obsidian"]').click()); // 打开 → pending
  await sleep(300);
  const docEnabled = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="obsidian"]');
    return btn ? { disabled: btn.disabled, on: btn.className.includes('bg-[#34C759]') } : null;
  });
  rec('打开后仍可立即改回', !!docEnabled && docEnabled.on && !docEnabled.disabled, JSON.stringify(docEnabled));
  await closeMenu();

  const committedBeforeFail = await page.evaluate(() => window.__PENDING_ENABLE_TEST__.committedEvents);
  await page.evaluate(() => window.TauriBridge.chat.sendMessage('will-fail').then(
    () => { throw new Error('send should have failed'); },
    () => 'failed-as-expected' // main-path failures now reject to the caller (review fix: failures propagate; the caller restores the composer)
  ));
  await sleep(600);
  const afterFail = await page.evaluate(() => window.__PENDING_ENABLE_TEST__.committedEvents);
  rec('发送失败不派发提交事件（failed sends never commit）', afterFail === committedBeforeFail, `before=${committedBeforeFail} after=${afterFail}`);
  await openMenu();
  const stillPending = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="obsidian"]');
    return btn ? { disabled: btn.disabled, on: btn.className.includes('bg-[#34C759]') } : null;
  });
  rec('发送失败后开关仍可改回', !!stillPending && stillPending.on && !stillPending.disabled, JSON.stringify(stillPending));
  await page.evaluate(() => document.querySelector('button[aria-label="obsidian"]').click()); // 改回（关）→ pending 撤销
  await sleep(300);
  const docReverted = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="obsidian"]');
    const state = window.__PENDING_ENABLE_TEST__;
    return btn ? { disabled: btn.disabled, on: btn.className.includes('bg-[#34C759]'), persisted: state.disabled.includes('obsidian') } : null;
  });
  rec('失败后改回成功且已持久化回禁用集', !!docReverted && !docReverted.on && !docReverted.disabled && docReverted.persisted, JSON.stringify(docReverted));
  await closeMenu();
  await page.evaluate(() => { window.__PENDING_ENABLE_TEST__.chatShouldFail = false; });

  // ---- 场景三：菜单组件随切页卸载期间新一轮被受理 → 重挂载后状态正确 ----
  // 用户打开开关（pending）→ 切到设置页（ChatView 连带菜单卸载、组件级监听移除）
  // → 后台发送被受理（commit 事件落在无组件监听的 window 上）→ 切回聊天页
  // → 重挂载后启用状态保留，并且普通聊天仍可关闭。
  await openMenu();
  await page.evaluate(() => document.querySelector('button[aria-label="obsidian"]').click());
  await sleep(300);
  await closeMenu();
  await page.evaluate(() => [...document.querySelectorAll('[data-testid="nav-settings"]')].pop().click());
  await sleep(600);
  const menuGone = await page.evaluate(() => !document.querySelector('button[aria-label="obsidian"]'));
  rec('设置页下聊天组件已卸载（监听不在场）', menuGone);
  await page.evaluate(() => window.TauriBridge.chat.sendMessage('committed-while-away'));
  await sleep(600);
  const awayCommitted = await page.evaluate(() => window.__PENDING_ENABLE_TEST__.committedEvents);
  rec('卸载期间受理的轮次已派发提交事件', awayCommitted >= 2, `events=${awayCommitted}`);
  await page.evaluate(() => document.querySelector('[data-testid="settings-close"]').click());
  await sleep(600);
  await openMenu();
  const afterRemount = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="obsidian"]');
    return btn ? { disabled: btn.disabled, on: btn.className.includes('bg-[#34C759]') } : null;
  });
  rec('重挂载后连接器保持启用且仍可关闭', !!afterRemount && afterRemount.on && !afterRemount.disabled, JSON.stringify(afterRemount));
  await closeMenu();

  rec('页面无未处理 JavaScript 异常', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const failed = results.filter(r => !r.pass).length;
  console.log(failed ? `\n❌ ${failed}/${results.length} FAILED` : `\n✅ ALL ${results.length} PASS`);
  process.exit(failed ? 1 : 0);
// eslint-disable-next-line unicorn/prefer-top-level-await -- smoke script keeps its existing async main() structure
})().catch(e => {
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch { /* profile dir already gone */ }
  console.error('FATAL', e.stack || e);
  process.exit(1);
});
