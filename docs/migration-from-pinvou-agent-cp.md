# pinvou-agent-cp 改动与迁移记录

## 比较范围

以原项目 `v0.9.3`（`a14b38d14cc0643f6fed434f93369749b4731845`）为基线，比较源目录的完整工作区，包括 `a6577b94`、`773e9242` 两次提交及尚未提交的改动和新增源码。目标仓库的新初始提交与该基线文件树一致，因此按文件迁移，不引入旧仓库提交历史。

## 改动点

1. 品牌统一为鲜小助：图标、标题、界面文案、提示词、知识服务、导出内容、安装元数据及项目链接。
2. 按用户确认移除日语支持，保留中文与英文；旧配置兼容由语言解析层处理。
3. 更新功能：启动立即检查、每小时重试、发现更新后停止轮询、侧栏入口及下载进度；新增共享下载校验与 Linux、macOS、Windows 安装适配。
4. 发布流程：生成 GitHub Release `latest.json`，包含平台安装包、版本、大小和 SHA-256。
5. macOS 开发签名与启动流程适配，及相关单元测试。
6. 中文文档、Issue / PR 模板、品牌说明、更新机制文档和测试调整。

## 合并决策

- 按用户最新要求，将中文项目介绍作为根目录 `README.md`，删除重复的 `README.zh-CN.md`；按截图要求，`README.ja.md` 文件也使用中文内容。
- 截图中的行为准则、贡献说明、DCO、安全、支持、第三方声明、商标说明均保留并中文化；许可证保留原始声明，补充中文参考译文。
- `VERSION` 保持 `0.9.3`，不触发新版本发布。
- CodeWhale gitlink 保持 `f853f8f1566c57e6be40d5439a222a932aa79ef5`；可选 Windows 私有运行时保持原 gitlink 和 `update = none`。
- 包名、bundle id、环境变量及 `~/.pinvou3/` 兼容性技术标识不变。
- 不复制 `.git`、私有记忆、忽略文件、依赖目录或构建产物。

## 迁移自查修复

- 侧栏升级完成后显示重启入口；Windows 安装器接管后禁用重复操作。下载失败时通过按钮提示和无障碍名称显示错误，支持重试。
- 浏览器回归覆盖下载失败、重试、进度、安装后自动重启及手动重启，确保不会重复下载安装。
- 修正远控中继测试仍等待旧品牌启动日志而超时的问题，同时同步 Web 集成冒烟测试的启动判定。
- 设置页回归改为验证鲜小助群名、群号未配置时禁用复制及 GitHub 交流入口，不再断言原项目官方群二维码。
- 中文文档保留原项目版权和第三方素材来源，修复入口与链接。

## 验证记录

- 架构守卫、CodeWhale fork 快速守卫、版本一致性、Git 空白检查通过。
- 前端完整 lint、桌面与 Web 构建通过。
- 前端 Node 测试：547 项通过，17 项条件跳过；桌宠资源校验通过。
- 浏览器：主界面、分离窗口、更新流程通过；设置页 81 项、完整 Web 流程 32 项通过。
- 远控中继：23 项通过；发布清单生成：2 项通过；发布契约与提交格式 Python 测试：18 项通过。
- Rust 格式检查通过；macOS 原生单元测试 2047 项通过、13 项忽略。编译使用仓库提供的 rustc 栈包装器。
- 本轮不发布新版本、不执行真实安装包替换。Linux / Windows 原生安装及 macOS 实际 DMG 升级尚未实机验证。

## 源目录文件改动清单

已跟踪文件改动 333 项，未跟踪新增文件 9 项。

