#!/usr/bin/env node
/**
 * 输入框能力头像组 smoke：连接器显示 3 个头像和 +N，技能改用 /；检查插入与键盘行为。
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
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
].filter(Boolean);
const CHROME = process.env.CHROME ||
  chromeCandidates.find(fs.existsSync);
if (!CHROME) { console.error('SKIP: 未找到 chromium/chrome'); process.exit(2); }
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'pinvou-composer-tools-'));

function injectSource() {
  return `(function(){
    const state=window.__COMPOSER_TOOLS_TEST__={calls:[],disabled:[],disabledSkills:[],readiness:{},failSave:false,failRead:false};
    function record(cmd,args){state.calls.push({cmd,args:args||{}});}
    function invoke(cmd,args){
      record(cmd,args);
      switch(cmd){
        case 'get_settings': return Promise.resolve({theme:'liquid-light',language:'zh-Hans'});
        case 'get_effective_model_config': return Promise.resolve({model:'qwen36_35b_256k',base_url:'http://127.0.0.1:8000/v1',api_key_set:false});
        case 'list_models': return Promise.resolve({models:[{id:'qwen-local',name:'Qwen',preset:'openai_compatible',model:'qwen36_35b_256k',base_url:'http://127.0.0.1:8000/v1'}],active_model_id:'qwen-local'});
        case 'list_sessions': return Promise.resolve([]);
        case 'get_super_permission_status': return Promise.resolve(false);
        case 'list_personas': return Promise.resolve([]);
        case 'get_backend_status': return Promise.resolve({online:true,ok:true,status:'online'});
        case 'check_for_update': return Promise.resolve({available:false});
        case 'find_resumable_run': return Promise.resolve(null);
        case 'list_workspace_files': case 'get_session_persona_events': case 'get_session_pinvou_reviews': return Promise.resolve([]);
        case 'get_mode_state': return Promise.resolve({mode:'yolo',plan_phase:'none'});
        case 'get_active_persona': return Promise.resolve(null);
        case 'detect_local_vllm_setup': return Promise.resolve({eligible:false});
        case 'list_composer_connectors': case 'list_marketplace_tools': return Promise.resolve([
          {id:'feishu',name:'飞书（Lark）',installed:true,connected:true},
          {id:'ima',name:'腾讯 ima',installed:true,connected:true},
          {id:'gongwen',name:'公文写作',description:'公文工具',installed:true,connected:true,companion_skills:['government-writing']},
          {id:'weather',name:'高德天气',installed:true,connected:true},
          {id:'obsidian',name:'Obsidian',installed:true,connected:true},
          {id:'qcc',name:'企查查',installed:true,connected:true},
          {id:'pending',name:'待授权',installed:true},
        ].map(tool => ({...tool,connected:state.readiness[tool.id]??tool.connected})));
        case 'list_marketplace_skills': return Promise.resolve([
          {id:'government-writing',title:'数据库操作',description:'配套技能',installed:true,user_uploaded:false},
          {id:'visualizer',title:'数据分析可视化',description:'Chart.js 仪表盘',installed:true,user_uploaded:false},
          {id:'research',title:'深度研究',installed:true,user_uploaded:false},
          {id:'documents',title:'文档制作',installed:true,user_uploaded:false},
          {id:'spreadsheets',title:'电子表格',installed:true,user_uploaded:false},
        ]);
        case 'get_marketplace_tool_auth_status': return Promise.resolve({status:args.toolId==='pending'?'auth_pending':'connected'});
        case 'list_composer_skills': return Promise.resolve([
          {name:'visualizer',description:'数据分析可视化',aliases:['chart']},
          {name:'database-ops',title:'数据库操作',description:'数据库查询和维护',aliases:[]}
        ]);
        case 'get_disabled_connectors': {
          if(state.failRead) return Promise.reject(new Error('mock read failed'));
          const disabled=[...state.disabled];
          if(state.holdRead){state.holdRead=false;return new Promise(resolve=>{state.releaseRead=()=>resolve(disabled);});}
          return Promise.resolve(disabled);
        }
        case 'set_disabled_connectors':
          if(state.failSave) return Promise.reject(new Error('mock save failed'));
          state.disabled=(args&&args.connectorIds)||[]; return Promise.resolve(null);
        case 'get_disabled_skills': return Promise.resolve(state.disabledSkills);
        case 'set_disabled_skills': state.disabledSkills=(args&&args.skillIds)||[]; return Promise.resolve(null);
        case 'feishu_skills_state': return Promise.resolve({connected:true,enabled:true});
        case 'wecom_skills_state': case 'dingtalk_skills_state': case 'tmeet_skills_state': return Promise.resolve({connected:false,enabled:true});
        default: return Promise.resolve(null);
      }
    }
    window.__TAURI__={core:{invoke},event:{listen(){return Promise.resolve(function(){});},emit(){return Promise.resolve();}},
      window:{getCurrentWindow(){return {minimize(){},maximize(){},close(){},toggleMaximize(){},isMaximized(){return Promise.resolve(false);},onResized(){return Promise.resolve(function(){});},startDragging(){}};}},
      dialog:{open(){return Promise.resolve(null);}}};
  })();`;
}

const sleep = ms => new Promise(r => { setTimeout(r, ms); });

(async () => {
  const { url } = await startUiTestServer();
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

  const before = await page.evaluate(() => {
    const connectors = document.querySelector('[data-testid="composer-tool-menu-trigger"]');
    const skills = document.querySelector('[data-testid="composer-skill-menu-trigger"]');
    return {
      connectorButton: !!connectors,
      skillButton: !!skills,
      connectorAvatars: connectors ? connectors.querySelectorAll('span[title]').length : 0,
      skillAvatars: skills ? skills.querySelectorAll('span[title]').length : 0,
      connectorOverflow: connectors ? connectors.innerText.trim() : '',
      skillOverflow: skills ? skills.innerText.trim() : '',
      modelAfterGroups: (() => {
        const groups = document.querySelector('[data-testid="composer-capability-groups"]');
        const model = document.querySelector('[data-testid="composer-model-selector-trigger"]');
        return !!(groups && model && (groups.compareDocumentPosition(model) & Node.DOCUMENT_POSITION_FOLLOWING));
      })(),
      workModeSecond: (() => {
        const attach = document.querySelector('[data-testid="composer-attach-trigger"]');
        const mode = document.querySelector('[data-testid="composer-mode-trigger"]');
        const expert = document.querySelector('[data-testid="composer-expert-trigger"]');
        return !!(attach && mode && expert
          && (attach.compareDocumentPosition(mode) & Node.DOCUMENT_POSITION_FOLLOWING)
          && (mode.compareDocumentPosition(expert) & Node.DOCUMENT_POSITION_FOLLOWING));
      })(),
    };
  });
  rec('输入框存在连接器头像组', before.connectorButton, JSON.stringify(before));
  rec('输入框不再显示技能头像组', !before.skillButton, JSON.stringify(before));
  rec('连接器默认显示 3 个头像', before.connectorAvatars === 3, JSON.stringify(before));
  rec('连接器超出项显示 +3，包含 ima', before.connectorOverflow === '+3', JSON.stringify(before));
  rec('模型选择器位于能力组之后', before.modelAfterGroups, JSON.stringify(before));
  rec('工作模式位于添加按钮后且排在专家前', before.workModeSecond, JSON.stringify(before));

  await page.evaluate(() => document.querySelector('[data-testid="composer-tool-menu-trigger"]').click());
  await sleep(300);
  const connectorPopoverVisible = await page.evaluate(() => {
    const trigger = document.querySelector('[data-testid="composer-tool-menu-trigger"]');
    const menu = document.querySelector('[data-testid="composer-tool-menu"]');
    if (!trigger || !menu) return false;
    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    return menuRect.width > 100 && menuRect.height > 40 && menuRect.bottom <= triggerRect.top + 4;
  });
  rec('连接器弹层完整显示在输入框上方', connectorPopoverVisible);
  const connectorMenu = await page.evaluate(() => document.querySelector('[data-testid="composer-tool-menu"]')?.innerText || '');
  rec('连接器菜单可关闭并添加连接器', connectorMenu.includes('公文写作') && connectorMenu.includes('飞书') && connectorMenu.includes('添加连接器') && !connectorMenu.includes('数据分析可视化'), connectorMenu);
  rec('待授权连接器显示连接入口，不显示绿色开关', await page.$eval('[data-connector-id="pending"]', row => row.textContent.includes('待连接') && row.textContent.includes('去连接') && !row.querySelector('[role="switch"]')));

  await page.evaluate(() => document.querySelector('[data-testid="composer-tool-menu-trigger"]').click());
  await page.click('[data-testid="chat-composer-input"]');
  await page.type('[data-testid="chat-composer-input"]', '/chart');
  await page.waitForSelector('[data-testid="composer-suggestions"] [role="option"]');
  rec('/ 按技能别名筛选', await page.$eval('[data-testid="composer-suggestions"]', node => node.textContent.includes('/数据分析可视化') && !node.textContent.includes('/数据库操作')));
  await page.keyboard.press('Enter');
  rec('回车插入技能且不自动发送', await page.$eval('[data-testid="chat-composer-input"]', node => node.value === '/数据分析可视化 '));
  await page.keyboard.press('Backspace');
  rec('刚选中的技能按一次退格即可删除', await page.$eval('[data-testid="chat-composer-input"]', node => node.value === '' && !node.querySelector('[data-skill-text]')));
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  rec('删除最后一个技能后仍可撤销', await page.$eval('[data-testid="chat-composer-input"]', node => node.value === '/数据分析可视化 ' && !!node.querySelector('[data-skill-text]')));
  await page.$eval('[data-testid="chat-composer-input"]', node => node.setSelectionRange(node.value.length, node.value.length));
  rec('技能选择不修改全局开关', await page.evaluate(() => !window.__COMPOSER_TOOLS_TEST__.calls.some(call => call.cmd === 'set_disabled_connectors')));
  await page.keyboard.type('@');
  await page.waitForSelector('[data-testid="composer-suggestions"]');
  await sleep(100);
  rec('无会话文件显示空态', await page.$eval('[data-testid="composer-suggestions"]', node => node.textContent.includes('没有匹配的对话文件')));
  await page.keyboard.press('Escape');
  rec('Esc 关闭建议保留草稿', await page.$eval('[data-testid="chat-composer-input"]', node => node.value.endsWith('@')) && !await page.$('[data-testid="composer-suggestions"]'));
  const geometry = await page.evaluate(() => {
    const input = document.querySelector('[data-testid="chat-composer-input"]');
    const avatar = document.querySelector('[data-testid="composer-tool-menu-trigger"] span[title]');
    return { inputWidth: input.getBoundingClientRect().width, avatarWidth: avatar.getBoundingClientRect().width };
  });
  rec('连接器头像缩小到 24px', geometry.avatarWidth === 24, JSON.stringify(geometry));
  rec('聊天列放宽，输入区域大于 790px', geometry.inputWidth > 790, JSON.stringify(geometry));

  await page.keyboard.press('Backspace');
  await page.keyboard.type('/');
  await page.waitForSelector('[data-testid="composer-suggestions"] [role="option"]');
  const popup = await page.$eval('[data-testid="composer-suggestions"]', node => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, width: rect.width, hit: node.contains(document.elementFromPoint(rect.left + 20, rect.top + 50)) };
  });
  rec('建议弹层位于可视区域且可点击', popup.top >= 0 && popup.hit, JSON.stringify(popup));
  await page.screenshot({ path: '/tmp/fresh-composer-desktop.png' });
  await page.setViewport({ width: 390, height: 844 });
  await sleep(250);
  rec('窄屏建议弹层不溢出', await page.$eval('[data-testid="composer-suggestions"]', node => {
    const rect = node.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= window.innerWidth;
  }));
  await page.screenshot({ path: '/tmp/fresh-composer-mobile.png' });

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  rec('方向键可选择第二个中文技能', await page.$eval('[data-testid="chat-composer-input"]', node => node.value.includes('/数据库操作')));

  const inputSelector = '[data-testid="chat-composer-input"]';
  rec('多个技能显示图标和中文标签，不显示斜杠', await page.$eval(inputSelector, node => (
    node.querySelectorAll('[data-skill-text]').length === 2
    && [...node.querySelectorAll('[data-skill-text]')].every(chip => chip.querySelector('svg') && !chip.textContent.startsWith('/') && chip.contentEditable === 'false')
  )));
  await page.$eval(inputSelector, node => { node.focus(); node.setSelectionRange(0, 0); });
  await page.keyboard.type('先用');
  await page.$eval(inputSelector, node => node.setSelectionRange(node.value.length, node.value.length));
  await page.keyboard.type('处理文件');
  rec('技能前后可继续输入', await page.$eval(inputSelector, node => node.value.startsWith('先用/数据分析可视化') && node.value.endsWith('处理文件')));
  await page.$eval(inputSelector, node => {
    const end = node.value.indexOf('/数据库操作') + '/数据库操作'.length;
    node.setSelectionRange(end, end);
  });
  await page.keyboard.press('Backspace');
  rec('退格整项删除技能，保留前后文字与另一个技能', await page.$eval(inputSelector, node => node.querySelectorAll('[data-skill-text]').length === 1 && !node.value.includes('/数据库操作') && node.value.endsWith('处理文件')));
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  rec('撤销恢复技能标签', await page.$eval(inputSelector, node => node.querySelectorAll('[data-skill-text]').length === 2));
  await page.$eval(inputSelector, node => node.setSelectionRange(node.value.length, node.value.length));
  await page.keyboard.down('Shift'); await page.keyboard.press('Enter'); await page.keyboard.up('Shift');
  await page.keyboard.type('下一行');
  rec('Shift+Enter 保留换行且不会发送', await page.$eval(inputSelector, node => node.value.endsWith('处理文件\n下一行')));
  const clipboard = await page.$eval(inputSelector, node => {
    node.select();
    const data = new DataTransfer();
    node.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: data }));
    return { value: node.value, plain: data.getData('text/plain'), html: data.getData('text/html') };
  });
  rec('复制保留可调用的技能引用，去除富文本', clipboard.plain === clipboard.value && clipboard.plain.includes('/数据库操作') && !clipboard.html);
  await page.$eval(inputSelector, node => {
    node.setSelectionRange(node.value.length, node.value.length);
    const data = new DataTransfer();
    data.setData('text/plain', '\n粘贴内容');
    data.setData('text/html', '<b>不应作为富文本插入</b>');
    node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  });
  rec('粘贴只插入纯文本，保留技能标签', await page.$eval(inputSelector, node => node.value.endsWith('\n粘贴内容') && node.querySelectorAll('[data-skill-text]').length === 2 && !node.querySelector('b')));
  await page.$eval(inputSelector, node => {
    node.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    node.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
    node.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
  });
  rec('中文输入法确认不会发送草稿', await page.$eval(inputSelector, node => node.value.endsWith('粘贴内容')));
  await page.setViewport({ width: 1360, height: 900 });
  await page.$eval(inputSelector, node => node.setSelectionRange(node.value.length, node.value.length));
  await page.screenshot({ path: '/tmp/fresh-skill-chips.png' });
  await page.$eval(inputSelector, node => { node.focus(); node.select(); });
  await page.keyboard.press('Backspace');
  await page.keyboard.type('x');
  await page.keyboard.press('Backspace');
  rec('删除最后一个普通字符后恢复空输入框', await page.$eval(inputSelector, node => node.value === '' && !node.childNodes.length));

  // 连接状态与开关更改必须同时作用到菜单和头像，而不只是静态筛选头像。
  const menuTrigger = '[data-testid="composer-tool-menu-trigger"]';
  const rowSelector = '[data-connector-id="feishu"]';
  const readConnectors = () => page.evaluate(() => {
    const trigger = document.querySelector('[data-testid="composer-tool-menu-trigger"]');
    return {
      total: Number(trigger.title.split(' · ')[1] || 0),
      avatars: [...trigger.querySelectorAll('span[title]')].map(node => node.title),
      checked: document.querySelector('[data-connector-id="feishu"] [role="switch"]')?.getAttribute('aria-checked'),
      row: document.querySelector('[data-connector-id="feishu"]')?.textContent,
    };
  });
  await page.click(menuTrigger);
  await page.waitForSelector(`${rowSelector} [role="switch"]`);
  await page.click(`${rowSelector} [role="switch"]`);
  await page.waitForFunction(() => document.querySelector('[data-connector-id="feishu"] [role="switch"]')?.getAttribute('aria-checked') === 'false');
  let connectorState = await readConnectors();
  rec('关闭连接器同时移除头像、更新数量和菜单状态', connectorState.total === 5 && !connectorState.avatars.some(name => name.includes('飞书')) && connectorState.row.includes('已关闭'), JSON.stringify(connectorState));
  await page.click(`${rowSelector} [role="switch"]`);
  await page.waitForFunction(() => document.querySelector('[data-connector-id="feishu"] [role="switch"]')?.getAttribute('aria-checked') === 'true');
  connectorState = await readConnectors();
  rec('重新开启同时恢复头像与已连接状态', connectorState.total === 6 && connectorState.avatars.some(name => name.includes('飞书')) && connectorState.row.includes('已连接'), JSON.stringify(connectorState));

  await page.evaluate(() => {
    window.__COMPOSER_TOOLS_TEST__.readiness.feishu = false;
    window.dispatchEvent(new Event('pinvou:tools-changed'));
  });
  await page.waitForFunction(() => document.querySelector('[data-connector-id="feishu"]')?.textContent.includes('待连接'));
  connectorState = await readConnectors();
  rec('失去授权同步撤下头像并显示待连接', connectorState.total === 5 && connectorState.checked === undefined && !connectorState.avatars.some(name => name.includes('飞书')), JSON.stringify(connectorState));
  rec('连接失效不改写用户保存的开关', await page.evaluate(() => !window.__COMPOSER_TOOLS_TEST__.disabled.includes('feishu')));
  await page.evaluate(() => {
    window.__COMPOSER_TOOLS_TEST__.readiness.feishu = true;
    window.dispatchEvent(new Event('pinvou:tools-changed'));
  });
  await page.waitForFunction(() => document.querySelector('[data-connector-id="feishu"] [role="switch"]')?.getAttribute('aria-checked') === 'true');
  connectorState = await readConnectors();
  rec('授权完成事件同步恢复头像和绿色开关', connectorState.total === 6 && connectorState.avatars.some(name => name.includes('飞书')));

  await page.click(menuTrigger);
  await page.evaluate(() => { window.__COMPOSER_TOOLS_TEST__.disabled = ['feishu']; });
  await page.click(menuTrigger);
  await page.waitForFunction(() => document.querySelector('[data-connector-id="feishu"] [role="switch"]')?.getAttribute('aria-checked') === 'false');
  connectorState = await readConnectors();
  rec('重新打开菜单会读取外部修改的开关状态', connectorState.total === 5 && connectorState.row.includes('已关闭'));

  await page.evaluate(() => { window.__COMPOSER_TOOLS_TEST__.failSave = true; });
  await page.click(`${rowSelector} [role="switch"]`);
  await page.waitForFunction(() => document.querySelector('[data-testid="composer-tool-menu"] [role="alert"]')?.textContent.includes('更新失败'));
  connectorState = await readConnectors();
  rec('保存失败保留原开关和头像，并提示错误', connectorState.total === 5 && connectorState.checked === 'false');
  await page.evaluate(() => { window.__COMPOSER_TOOLS_TEST__.failSave = false; });

  // 模拟旧刷新慢于新事件返回：不能混用就绪状态与旧开关，也不能覆盖新状态。
  await page.evaluate(() => {
    const state = window.__COMPOSER_TOOLS_TEST__;
    state.readiness.feishu = false;
    state.holdRead = true;
    window.dispatchEvent(new Event('pinvou:tools-changed'));
  });
  await page.waitForFunction(() => !!window.__COMPOSER_TOOLS_TEST__.releaseRead);
  await sleep(100);
  connectorState = await readConnectors();
  rec('同轮状态未收齐前保留完整旧快照', connectorState.checked === 'false' && connectorState.row.includes('已关闭'));
  await page.evaluate(() => {
    const state = window.__COMPOSER_TOOLS_TEST__;
    state.readiness.feishu = true;
    state.disabled = [];
    window.dispatchEvent(new Event('pinvou:tools-changed'));
  });
  await page.waitForFunction(() => document.querySelector('[data-connector-id="feishu"] [role="switch"]')?.getAttribute('aria-checked') === 'true');
  await page.evaluate(() => { window.__COMPOSER_TOOLS_TEST__.releaseRead(); });
  await sleep(100);
  connectorState = await readConnectors();
  rec('旧请求晚返回不会覆盖新开关或移除头像', connectorState.checked === 'true' && connectorState.total === 6);

  await page.evaluate(() => {
    window.__COMPOSER_TOOLS_TEST__.failRead = true;
    window.dispatchEvent(new Event('pinvou:tools-changed'));
  });
  await page.waitForFunction(() => document.querySelector('[data-testid="composer-tool-menu"]')?.textContent.includes('状态刷新失败'));
  connectorState = await readConnectors();
  rec('刷新失败保留上次状态并提示，避免假开关', connectorState.checked === 'true' && connectorState.total === 6);
  await page.evaluate(() => { window.__COMPOSER_TOOLS_TEST__.failRead = false; });
  await page.click(menuTrigger);
  await page.click(menuTrigger);
  await page.waitForFunction(() => !document.querySelector('[data-testid="composer-tool-menu"]')?.textContent.includes('状态刷新失败'));
  await page.screenshot({ path: '/tmp/fresh-connector-status-sync.png' });

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
