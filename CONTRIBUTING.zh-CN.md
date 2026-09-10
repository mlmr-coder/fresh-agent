# 参与智灵开发

感谢你参与智灵。提交改动前，请先确认需求边界、现有实现和 CodeWhale 已提供的能力，避免在应用层重复实现底座功能。

## 开发环境

1. 安装 Git、Node.js、npm、Rust 工具链和 [Tauri 2 系统依赖](https://v2.tauri.app/start/prerequisites/)。
2. 克隆仓库并初始化子模块：

   ```bash
   git clone --recursive https://github.com/mlmr-coder/fresh-agent.git
   cd fresh-agent
   ```

3. 安装前端依赖并启动开发环境：

   ```bash
   cd pinvou3-app
   npm ci
   cd ..
   ./pinvou3-app/run-dev.sh
   ```

## 代码边界

- 桌面界面、Tauri 集成和 Engine 配置放在 `pinvou3-app/`。
- 领域 Agent 与工具组合优先放在 `SKILL.md`。
- 外部 API 和独立能力使用 MCP 服务或连接器。
- 模型行为指导放在 bundle 的 `instructions.md`。
- CodeWhale 负责模型调用、流式输出、工具循环、会话、Skills、Commands、MCP、Hooks 与 Compaction。通用底座问题优先提交到上游。
- 涉及 CodeWhale fork 行为时，同步更新 `docs/fork-modifications.md` 并运行 `./scripts/fork-guard.sh --fast`。

## 分支与提交

- 从最新 `main` 创建分支，分支名应清楚表达任务，例如 `feat/application-update`。
- 提交标题使用 `feat:`、`fix:`、`docs:`、`refactor:`、`test:`、`build:`、`ci:` 或 `chore:` 等常用类型。
- 提交说明可以使用中文，内容应说明实际变化。
- 人工提交使用 `git commit -s` 添加 `Signed-off-by`，具体含义见 [DCO 说明](DCO.md)。
- 不得提交账号、密码、密钥、令牌、Cookie、客户数据、内部地址或本地私有文件。

## 验证

按改动范围运行必要检查。常用命令如下：

```bash
(cd pinvou3-app && npm run lint)
(cd pinvou3-app && npm run build:ui)
(cd pinvou3-app && npm test)
python3 scripts/architecture-guard.py
./scripts/fork-guard.sh --fast
```

Rust 业务逻辑变更还应运行：

```bash
RUSTC_WRAPPER="$(./pinvou3-app/src-tauri/scripts/rustc-stack-wrapper-select.sh)" \
TAURI_CONFIG='{"app":{"macOSPrivateApi":true}}' \
  cargo test --manifest-path pinvou3-app/src-tauri/Cargo.toml --lib -- --test-threads=1
```

版本号只修改根目录 `VERSION`，然后执行：

```bash
node scripts/sync-version.mjs
```

## 提交合并请求

合并请求应说明问题、最终行为、关键实现、验证结果和已知限制。提交前请检查需求是否完整、异常状态是否处理、兼容性是否保持，以及文档和测试是否同步。
