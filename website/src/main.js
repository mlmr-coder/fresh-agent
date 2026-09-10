import './styles.css';

const REPOSITORY_URL = 'https://github.com/mlmr-coder/fresh-agent';
const RELEASES_URL = `${REPOSITORY_URL}/releases`;

const icon = (name, className = '') => `
  <svg class="icon ${className}" aria-hidden="true">
    <use href="#icon-${name}"></use>
  </svg>
`;

const modes = {
  work: {
    eyebrow: '工作模式',
    title: '把资料变成清晰的决策',
    description: '处理文档、表格、调研和日常业务任务，最后交付可以继续使用的文件。',
    prompt: '分析这份销售表，找出增长最快的区域，并生成一页简报。',
    skill: '数据分析可视化',
    result: '华东区域增长最快',
    metric: '+28.6%',
    steps: ['读取并核对 2,846 行数据', '调用数据分析技能', '生成图表与结论摘要'],
  },
  design: {
    eyebrow: '设计模式',
    title: '从一句想法到可编辑视觉',
    description: '生成网页、海报和数据可视化，并在设计画布中继续调整。',
    prompt: '为新品做一张简洁、有未来感的发布海报，给我三个视觉方向。',
    skill: '视觉设计',
    result: '发布视觉方案 B',
    metric: '3 个方案',
    steps: ['建立视觉方向与信息层级', '生成三版可编辑方案', '整理字体、配色与素材'],
  },
  code: {
    eyebrow: '代码模式',
    title: '在真实项目中完成代码变更',
    description: '通过 ACP 接入代码 Agent，读取仓库、修改文件并运行验证。',
    prompt: '检查登录流程，修复页面刷新后会话状态丢失的问题。',
    skill: '代码实现',
    result: '登录状态已修复',
    metric: '6 tests',
    steps: ['读取项目结构与会话逻辑', '修改状态恢复流程', '运行测试并检查变更'],
  },
};