| 处理 | 文件 |
|---|---|
| 修改 | `.github/ISSUE_TEMPLATE/bug_report.yml` |
| 修改 | `.github/ISSUE_TEMPLATE/config.yml` |
| 修改 | `.github/ISSUE_TEMPLATE/feature_request.yml` |
| 修改 | `.github/PULL_REQUEST_TEMPLATE.md` |
| 修改 | `.github/workflows/pr-check.yml` |
| 修改 | `.github/workflows/release-packages.yml` |
| 修改 | `AGENTS.md` |
| 保留并中文化 | `CODE_OF_CONDUCT.md` |
| 修改 | `CONTRIBUTING.md` |
| 保留并中文化 | `CONTRIBUTING.zh-CN.md` |
| 修改 | `DCO.md` |
| 保留并中文化 | `README.ja.md` |
| 修改 | `README.md` |
| 删除重复中文入口 | `README.zh-CN.md` |
| 修改 | `SECURITY.md` |
| 保留并中文化 | `SUPPORT.md` |
| 修改 | `THIRD_PARTY_NOTICES.md` |
| 保留并中文化 | `TRADEMARKS.md` |
| 修改 | `docs/adr/0006-多智能体收缩为会话内主动委派模式.md` |
| 修改 | `docs/adr/0010-共享知识库始终要求设备凭据.md` |
| 修改 | `docs/adr/0011-远程服务采用单空间多知识集.md` |
| 修改 | `docs/adr/0012-Web后台作为服务器管理主入口.md` |
| 修改 | `docs/adr/0013-共享知识库首期面向私网并强制加密.md` |
| 修改 | `docs/adr/0014-会话允许混合挂载本地与远程知识集.md` |
| 修改 | `docs/adr/0015-Pinvou允许连接多个远程知识库.md` |
| 修改 | `docs/adr/0016-远程检索不降级为纯关键词模式.md` |
| 修改 | `docs/adr/0019-远程服务只共享受管知识集.md` |
| 修改 | `docs/adr/0020-远程知识删除采用限期回收站.md` |
| 修改 | `docs/adr/0022-Pinvou托管共享知识库控制面.md` |
| 删除 | `docs/adr/0023-native-three-platform-browser-workspace.md` |
| 删除 | `docs/agent-task-cli.md` |
| 新增 | `docs/application-updates.md` |
| 新增 | `docs/branding.md` |
| 删除 | `docs/browser-workspace-acceptance.md` |
| 删除 | `docs/browser-workspace-context.md` |
| 修改 | `docs/capability-governance.md` |
| 修改 | `docs/code-mode-改动随对话回退-设计.md` |
| 修改 | `docs/code-mode-解耦与权限持久化-改动说明.md` |
| 修改 | `docs/code-native-agent.md` |
| 修改 | `docs/codex-acp.md` |
| 删除 | `docs/commit-message-convention.md` |
| 修改 | `docs/context-compaction-设计.md` |
| 删除 | `docs/fork-modifications.en.md` |
| 修改 | `docs/fork-modifications.md` |
| 删除 | `docs/fork-policy.en.md` |
| 修改 | `docs/fork-policy.md` |
| 修改 | `docs/gaia-benchmark.md` |
| 修改 | `docs/gaia-native-turn-tool-policy.md` |
| 修改 | `docs/knowledge-model.md` |
| 修改 | `docs/macos-keychain-弹窗说明.md` |
| 修改 | `docs/marketplace-unification-todo.md` |
| 修改 | `docs/marketplace-unification.md` |
| 修改 | `docs/multi-agent-acp.md` |
| 修改 | `docs/multiagent/glossary.md` |
| 修改 | `docs/plugin-package-spec.md` |
| 修改 | `docs/remote-control-phase1-architecture.md` |
| 修改 | `docs/remote-knowledge.md` |
| 删除 | `docs/sbom.md` |
| 修改 | `docs/shared-knowledge-host-implementation.md` |
| 修改 | `docs/工具市场.md` |
| 修改 | `pinvou-cli/crates/adapter-smoke/src/lib.rs` |
| 修改 | `pinvou-knowledge/Cargo.toml` |
| 修改 | `pinvou-knowledge/README.md` |
| 修改 | `pinvou-knowledge/deploy/install.sh` |
| 修改 | `pinvou-knowledge/deploy/pinvou-knowledge.service` |
| 修改 | `pinvou-knowledge/src/client.rs` |
| 修改 | `pinvou-knowledge/src/discovery.rs` |
| 修改 | `pinvou-knowledge/src/lib.rs` |
| 修改 | `pinvou-knowledge/src/main.rs` |
| 修改 | `pinvou-knowledge/src/model_download.rs` |
| 修改 | `pinvou-knowledge/src/server.rs` |
| 修改 | `pinvou-knowledge/src/service.rs` |
| 修改 | `pinvou-knowledge/src/tls.rs` |
| 修改 | `pinvou3-app/INSTALL.md` |
| 修改 | `pinvou3-app/knip.json` |
| 修改 | `pinvou3-app/package.json` |
| 修改 | `pinvou3-app/resources/mcp-servers/pptx/server.py` |
| 修改 | `pinvou3-app/run-dev.sh` |
| 修改 | `pinvou3-app/scripts/dingtalk-smoke.sh` |
| 修改 | `pinvou3-app/scripts/tauri/build.js` |
| 新增 | `pinvou3-app/scripts/tauri/macos-dev-runner.sh` |
| 新增 | `pinvou3-app/scripts/tauri/macos-dev-signing.js` |
| 修改 | `pinvou3-app/scripts/voice-normalize-eval.mjs` |
| 修改 | `pinvou3-app/src-tauri/Cargo.toml` |
| 修改 | `pinvou3-app/src-tauri/config/platforms/linux/tauri.conf.json` |
| 修改 | `pinvou3-app/src-tauri/config/platforms/macos/tauri.conf.json` |
| 修改 | `pinvou3-app/src-tauri/icon-source.png` |
| 修改 | `pinvou3-app/src-tauri/icons/128x128.png` |
| 修改 | `pinvou3-app/src-tauri/icons/128x128@2x.png` |
| 修改 | `pinvou3-app/src-tauri/icons/32x32.png` |
| 修改 | `pinvou3-app/src-tauri/icons/64x64.png` |
| 修改 | `pinvou3-app/src-tauri/icons/Square107x107Logo.png` |
| 修改 | `pinvou3-app/src-tauri/icons/Square142x142Logo.png` |
| 修改 | `pinvou3-app/src-tauri/icons/Square150x150Logo.png` |
| 修改 | `pinvou3-app/src-tauri/icons/Square284x284Logo.png` |
| 修改 | `pinvou3-app/src-tauri/icons/Square30x30Logo.png` |
| 修改 | `pinvou3-app/src-tauri/icons/Square310x310Logo.png` |
| 修改 | `pinvou3-app/src-tauri/icons/Square44x44Logo.png` |
| 修改 | `pinvou3-app/src-tauri/icons/Square71x71Logo.png` |
| 修改 | `pinvou3-app/src-tauri/icons/Square89x89Logo.png` |
| 修改 | `pinvou3-app/src-tauri/icons/StoreLogo.png` |
| 修改 | `pinvou3-app/src-tauri/icons/android/mipmap-hdpi/ic_launcher.png` |
| 修改 | `pinvou3-app/src-tauri/icons/android/mipmap-hdpi/ic_launcher_foreground.png` |
| 修改 | `pinvou3-app/src-tauri/icons/android/mipmap-hdpi/ic_launcher_round.png` |
| 修改 | `pinvou3-app/src-tauri/icons/android/mipmap-mdpi/ic_launcher.png` |
| 修改 | `pinvou3-app/src-tauri/icons/android/mipmap-mdpi/ic_launcher_foreground.png` |
| 修改 | `pinvou3-app/src-tauri/icons/android/mipmap-mdpi/ic_launcher_round.png` |
| 修改 | `pinvou3-app/src-tauri/icons/android/mipmap-xhdpi/ic_launcher.png` |
| 修改 | `pinvou3-app/src-tauri/icons/android/mipmap-xhdpi/ic_launcher_foreground.png` |
| 修改 | `pinvou3-app/src-tauri/icons/android/mipmap-xhdpi/ic_launcher_round.png` |
| 修改 | `pinvou3-app/src-tauri/icons/android/mipmap-xxhdpi/ic_launcher.png` |
| 修改 | `pinvou3-app/src-tauri/icons/android/mipmap-xxhdpi/ic_launcher_foreground.png` |
| 修改 | `pinvou3-app/src-tauri/icons/android/mipmap-xxhdpi/ic_launcher_round.png` |
| 修改 | `pinvou3-app/src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher.png` |
| 修改 | `pinvou3-app/src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher_foreground.png` |
| 修改 | `pinvou3-app/src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher_round.png` |
| 修改 | `pinvou3-app/src-tauri/icons/icon.icns` |
| 修改 | `pinvou3-app/src-tauri/icons/icon.ico` |
| 修改 | `pinvou3-app/src-tauri/icons/icon.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-20x20@1x.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-20x20@2x-1.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-20x20@2x.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-20x20@3x.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-29x29@1x.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-29x29@2x-1.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-29x29@2x.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-29x29@3x.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-40x40@1x.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-40x40@2x-1.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-40x40@2x.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-40x40@3x.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-512@2x.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-60x60@2x.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-60x60@3x.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-76x76@1x.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-76x76@2x.png` |
| 修改 | `pinvou3-app/src-tauri/icons/ios/AppIcon-83.5x83.5@2x.png` |
| 修改 | `pinvou3-app/src-tauri/packaging/linux/deb/pinvou3.desktop` |
| 修改 | `pinvou3-app/src-tauri/packaging/macos/Info.plist` |
| 修改 | `pinvou3-app/src-tauri/resources/README.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/base.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/dingtalk-skills/NOTICE-dingtalk.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/dingtalk-skills/dws/references/products/chat.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/dingtalk-skills/dws/references/products/doc/format/doc-jsonml-cookbook.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/dingtalk-skills/dws/references/products/minutes.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/instructions-shared.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/lark-skills/NOTICE.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/lark-skills/lark-shared/SKILL.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/lark-skills/lark-sheets/SKILL.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/lark-skills/lark-sheets/references/lark-sheets-read-data.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/mcp-servers/browser-core-protocol.mjs` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/mcp-servers/browser-wrapper-protocol.mjs` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/mcp-servers/browser-wrapper.mjs` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/mcp-servers/present_artifact_server.py` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/personas/agency-agents.json` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/tmeet-skills/NOTICE-tmeet.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/tmeet-skills/tmeet-skill/SKILL.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/tmeet-skills/tmeet-skill/references/tmeet-auth.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/wecom-skills/NOTICE-wecom.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/bundle/wecom-skills/wecomcli-shared/SKILL.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/skill-marketplace/ima-skills/SKILL.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/skill-marketplace/package-author/SKILL.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/skill-marketplace/tencent-docs-skill/SKILL.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/skill-marketplace/tencent-docs-skill/references/auth.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/skill-marketplace/tencent-docs-skill/slide/entry.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/skill-marketplace/visualizer/SKILL.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/skill-marketplace/visualizer/references/visualizer-design-system.md` |
| 修改 | `pinvou3-app/src-tauri/resources/common/skill-marketplace/visualizer/scripts/validate_visualizer_html.py` |
| 修改 | `pinvou3-app/src-tauri/resources/platforms/linux/codex-bridge/README.md` |
| 修改 | `pinvou3-app/src-tauri/resources/platforms/linux/knowledge-host/pinvou-knowledge-host-helper` |
| 修改 | `pinvou3-app/src-tauri/resources/platforms/macos/infoplist/en.lproj/InfoPlist.strings` |
| 删除 | `pinvou3-app/src-tauri/resources/platforms/macos/infoplist/ja.lproj/InfoPlist.strings` |
| 修改 | `pinvou3-app/src-tauri/resources/platforms/macos/infoplist/zh-Hans.lproj/InfoPlist.strings` |
| 修改 | `pinvou3-app/src-tauri/src/app/commands/checkpoints.rs` |
| 修改 | `pinvou3-app/src-tauri/src/app/commands/codex.rs` |
| 修改 | `pinvou3-app/src-tauri/src/app/commands/interaction.rs` |
| 修改 | `pinvou3-app/src-tauri/src/app/commands/personas.rs` |
| 修改 | `pinvou3-app/src-tauri/src/app/commands/sessions.rs` |
| 修改 | `pinvou3-app/src-tauri/src/app/commands/settings.rs` |
| 修改 | `pinvou3-app/src-tauri/src/app/commands/voice.rs` |
| 修改 | `pinvou3-app/src-tauri/src/core/model_endpoint.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/assistant/engine_pool.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/assistant/expert_roster.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/assistant/multiagent_regression_tests.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/assistant/platform/bridge.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/assistant/product_runtime/headless_bridge.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/browser/core.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/code_checkpoints/mod.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/codex_acp/latest.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/codex_acp/mod.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/codex_acp/store.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/connectors/ima.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/connectors/native_installer.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/connectors/tmeet.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/feedback/mod.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/files/file_ingest.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/files/ingest_archive.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/marketplace/bundle.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/marketplace/python_dependencies.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/marketplace/skill_marketplace.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/memory/llm_review.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/memory/organize.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/memory/render.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/memory/tests.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/memory/types.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/personas/mod.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/pet/pet_window.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/pet/platform/detach.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/remote_control/manager/mod.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/remote_control/manager/transfer.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/review/mod.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/runtime_bundle/platform/mod.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/scheduled/tasks.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/sessions/mod.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/sessions/mode_state.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/sessions/tests.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/shared_knowledge_host/mod.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/shared_knowledge_host/platform/linux.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/updater/mod.rs` |
| 新增 | `pinvou3-app/src-tauri/src/features/updater/platform/common.rs` |
| 新增 | `pinvou3-app/src-tauri/src/features/updater/platform/linux.rs` |
| 新增 | `pinvou3-app/src-tauri/src/features/updater/platform/macos.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/updater/platform/mod.rs` |
| 新增 | `pinvou3-app/src-tauri/src/features/updater/platform/windows.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/voice/platform/voice_asr_speech.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/voice/platform/windows.rs` |
| 修改 | `pinvou3-app/src-tauri/src/features/voice/voice_asr.rs` |
| 修改 | `pinvou3-app/src-tauri/src/lib.rs` |
| 修改 | `pinvou3-app/src-tauri/src/platform/os/locale.rs` |
| 修改 | `pinvou3-app/src-tauri/src/platform/os/macos/macos_system.rs` |
| 修改 | `pinvou3-app/src-tauri/src/platform/os/posix.rs` |
| 修改 | `pinvou3-app/src-tauri/src/platform/os/windows/windows_system.rs` |
| 修改 | `pinvou3-app/src-tauri/src/platform/prefs/mod.rs` |
| 修改 | `pinvou3-app/src-tauri/tauri.conf.json` |
| 修改 | `pinvou3-app/src-tauri/tests/memory_e2e.rs` |
| 修改 | `pinvou3-app/src/app/DetachedShell.jsx` |
| 修改 | `pinvou3-app/src/app/main.jsx` |
| 修改 | `pinvou3-app/src/app/pet-main.jsx` |
| 修改 | `pinvou3-app/src/app/reader-main.jsx` |
| 修改 | `pinvou3-app/src/assets/brand/brand-blue.png` |
| 删除 | `pinvou3-app/src/assets/community/qq-group-1108909346.png` |
| 修改 | `pinvou3-app/src/features/chat/composer-controls.jsx` |
| 修改 | `pinvou3-app/src/features/chat/personal-workbench-scene.js` |
| 修改 | `pinvou3-app/src/features/chat/visual-poster-scene.js` |
| 修改 | `pinvou3-app/src/features/chat/work-scene-routes.js` |
| 修改 | `pinvou3-app/src/features/codex/AcpAgentLogo.jsx` |
| 修改 | `pinvou3-app/src/features/codex/CodexAcpView.jsx` |
| 修改 | `pinvou3-app/src/features/codex/code-native-lane.js` |
| 修改 | `pinvou3-app/src/features/codex/code-permission-state.js` |
| 修改 | `pinvou3-app/src/features/conversation/assistant-response-export.js` |
| 修改 | `pinvou3-app/src/features/conversation/deepseek-conversation.js` |
| 修改 | `pinvou3-app/src/features/monitor/MonitorView.jsx` |
| 修改 | `pinvou3-app/src/features/multiagent/subagent-conversation.mjs` |
| 修改 | `pinvou3-app/src/features/personas/Personas.jsx` |
| 修改 | `pinvou3-app/src/features/personas/personas-i18n.js` |
| 修改 | `pinvou3-app/src/features/pet/PetWindow.jsx` |
| 修改 | `pinvou3-app/src/features/remote-knowledge/RemoteKnowledgeView.jsx` |
| 修改 | `pinvou3-app/src/features/scheduled/ScheduledTasksView.jsx` |
| 修改 | `pinvou3-app/src/features/settings/SettingsView.jsx` |
| 修改 | `pinvou3-app/src/features/settings/community-config.js` |
| 修改 | `pinvou3-app/src/features/settings/model-catalog.js` |
| 修改 | `pinvou3-app/src/features/tools/ToolStoreView.jsx` |
| 修改 | `pinvou3-app/src/features/tools/tool-common.jsx` |
| 修改 | `pinvou3-app/src/features/tools/tool-renderers.jsx` |
| 新增 | `pinvou3-app/src/features/updater/SidebarUpdateStatus.jsx` |
| 删除 | `pinvou3-app/src/features/updater/UpdateNoticeButton.jsx` |
| 删除 | `pinvou3-app/src/features/updater/update-notice-logic.js` |
| 修改 | `pinvou3-app/src/features/voice-composer/useComposerVoiceInput.js` |
| 修改 | `pinvou3-app/src/index.html` |
| 修改 | `pinvou3-app/src/pet.html` |
| 修改 | `pinvou3-app/src/platform/tauri/bridge.js` |
| 修改 | `pinvou3-app/src/platform/tauri/bridge/chat.js` |
| 修改 | `pinvou3-app/src/platform/tauri/bridge/monitor.js` |
| 修改 | `pinvou3-app/src/platform/tauri/bridge/multiagent.js` |
| 修改 | `pinvou3-app/src/platform/tauri/bridge/personas.js` |
| 修改 | `pinvou3-app/src/platform/tauri/bridge/remote-control.js` |
| 修改 | `pinvou3-app/src/platform/tauri/bridge/terminal.js` |
| 修改 | `pinvou3-app/src/platform/tauri/bridge/updater.js` |
| 修改 | `pinvou3-app/src/platform/tauri/bridge/voice.js` |
| 修改 | `pinvou3-app/src/platform/web/bridge.js` |
| 修改 | `pinvou3-app/src/shared/ViewErrorBoundary.jsx` |
| 新增 | `pinvou3-app/src/shared/brand.js` |
| 修改 | `pinvou3-app/src/shared/bridge-messages.js` |
| 修改 | `pinvou3-app/src/shared/date-utils.js` |
| 修改 | `pinvou3-app/src/shared/i18n-all.js` |
| 修改 | `pinvou3-app/src/shared/i18n.js` |
| 修改 | `pinvou3-app/src/shared/i18n/browser.js` |
| 修改 | `pinvou3-app/src/shared/i18n/en.js` |
| 删除 | `pinvou3-app/src/shared/i18n/ja.js` |
| 修改 | `pinvou3-app/src/shared/i18n/zh.js` |
| 修改 | `pinvou3-app/src/shared/model-service-errors.js` |
| 修改 | `pinvou3-app/src/vendor/README.md` |
| 修改 | `pinvou3-app/tests/acp_providers_contract.test.js` |
| 修改 | `pinvou3-app/tests/assistant_message_actions.test.mjs` |
| 修改 | `pinvou3-app/tests/attachment_drop_bridge.test.mjs` |
| 修改 | `pinvou3-app/tests/attachment_limit_errors.test.mjs` |
| 修改 | `pinvou3-app/tests/bridge_domain_protocol.test.mjs` |
| 修改 | `pinvou3-app/tests/browser_macos_native_contract.test.mjs` |
| 修改 | `pinvou3-app/tests/browser_view_recovery_ux.test.mjs` |
| 修改 | `pinvou3-app/tests/chat_turn_error_isolation.test.mjs` |
| 修改 | `pinvou3-app/tests/codex_acp_timeline.test.mjs` |
| 修改 | `pinvou3-app/tests/connector_skills_contract.test.js` |
| 修改 | `pinvou3-app/tests/design_mode_entry_smoke.js` |
| 修改 | `pinvou3-app/tests/detached_boot_smoke.js` |
| 修改 | `pinvou3-app/tests/fixtures/voice-normalize-labeled-samples.json` |
| 修改 | `pinvou3-app/tests/i18n_lazy_language_gate.test.mjs` |
| 修改 | `pinvou3-app/tests/kb_smoke.js` |
| 修改 | `pinvou3-app/tests/knowledge_host_packaging.test.mjs` |
| 新增 | `pinvou3-app/tests/macos_dev_signing.test.js` |
| 修改 | `pinvou3-app/tests/macos_phase2_contract.test.js` |
| 修改 | `pinvou3-app/tests/model_catalog_grouping.test.js` |
| 修改 | `pinvou3-app/tests/multiagent_plan_normalize.test.mjs` |
| 修改 | `pinvou3-app/tests/personal_workbench_scene_logic.test.js` |
| 修改 | `pinvou3-app/tests/pet_card_state_logic.test.mjs` |
| 修改 | `pinvou3-app/tests/pet_scheduled_notice_logic.test.mjs` |
| 修改 | `pinvou3-app/tests/pet_state_logic.test.mjs` |
| 修改 | `pinvou3-app/tests/scheduled_tasks_smoke.js` |
| 修改 | `pinvou3-app/tests/send_draft_restore_logic.test.mjs` |
| 修改 | `pinvou3-app/tests/settings_ui_smoke.js` |
| 修改 | `pinvou3-app/tests/system_language_default.test.mjs` |
| 修改 | `pinvou3-app/tests/tauri_effective_config.test.js` |
| 修改 | `pinvou3-app/tests/tool_store_edit_display_contract.test.mjs` |
| 修改 | `pinvou3-app/tests/turn_error_display_contract.test.mjs` |
| 修改 | `pinvou3-app/tests/ui_language_coverage.test.mjs` |
| 修改 | `pinvou3-app/tests/ui_smoke.js` |
| 删除 | `pinvou3-app/tests/update_notice_logic.test.js` |
| 修改 | `pinvou3-app/tests/update_notice_ui_smoke.js` |
| 新增 | `pinvou3-app/tests/updater_periodic_check.test.mjs` |
| 修改 | `pinvou3-app/tests/voice_input_error_logic.test.js` |
| 修改 | `pinvou3-app/tests/web_access_contract.test.mjs` |
| 修改 | `pinvou3-app/tests/web_access_desktop_proxy.test.mjs` |
| 修改 | `pinvou3-app/vite.config.mjs` |
| 删除 | `remote-control-relay/PROTOCOL.md` |
| 修改 | `remote-control-relay/server.js` |
| 修改 | `remote-control-relay/test/relay.test.js` |
| 修改 | `scripts/build-windows-ota.ps1` |
| 新增 | `scripts/generate-update-manifest.mjs` |
| 修改 | `scripts/release-macos.sh` |
| 修改 | `scripts/run-mac-verify.sh` |
| 新增 | `scripts/tests/generate-update-manifest.test.mjs` |
| 修改 | `scripts/tests/test_release_manifest_probe.py` |
| 修改 | `scripts/validate-commit-msg.py` |
