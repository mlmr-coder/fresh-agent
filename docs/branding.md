# 智灵品牌与兼容性说明

应用窗口、原生代码会话、审核与语音提示、内置技能、知识服务、导出内容和安装说明等面向用户的品牌显示统一使用“智灵”。

根目录 `BRAND.json` 是显示名称和品牌图标路径的单一来源。修改后运行 `node scripts/sync-brand.mjs`；脚本会同步前端品牌常量、主窗口与 HTML 标题、macOS 应用菜单与安装元数据、Linux 启动器、包描述及原生图标清单。`node scripts/sync-brand.mjs --check` 用于检查遗漏。生成的 `pinvou3-app/src/shared/brand.js` 与 `pinvou3-app/src-tauri/src/core/brand.rs` 不应手工修改。

品牌图标分为一个前端显示资源和一组原生平台尺寸资源，路径统一登记在 `BRAND.json`。macOS Dock 会按图标画布统一排版，主体贴满画布时会显得比其他应用更大；`icons.macosContentScale` 控制主体占画布的比例，默认 `0.8`。更换源图后，正常执行 `npm run dev` 或 `npm run build` 会先等比缩放原图、生成带透明安全区的 `macos-icon.png` 和最终 `icon.icns`，不会重绘图标；也可以单独运行 `npm run sync:brand:macos-icon`。生成内容未变化时不会改写文件，以免触发无意义的 Rust 重编译。其他平台尺寸仍按配置准备，随后运行品牌同步命令。内置提示词发生变化时会更新内容哈希，应用按正常资源提取流程刷新已安装内容。

`legacyDisplayNames` 登记曾使用过的显示名称。`node scripts/sync-brand.mjs` 会在产品文档、界面文案、安装脚本和测试中替换残留名称，`--check` 会在发现残留时失败；兼容性技术标识不登记在这里。

## 兼容性边界

- 包名、crate 名、可执行文件名、应用标识、环境变量、MCP 工具名、URL Scheme、数据库键和 `~/.pinvou3/` 路径保持稳定，避免破坏升级和既有数据。
- Linux Debian 包继续使用 ASCII 技术名 `pinvou3`，桌面启动器显示“智灵”；macOS 和 Windows 安装包显示“智灵”。
- 既有会话、用户自定义助手名称、知识服务名称、凭据和备份不做强制改写。
- 第三方模型名称、语音转写内容、版权声明和许可证保留原始身份。
- 官网、社区、Issue、Release 和支持链接统一指向 `mlmr-coder/fresh-agent`。

发布前应在对应操作系统上验证全新安装和从旧版本升级。源码检查和前端构建不能替代原生安装测试。