document.querySelector('#app').innerHTML = `
  <svg class="svg-sprite" aria-hidden="true">
    <symbol id="icon-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
    <symbol id="icon-download" viewBox="0 0 24 24"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 20h14"/></symbol>
    <symbol id="icon-github" viewBox="0 0 24 24"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7A5.4 5.4 0 0 0 19.4 4 5 5 0 0 0 19.3.5S18.2.1 15 2a13.4 13.4 0 0 0-7 0C4.8.1 3.7.5 3.7.5A5 5 0 0 0 3.6 4a5.4 5.4 0 0 0-1.4 3.7c0 5.3 3.5 6.5 6.8 6.9A4.8 4.8 0 0 0 8 18v4M8 19c-3 .9-3-1.5-4-2"/></symbol>
    <symbol id="icon-shield" viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z"/><path d="m9 12 2 2 4-4"/></symbol>
    <symbol id="icon-sparkles" viewBox="0 0 24 24"><path d="m12 3-1.5 4.5L6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5L12 3Z"/><path d="m5 15-.8 2.2L2 18l2.2.8L5 21l.8-2.2L8 18l-2.2-.8L5 15Zm14-2-1 3-3 1 3 1 1 3 1-3 3-1-3-1-1-3Z"/></symbol>
    <symbol id="icon-plug" viewBox="0 0 24 24"><path d="m12 22 4-4-3-3 5-5-4-4-5 5-3-3-4 4 10 10Z"/><path d="m14 6 3-3m1 6 3-3"/></symbol>
    <symbol id="icon-database" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></symbol>
    <symbol id="icon-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></symbol>
    <symbol id="icon-file" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8m-8 4h6"/></symbol>
    <symbol id="icon-code" viewBox="0 0 24 24"><path d="m8 9-4 3 4 3m8-6 4 3-4 3m-2-9-4 12"/></symbol>
    <symbol id="icon-image" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></symbol>
    <symbol id="icon-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
    <symbol id="icon-x" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></symbol>
  </svg>

  <header class="site-header" data-header>
    <div class="container header-inner">
      <a class="brand" href="#top" aria-label="智灵首页">
        <img src="./icon.png" alt="" width="42" height="42" />
        <span><strong>智灵</strong><small>开源桌面 AI Agent</small></span>
      </a>
      <nav class="desktop-nav" aria-label="主要导航">
        <a href="#modes">工作模式</a>
        <a href="#capabilities">核心能力</a>
        <a href="#workflow">如何工作</a>
        <a href="#open-source">开源</a>
      </nav>
      <div class="header-actions">
        <a class="icon-button" href="${REPOSITORY_URL}" target="_blank" rel="noreferrer" aria-label="在 GitHub 查看源码">${icon('github')}</a>
        <a class="button button-dark header-download" href="${RELEASES_URL}" target="_blank" rel="noreferrer">免费下载</a>
        <button class="icon-button menu-button" type="button" aria-label="打开菜单" aria-expanded="false" data-menu-button>${icon('menu')}</button>
      </div>
    </div>
    <nav class="mobile-nav" aria-label="移动端导航" data-mobile-nav>
      <a href="#modes">工作模式</a><a href="#capabilities">核心能力</a><a href="#workflow">如何工作</a><a href="#open-source">开源</a>
      <a class="button button-dark" href="${RELEASES_URL}" target="_blank" rel="noreferrer">免费下载</a>
    </nav>
  </header>

  <main id="main">
    <section class="hero section" id="top">
      <div class="hero-glow hero-glow-one"></div><div class="hero-glow hero-glow-two"></div>
      <div class="container hero-grid">
        <div class="hero-copy reveal">
          <span class="eyebrow"><i></i>面向工作、设计与代码</span>
          <h1>把你的工作，<br /><em>交给真正会动手的 AI。</em></h1>
          <p>智灵会理解任务、调用技能与连接器、处理文件，并把结果变成可以继续使用的交付物。</p>
          <div class="hero-actions">
            <a class="button button-primary" href="${RELEASES_URL}" target="_blank" rel="noreferrer">${icon('download')}免费下载<span>macOS · Windows · Linux</span></a>
            <a class="button button-light" href="${REPOSITORY_URL}" target="_blank" rel="noreferrer">${icon('github')}查看源代码</a>
          </div>
          <div class="hero-trust"><span>${icon('shield')}本地优先</span><span>${icon('sparkles')}能力可扩展</span><span>${icon('database')}模型由你选择</span></div>
        </div>
        <div class="product-stage reveal reveal-delay">
          <div class="app-window">
            <div class="window-bar"><span class="traffic"><i></i><i></i><i></i></span><strong>智灵</strong><div class="window-modes"><b>工作</b><span>设计</span><span>代码</span></div></div>
            <div class="window-content">
              <aside class="mock-sidebar"><small>今天</small><b>季度销售分析</b><span>产品发布海报</span><span>登录状态修复</span><span>整理会议纪要</span><button type="button">＋ 新建任务</button></aside>
              <div class="mock-chat">
                <div class="mock-user" data-mock-prompt>${modes.work.prompt}</div>
                <div class="mock-run"><div class="mock-run-title"><img src="./icon.png" alt="" /><b>智灵正在工作</b><span>12 秒</span></div><div class="mock-step done"><i>✓</i><span data-step="0">${modes.work.steps[0]}</span></div><div class="mock-step done"><i>✓</i><span data-step="1">${modes.work.steps[1]}</span></div><div class="mock-step active"><i></i><span data-step="2">${modes.work.steps[2]}</span></div></div>
                <div class="mock-result"><div><small>关键发现</small><h3 data-mock-result>${modes.work.result}</h3><strong data-mock-metric>${modes.work.metric}</strong></div><div class="mini-bars"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
                <div class="mock-composer"><span>${icon('sparkles')}<b data-mock-skill>${modes.work.skill}</b></span><div class="connector-dots"><i>飞</i><i>知</i><i>本</i></div><small>qwen3.8-max</small></div>
              </div>
            </div>
          </div>
          <div class="stage-note stage-note-top">${icon('plug')}<span><b>连接器在线</b><small>飞书 · 知识库 · 本地文件</small></span></div>
          <div class="stage-note stage-note-bottom">${icon('file')}<span><b>简报已生成</b><small>销售分析简报.pdf</small></span></div>
        </div>
      </div>
    </section>

    <section class="proof-bar" aria-label="产品特点">
      <div class="container proof-grid"><div><b>开源透明</b><span>MIT License</span></div><div><b>本地优先</b><span>运行数据留在设备</span></div><div><b>模型自由</b><span>本地或云端模型</span></div><div><b>真实交付</b><span>文件、网页与代码</span></div></div>
    </section>

    <section class="section modes-section" id="modes">
      <div class="container">
        <div class="section-heading reveal"><div><span class="section-label">ONE DESKTOP, THREE MODES</span><h2>同一个智灵，<br />应对不同工作。</h2></div><p>工作、设计与代码共享同一套会话基础，任务可以自然跨越资料、视觉和真实项目。</p></div>
        <div class="mode-layout reveal">
          <div class="mode-tabs" role="tablist" aria-label="选择工作模式">
            <button class="active" type="button" role="tab" aria-selected="true" data-mode="work"><span>01</span><div><b>工作模式</b><small>资料 · 文档 · 表格 · 调研</small></div>${icon('arrow')}</button>
            <button type="button" role="tab" aria-selected="false" data-mode="design"><span>02</span><div><b>设计模式</b><small>网页 · 海报 · 图表 · 画布</small></div>${icon('arrow')}</button>
            <button type="button" role="tab" aria-selected="false" data-mode="code"><span>03</span><div><b>代码模式</b><small>Codex · Claude Code · Kimi</small></div>${icon('arrow')}</button>
          </div>
          <div class="mode-preview">
            <div class="mode-preview-copy"><span data-mode-eyebrow>${modes.work.eyebrow}</span><h3 data-mode-title>${modes.work.title}</h3><p data-mode-description>${modes.work.description}</p><ul><li>输入目标和相关文件</li><li>自动调用合适的能力</li><li>得到可以继续使用的结果</li></ul></div>
            <div class="mode-preview-art"><div class="report-card"><small>季度经营分析</small><strong data-preview-metric>${modes.work.metric}</strong><span>环比增长</span><div class="report-chart"><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="insight-card"><b>智灵发现</b><span data-preview-result>${modes.work.result}</span></div></div>
          </div>
        </div>
      </div>
    </section>

    <section class="section capability-section" id="capabilities">
      <div class="container">
        <div class="section-heading reveal"><div><span class="section-label">CAPABILITIES</span><h2>一套清晰、可生长的<br />Agent 能力系统。</h2></div><p>各项能力职责明确，只在任务需要时进入执行过程。</p></div>
        <div class="capability-grid">
          <article class="capability-card capability-expert reveal"><div class="card-label">${icon('user')}<span>专家</span><small>SESSION ROLE</small></div><h3>让专业方法进入当前会话</h3><p>为会话挂载一位专家，随时更换或移除。</p><div class="expert-row"><img src="./icon.png" alt="智灵" /><i>数</i><i>法</i><i>设</i><b>选择专家 →</b></div></article>
          <article class="capability-card capability-skill reveal"><div class="card-label">${icon('sparkles')}<span>技能</span><small>SKILLS</small></div><h3>输入 / 调用专业流程</h3><div class="skill-cloud"><span>/ 视觉设计</span><span>/ 数据分析可视化</span><span>/ 技能创建</span><span>/ 插件包标准化</span></div></article>
          <article class="capability-card reveal"><div class="card-label">${icon('plug')}<span>连接器</span><small>CONNECTORS</small></div><h3>连接真实业务系统</h3><p>启用并授权后，可被当前会话直接调用。</p><div class="connector-row"><i>飞</i><i>知</i><i>文</i><i>本</i><span>全部在线</span></div></article>
          <article class="capability-card reveal"><div class="card-label">${icon('database')}<span>知识与记忆</span><small>CONTEXT</small></div><h3>持续提供可靠上下文</h3><p>挂载知识库、保留来源并管理长期偏好。</p><div class="document-stack"><span>产品资料</span><span>项目规范</span><span>个人偏好</span></div></article>
          <article class="capability-card capability-files reveal"><div class="card-label">${icon('file')}<span>文件与产物</span><small>DELIVERABLES</small></div><h3>结果集中预览与交付</h3><div class="file-list"><span>${icon('file')}市场调研报告.pdf <b>完成</b></span><span>${icon('image')}产品发布海报.png <b>完成</b></span><span>${icon('code')}登录状态修复.patch <b>完成</b></span></div></article>
        </div>
      </div>
    </section>

    <section class="section workflow-section" id="workflow">
      <div class="container">
        <div class="section-heading reveal"><div><span class="section-label">HOW IT WORKS</span><h2>从一句需求，<br />到一份可用结果。</h2></div><p>过程透明，产物明确，不需要在多个工具之间来回搬运信息。</p></div>
        <div class="workflow-grid">
          <article class="workflow-card reveal"><span>01</span>${icon('file')}<h3>表达目标</h3><p>自然语言、文件和对话上下文可以同时进入任务。</p><blockquote>“把最近三个月的销售数据整理成老板能快速看懂的一页。”</blockquote></article>
          <article class="workflow-card reveal"><span>02</span>${icon('sparkles')}<h3>组合能力</h3><p>专家确定方法，技能带来流程，连接器接入真实系统。</p><div class="workflow-tokens"><b>数据分析专家</b><b>分析技能</b><b>飞书</b></div></article>
          <article class="workflow-card reveal"><span>03</span>${icon('download')}<h3>完成交付</h3><p>查看执行流，打开、下载或继续修改最终产物。</p><div class="delivery-card">${icon('file')}<span><b>经营分析简报</b><small>12 页 · 可编辑</small></span><em>完成</em></div></article>
        </div>
      </div>
    </section>

    <section class="section open-source-section" id="open-source">
      <div class="container open-source-grid">
        <div class="terminal reveal"><div class="terminal-bar"><span>● ● ●</span><b>terminal — fresh-agent</b></div><pre><i>$</i> git clone --recursive \\
  https://github.com/mlmr-coder/fresh-agent.git
<i>$</i> cd fresh-agent/pinvou3-app
<i>$</i> npm ci
<i>$</i> ./run-dev.sh

<strong>✓ 智灵开发环境已启动</strong></pre></div>
        <div class="open-source-copy reveal"><span class="section-label">BUILT IN THE OPEN</span><h2>你的 Agent，<br />应该由你掌控。</h2><p>智灵以 MIT License 开源，支持本地 vLLM 和 OpenAI-compatible API。运行数据默认保存在设备。</p><div class="tech-tags"><span>MIT LICENSE</span><span>TAURI 2</span><span>REACT</span><span>RUST</span></div><a class="button button-dark" href="${REPOSITORY_URL}" target="_blank" rel="noreferrer">${icon('github')}mlmr-coder/fresh-agent${icon('arrow')}</a></div>
      </div>
    </section>

    <section class="container final-cta reveal">
      <img src="./icon.png" alt="智灵" />
      <div><span class="section-label">READY TO WORK</span><h2>现在，把第一个任务交给智灵。</h2><p>免费下载，或从 GitHub 获取源码。</p></div>
      <a class="button button-primary" href="${RELEASES_URL}" target="_blank" rel="noreferrer">获取智灵${icon('download')}</a>
    </section>
  </main>

  <footer class="site-footer"><div class="container footer-inner"><a class="brand" href="#top"><img src="./icon.png" alt="" /><strong>智灵</strong></a><p>Open-source desktop AI Agent for work, design and code.</p><nav><a href="${REPOSITORY_URL}" target="_blank" rel="noreferrer">GitHub</a><a href="${REPOSITORY_URL}/issues" target="_blank" rel="noreferrer">问题反馈</a><a href="${REPOSITORY_URL}/discussions" target="_blank" rel="noreferrer">参与讨论</a></nav></div></footer>
`;

