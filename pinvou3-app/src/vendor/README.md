# vendor/ — 本地化前端依赖（离线/内网可用）

前端使用 Vite 构建，但仍不依赖 CDN。这里仅保留必须在 `src/platform/tauri/bridge.js` 之前加载的经典脚本；
React / ReactDOM 由 npm 依赖打包进 `dist/assets/`。

| 文件 | 版本 | SHA-256 | 来源 / 许可证 | 用途 |
|---|---|---|---|---|
| `tailwind.js` | 3.4.17 + 本地补丁 | `e884d0030114ff1babdb43e9822ea7293c848debd9ce76a96cafc27105c3df6b` | Tailwind CSS Play CDN 运行时 / MIT | 运行时扫描 DOM 并生成 Tailwind 样式 |

**本地补丁（2026-08，兼容 Safari 14）**：上游 `cdn.tailwindcss.com` 使用
`inset` 简写属性生成 `inset-*` 工具类，该属性从 Safari 14.1 才开始支持。
macOS 11.0 自带 WKWebView 无法解析它，会让全部 `fixed inset-0` 弹层失效。
补丁把生成表中的 `["inset",["inset"]]` 展开为
`["inset",["top","right","bottom","left"]]`，恢复物理方向属性。
更新上游文件后必须重新应用补丁；表中的 SHA-256 对应补丁后的文件。
`tests/compat_audit.test.mjs` 会校验生成表。

仓库已移除单独保存的 marked 和 DOMPurify 文件。React 统一使用 npm 依赖
`marked@14.1.4` 和 `dompurify@3.4.14`，由 Vite 按 `safari14` 目标转译和打包。
当 `window.marked` 不可用时，bridge 兜底渲染器通过 `escapeHtml` 降级为纯文本。
仓库只保留一个 marked 版本，避免 vendor 固定版本与 npm 版本漂移。
`tailwind.js` 内部使用的 `.at()` 由 `shared/legacy-polyfills.js` 在加载前补齐。
vendor 目录只保留 Tailwind；`tests/vendor_asset_integrity.test.js` 校验每个发布的
`.js` 文件均已登记并具有正确 SHA-256。

完整第三方归因见仓库根目录 `THIRD_PARTY_NOTICES.md`；Apache-2.0 全文随
`src-tauri/resources/common/bundle/dingtalk-skills/dws/LICENSE` 一并分发。

## 刷新 / 升级

```bash
cd pinvou3-app/src/vendor
curl -fsSL -o tailwind.js              https://cdn.tailwindcss.com
```

刷新文件后，应在同一次改动中更新上表的版本和 SHA-256；版本变化时还要更新
`THIRD_PARTY_NOTICES.md`。`npm test` 中的
`tests/vendor_asset_integrity.test.js` 会校验所有登记哈希并拒绝未登记的
`.js` 文件。这些文件在 `.gitattributes` 中固定为 LF，不要提交被本地
`core.autocrlf` 改写后的字节。

## 上线前可做的优化（非必须）

- **预编译 Tailwind**：当前仍使用离线 runtime 扫描动态 class。后续可单独迁移到静态 CSS，
  但需要先覆盖运行时拼接 class 的页面，避免视觉回归。
