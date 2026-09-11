# 第三方许可声明

Lingo包含或再分发下列开源组件，各组件继续遵循其原始许可证。

## 直接包含或按需下载的组件

| 组件 | 版本或基线 | 使用方式 | 许可证 | 上游地址 |
|---|---|---|---|---|
| CodeWhale | `pinvou-v0.9.5-r13-oauth1` | Git 子模块与链接的 Rust crates | MIT | https://github.com/mlmr-coder/CodeWhale |
| DingTalk Workspace CLI（`dws`）及技能 | 1.0.58 | 内置 Apache-2.0 技能源码；首次使用连接器时下载并校验官方 CLI | Apache-2.0 | https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli |
| Lark CLI 及技能 | 1.0.87 | 内置 MIT 技能源码；首次使用连接器时下载并校验官方 CLI | MIT | https://github.com/larksuite/cli |
| WeCom CLI 及技能 | 1.1.0 | 内置 MIT 技能源码；首次使用连接器时下载并校验官方 CLI | MIT | https://github.com/WecomTeam/wecom-cli |
| Tencent Meeting CLI（`tmeet`）及技能 | 1.0.15 | 内置上游技能；CLI 从 npm 安装并固定版本 | MIT | https://github.com/TencentCloud/tencentmeeting-cli |
| agency-agents-zh | `agency-1.0`，2026-08-18 快照 | 规范化中文角色数据并保留上游许可证 | MIT | https://github.com/jnMetaCode/agency-agents-zh |
| SenseVoice.cpp | 安装脚本固定源码版本 | 用户启用时构建，Git 不保存可执行文件 | MIT | https://github.com/lovemefan/SenseVoice.cpp |
| marked | 14.1.4 | npm 依赖，由 Vite 打包 | MIT | https://github.com/markedjs/marked |
| DOMPurify | 3.4.14 | npm 依赖，由 Vite 打包 | Apache-2.0 或 MPL-2.0 | https://github.com/cure53/DOMPurify |
| chrome-devtools-mcp | 1.7.0 | Windows 构建时固定并校验 npm 包，保留包内第三方声明 | Apache-2.0 | https://github.com/ChromeDevTools/chrome-devtools-mcp |
| Tailwind CSS Play CDN runtime | 3.4.17 | 本地保存的浏览器脚本 | MIT | https://github.com/tailwindlabs/tailwindcss |
| Material Icon Theme | 2026-07-29 Iconify 快照 | 13 个内联 SVG 文件图标 | MIT | https://github.com/material-extensions/vscode-material-icon-theme |
| Material Icon Theme 文件/文件夹子集 | 2026-07-30 上游快照 | 43 个本地 SVG 图标 | MIT | https://github.com/material-extensions/vscode-material-icon-theme |
| cc-switch 模型服务预设 | 2026-08-05 精简快照 | 模型地址与协议预设 | MIT | https://github.com/farion1231/cc-switch |

## 归属说明

- marked：Copyright (c) 2018+ MarkedJS 与 Copyright (c) 2011–2018 Christopher Jeffrey；Markdown 兼容代码保留 John Gruber 归属及 BSD 风格条款。
- DOMPurify：Copyright 2025–2026 Dr.-Ing. Mario Heiderich, Cure53。
- chrome-devtools-mcp：应用在保存时修改 `build/src/McpResponse.js`，为结构化页面条目增加 `target_id`，以便宿主校验会话和标签页所有权；修改后的产物使用 SHA-256 固定。
- Tailwind CSS：Copyright (c) Tailwind Labs, Inc.
- Material Icon Theme：Copyright (c) 2025 Material Extensions。图标通过 [Iconify Material Icon Theme](https://icon-sets.iconify.design/material-icon-theme/) 导出，Iconify 不是运行时依赖。

Material Icon Theme 文件/文件夹子集保留 Copyright (c) 2025 Material Extensions。图标取自上游 `icons/`，其中 `csv.svg` 对应 `table.svg`；`file.svg`、`folder.svg` 和 `folder-open.svg` 按上游 `src/core/generator` 默认生成器还原，默认颜色为 `#90a4ae`。

连接器的详细许可证和上游声明保存在 `pinvou3-app/src-tauri/resources/` 对应资源旁。各平台连接器地址和 SHA-256 记录在 `pinvou3-app/src-tauri/resources/platforms/<os>/<arch>/bundle/connectors/connectors.lock.json`，应用首次使用时按清单下载；`scripts/fetch-connectors.sh` 用于 CI 和维护者验证同一批产物。

Rust、npm 等包管理依赖以清单文件和 GitHub dependency graph 为准。依赖变更应检查已知漏洞与许可证元数据。

本仓库保留了原 Pinvou 项目创作的应用图片、截图和宠物动画，并引入Lingo品牌图标；除上表注明的组件和图标外，这些资源并非从第三方素材包导入。第三方服务图标和产品名称只用于说明兼容关系，不表示第三方背书，也不授予任何商标权利。

以下许可证原文为法律声明，保留上游英文内容：

## Material Icon Theme 许可证原文

The MIT License (MIT)

Copyright (c) 2025 Material Extensions

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
