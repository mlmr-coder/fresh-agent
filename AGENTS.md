# 鲜小助项目约定

## 开始工作

- 如果仓库根目录存在 `.codex-memory.md`，先读取它；这是本地私有记忆，禁止提交。
- 开始新任务前同步最新 `main`，并让所有子模块与父仓库记录的 gitlink 对齐。
- 完成前检查需求完整性、异常状态、兼容性、测试与文档，不以“测试通过”替代自查。

## CodeWhale 边界

CodeWhale 提供模型调用、流式输出、工具循环、会话、Skills、Commands、MCP、Hooks 与 Compaction。鲜小助不重复实现这些能力。

| 改动类型 | 位置 |
|---|---|
| 领域 Agent 或工具组合 | `SKILL.md` |
| 外部 API 或独立能力 | MCP 服务或连接器 |
| 模型行为指导 | bundle `instructions.md` |
| 界面、Tauri 集成或 Engine 配置 | `pinvou3-app/` |
| 可复用底座问题 | CodeWhale，上游优先 |

修改 CodeWhale fork 独有行为时，应同步更新 `docs/fork-modifications.md`、相关指纹和行为测试，并运行 `./scripts/fork-guard.sh --fast`。只变更 gitlink 时按守卫要求更新登记与指纹。

## 架构边界

- 前端业务逻辑放在 `pinvou3-app/src/features/<name>/`。
- Tauri 与 Web 宿主适配放在 `pinvou3-app/src/platform/{tauri,web}/`。
- Rust 业务逻辑放在 `pinvou3-app/src-tauri/src/features/<name>/`，跨功能操作系统能力放在 `platform/`。
- 依赖方向保持 `app → features → platform/core`。
- React 不直接检查 user agent 或访问 Tauri 全局对象；通过平台能力接口调用。
- 平台差异使用 `cfg(target_os)` 和明确接口表达，不支持的能力返回 `unsupported`。
- 使用项目 npm 命令构建，不直接运行 `npx tauri build`。
- 修改后运行 `python3 scripts/architecture-guard.py` 和受影响测试。

## 产品约定

- 产品显示名称统一为“鲜小助”。`pinvou3`、bundle id、环境变量和 `~/.pinvou3/` 等兼容性技术标识按 `docs/branding.md` 保留。
- 应用文案统一从 `pinvou3-app/src/shared/i18n.js` 读取，提供简体中文和英文，不在组件中新增单语言文案。
- 社区功能必须在没有私有服务和内部地址时完整可用。
- 网络、上传、外部命令或新依赖采用安全默认值，并向用户清楚说明。
- 禁止把账号、密码、密钥、令牌、Cookie、客户数据、内部地址或私有数据写入代码、提交、示例和日志。

## 项目事实

- `pinvou3-app/`：Tauri 2 + React/Vite 桌面应用。
- `CodeWhale/`：Agent 底座子模块。
- 运行数据位于 `~/.pinvou3/`。
- 开发启动命令为 `./pinvou3-app/run-dev.sh`。
- 根目录 `VERSION` 是版本号唯一来源；修改后运行 `node scripts/sync-version.mjs`。
- 贡献流程见 `CONTRIBUTING.md`，更新机制见 `docs/application-updates.md`。
