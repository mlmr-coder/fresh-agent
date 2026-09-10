<div align="center">

<img src="pinvou3-app/src-tauri/icons/icon.png" alt="智灵图标" width="112" />

# 智灵

**面向工作、设计与代码的开源桌面 AI Agent。**

[![CI](https://github.com/mlmr-coder/fresh-agent/actions/workflows/pr-check.yml/badge.svg)](https://github.com/mlmr-coder/fresh-agent/actions/workflows/pr-check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmlmr-coder%2Ffresh-agent%2Fmain%2FVERSION&label=version&color=blue)](VERSION)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com/mlmr-coder/fresh-agent/releases)

[下载安装包](https://github.com/mlmr-coder/fresh-agent/releases) · [问题反馈](https://github.com/mlmr-coder/fresh-agent/issues) · [参与讨论](https://github.com/mlmr-coder/fresh-agent/discussions)

</div>

智灵把对话、文件、知识、专家、技能、连接器和代码 Agent 放在一个桌面工作台中。它既可以回答问题，也可以调用工具完成任务、修改真实项目并交付文件。

## 核心能力

- **工作模式**：处理资料、文档、表格、调研和日常业务任务。
- **设计模式**：生成并继续编辑海报、数据可视化等视觉产物。
- **代码模式**：通过 ACP 使用 Codex、Claude Code、Kimi 等代码 Agent，在真实项目或隔离工作区中工作。
- **专家**：为当前会话挂载一个专业角色，可随时更换或移除。
- **技能**：在输入框任意位置输入 `/`，从已启用的内置或已安装技能中选择；发送后按技能说明执行。
- **连接器**：在能力中心启用并完成授权，当前可用的连接器会显示在输入框下方，并可被会话直接调用。
- **知识与记忆**：挂载本地或远程知识库，保留来源，并管理长期偏好和上下文。
- **文件与产物**：支持常见文档、图片和压缩包输入，集中预览 AI 创建或修改的文件。
- **模型接入**：支持本地 vLLM 和 OpenAI-compatible API，可保存多套配置并按会话切换。

## 下载与运行

安装包由 GitHub Actions 构建并发布到 [GitHub Releases](https://github.com/mlmr-coder/fresh-agent/releases)：

- macOS 11.0+，Apple Silicon 与 Intel 通用 DMG
- Windows x86_64 安装包
- Ubuntu 22.04+，x86_64 与 arm64 DEB

当前 macOS 构建采用 ad-hoc 签名。首次打开若被系统隔离，可按 [安装说明](pinvou3-app/INSTALL.md) 处理。

## 从源码启动

需要 Git、Node.js、npm、Rust toolchain 和 [Tauri 2 系统依赖](https://v2.tauri.app/start/prerequisites/)。

```bash
git clone --recursive https://github.com/mlmr-coder/fresh-agent.git
cd fresh-agent/pinvou3-app
npm ci
cd ..
./pinvou3-app/run-dev.sh
```

已有仓库尚未初始化子模块时运行：

```bash
git submodule update --init --recursive
```

模型地址、模型名和密钥可在应用设置中管理。运行数据默认保存在 `~/.pinvou3/`；启用云模型或第三方连接器时，相关请求会发送给所选服务。

## 项目结构

```text
pinvou3-app/          Tauri 2 + React/Vite 桌面应用
website/              智灵宣传官网与 Linux 部署配置
CodeWhale/            Agent 底座 submodule
pinvou-knowledge/     本地与共享知识服务
remote-control-relay/ 可选的自托管远控中继
scripts/              测试、构建与发布脚本
docs/                 架构和维护文档
```

## 宣传官网

官网是独立的 Vite 静态项目，可部署到 Linux、Nginx、Caddy、对象存储或 CDN：

```bash
cd website
npm ci
npm run build
```

构建产物位于 `website/dist/`。Docker 与原生 Nginx 部署方法见 [website/README.md](website/README.md)。

模型调用、流式输出、工具循环、会话、Skills、Commands、MCP、Hooks 与 Compaction 由 [CodeWhale](https://github.com/Pinvou/CodeWhale) 提供；桌面界面、业务编排和系统集成位于 `pinvou3-app/`。

## 开发验证

```bash
(cd pinvou3-app && npm run lint:ui)
(cd pinvou3-app && npm run build:ui)
(cd pinvou3-app && npm test)
python3 scripts/architecture-guard.py
./scripts/fork-guard.sh --fast
```

提交改动前请阅读 [贡献指南](CONTRIBUTING.md)。安全问题请使用 [安全政策](SECURITY.md) 中的私有渠道，不要在公开 Issue 中披露。

智灵基于 [Pinvou/pinvou-agent](https://github.com/Pinvou/pinvou-agent) 继续开发，Agent 底座使用 [CodeWhale](https://github.com/Pinvou/CodeWhale)。兼容性技术标识仍保留 `pinvou3`，具体边界见 [品牌说明](docs/branding.md)。第三方许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

**[MIT License](LICENSE)**
