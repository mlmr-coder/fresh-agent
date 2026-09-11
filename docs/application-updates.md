# 应用更新机制

Lingo 从 GitHub 最新 Release 读取静态更新清单：

```text
https://github.com/mlmr-coder/fresh-agent/releases/latest/download/latest.json
```

主窗口启动后立即检查一次，当前版本没有更新时，每次检查完成一小时后继续检查。发现更高版本后立即停止后续任务，并在侧栏底部显示升级箭头。自动检查失败不会打扰用户；用户在设置页手动检查时会显示结果。仓库尚未发布 Release、`latest.json` 返回 404 时显示“暂未发布可用更新”，不暴露底层 HTTP 错误和地址；其它检查故障仍显示错误并允许重试。下载与安装必须由用户点击升级入口触发。下载失败后入口显示错误并允许重试；安装完成后显示重启入口，Windows 安装器接管时禁止重复发起安装。

## 发布流程

根目录 `VERSION` 是发布版本唯一来源。版本号在 `main` 分支变化后，发布工作流构建以下安装包：

- Linux x86_64 deb
- Linux arm64 deb
- Windows x86_64 NSIS 安装程序
- macOS universal dmg

工作流计算 SHA-256，生成 `latest.json`，然后把安装包、校验文件和清单发布到 `v<version>` GitHub Release。

清单示例：

```json
{
  "schema_version": 1,
  "version": "0.9.4",
  "notes": "Lingo v0.9.4",
  "pub_date": "2026-09-09T00:00:00Z",
  "platforms": {
    "linux-x64": {
      "version": "0.9.4",
      "url": "https://github.com/mlmr-coder/fresh-agent/releases/download/v0.9.4/pinvou-agent_0.9.4-linux-x64.deb",
      "format": "deb",
      "sha256": "<64 位十六进制字符>",
      "size": 123456,
      "restart_after_install": true
    }
  }
}
```

## 下载与安装安全

发布版只接受本仓库版本化 GitHub Release 路径中的安装包。调试版可以用 `PINVOU3_UPDATE_URL` 指向本地 HTTP 测试服务，正式发布版会忽略该变量。

下载过程先写入 `.part` 文件，校验清单大小、4 GiB 上限和 SHA-256 后再原子重命名。安装前会再次计算 SHA-256：

- Linux：通过 `pkexec apt-get` 安装 deb，完成后重启应用。
- Windows：静默启动已校验的 NSIS 安装程序，然后退出旧进程。
- macOS：挂载 dmg，校验 bundle id、版本和代码签名；替换应用包时保留回滚副本，失败则恢复旧版本，成功后重启。