const menuButton = document.querySelector('[data-menu-button]');
const mobileNav = document.querySelector('[data-mobile-nav]');

menuButton.addEventListener('click', () => {
  const open = mobileNav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.innerHTML = icon(open ? 'x' : 'menu');
});

mobileNav.addEventListener('click', (event) => {
  if (!(event.target instanceof HTMLAnchorElement)) return;
  mobileNav.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.innerHTML = icon('menu');
});

const applyMode = (modeKey) => {
  const mode = modes[modeKey];
  document.querySelector('[data-mode-eyebrow]').textContent = mode.eyebrow;
  document.querySelector('[data-mode-title]').textContent = mode.title;
  document.querySelector('[data-mode-description]').textContent = mode.description;
  document.querySelector('[data-preview-metric]').textContent = mode.metric;
  document.querySelector('[data-preview-result]').textContent = mode.result;
  document.querySelector('[data-mock-prompt]').textContent = mode.prompt;
  document.querySelector('[data-mock-result]').textContent = mode.result;
  document.querySelector('[data-mock-metric]').textContent = mode.metric;
  document.querySelector('[data-mock-skill]').textContent = mode.skill;
  mode.steps.forEach((step, index) => {
    document.querySelector(`[data-step="${index}"]`).textContent = step;
  });
};

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-mode]').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });
    applyMode(button.dataset.mode);
  });
});

const header = document.querySelector('[data-header]');
const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 24);
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.12 },
);

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
