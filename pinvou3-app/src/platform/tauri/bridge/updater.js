/**
 * updater feature for the Tauri bridge.
 * Registered before bridge.js builds the backwards-compatible facade.
 */
(function (root) {
  // biome-ignore lint/suspicious/noRedundantUseStrict: verbatim classic-script artifact; strict mode is part of the payload
  "use strict";
  // biome-ignore lint/suspicious/noAssignInExpressions: registry bootstrap of the verbatim payload; splitting statements would diverge from the artifact
  const registry = root.__PINVOU_TAURI_BRIDGE_FEATURES__ = root.__PINVOU_TAURI_BRIDGE_FEATURES__ || {};
  registry["updater"] = function (context) {
    const state = context.state;
    const notify = context.notify;
    const invoke = context.invoke;
    const refreshHistoryList = context.refreshHistoryList;
    const listen = context.listen;
    const getBuffer = context.getBuffer;
    const bt = context.bt;
  const UPDATE_PROGRESS_NOTIFY_INTERVAL_MS = 200;
  const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
  /** @type {number | null} */
  let updateProgressNotifyTimer = null;
  /** @type {number | null} */
  let updateCheckTimer = null;
  let updateCheckInFlight = false;
  let periodicUpdateChecksStarted = false;

  function normalizeUpdateCheckError(error) {
    const message = String(error || "");
    if (message.includes("UPDATE_MANIFEST_NOT_FOUND")
        || (/404 Not Found/i.test(message) && /latest\.json/i.test(message))) {
      return "manifest_missing";
    }
    return message;
  }

  function cancelScheduledUpdateProgressNotification() {
    if (updateProgressNotifyTimer === null) return;
    root.clearTimeout(updateProgressNotifyTimer);
    updateProgressNotifyTimer = null;
  }

  /** @param {{ total?: unknown, downloaded?: unknown } | null | undefined} payload - Raw update progress event payload. */
  function publishUpdateProgress(payload) {
    const total = Number(payload && payload.total) || 0;
    const downloaded = Number(payload && payload.downloaded) || 0;
    const nextProgress = total > 0
      ? Math.max(0, Math.min(100, Math.round((downloaded / total) * 100)))
      : 0;
    if (nextProgress === state.updateProgress) return;

    state.updateProgress = nextProgress;
    if (nextProgress >= 100) {
      cancelScheduledUpdateProgressNotification();
      notify();
      return;
    }
    if (updateProgressNotifyTimer !== null) return;
    updateProgressNotifyTimer = root.setTimeout(function () {
      updateProgressNotifyTimer = null;
      notify();
    }, UPDATE_PROGRESS_NOTIFY_INTERVAL_MS);
  }
  // ── 应用内升级 ───────────────────────────────────────────────────
  // 链路: check_for_update(对比服务器 latest.json) → download_update(流式下载+sha256,
  // 进度走 update:progress 事件) → install_update(pkexec apt) → restart_app。
  listen("update:progress", function (e) {
    if (!state.updateDownloading || state.updateCancelling || state.updateProgress >= 100) return;
    publishUpdateProgress(e.payload || {});
  });
  listen("remote_control:status", function (e) {
    state.remoteControl = Object.assign({}, state.remoteControl, e.payload || {});
    notify();
  });
  listen("remote_control:session_created", function (e) {
    const s = e && e.payload && e.payload.session;
    if (s && s.id) {
      getBuffer(s.id);
      if (state.sessions.every(function (item) { return item.id !== s.id; })) {
        state.sessions.unshift({
          id: s.id,
          title: s.title || bt("newChatFallbackTitle"),
          updated_at: s.updated_at || "",
          message_count: s.message_count || 0,
        });
      }
      notify();
    }
    refreshHistoryList().then(function () { notify(); }).catch(function () {});
  });
  async function loadAppVersion() {
    try {
      state.appVersion = await invoke("get_app_version");
    } catch { /* leaving the version empty on read failure is fine */ }
  }
  // 启动静默检查: 失败全吞(网络差/更新源挂了不打扰用户)。结果不管新旧都存——
  // available 驱动红点,current_version 给设置页显示当前版本用。
  async function checkForUpdateSilently() {
    if (updateCheckInFlight || state.updateDownloading || state.updateReady) return;
    updateCheckInFlight = true;
    try {
      const info = await invoke("check_for_update");
      if (info && info.current_version) state.appVersion = info.current_version;
      if (info) { state.updateInfo = info; notify(); }
      if (info && info.available) stopPeriodicUpdateChecks();
    } catch { /* 静默 */ }
    finally { updateCheckInFlight = false; }
  }
  function scheduleNextUpdateCheck() {
    if (!periodicUpdateChecksStarted || updateCheckTimer !== null
        || (state.updateInfo && state.updateInfo.available)
        || typeof root.setTimeout !== "function") return;
    updateCheckTimer = root.setTimeout(async function () {
      const firedTimer = updateCheckTimer;
      await checkForUpdateSilently();
      if (updateCheckTimer === firedTimer) updateCheckTimer = null;
      scheduleNextUpdateCheck();
    }, UPDATE_CHECK_INTERVAL_MS);
  }
  // Check immediately and then one hour after each completed check while the installed
  // version remains current. Finding a newer version stops the pending work.
  function startPeriodicUpdateChecks() {
    if (periodicUpdateChecksStarted || (state.updateInfo && state.updateInfo.available)
        || typeof root.setTimeout !== "function") return;
    periodicUpdateChecksStarted = true;
    checkForUpdateSilently().finally(scheduleNextUpdateCheck);
  }
  function stopPeriodicUpdateChecks() {
    periodicUpdateChecksStarted = false;
    if (updateCheckTimer === null) return;
    if (typeof root.clearTimeout === "function") root.clearTimeout(updateCheckTimer);
    updateCheckTimer = null;
  }
  // 设置页手动检查: 错误和「已是最新」都要反馈。
  async function checkForUpdate() {
    state.updateChecking = true; state.updateCheckError = null; notify();
    try {
      const info = await invoke("check_for_update");
      if (info && info.current_version) state.appVersion = info.current_version;
      state.updateInfo = info;
      if (info.available) stopPeriodicUpdateChecks();
      else state.updateCheckError = "latest"; // 前端按 i18n 显示「已是最新」
    } catch (e) {
      state.updateCheckError = normalizeUpdateCheckError(e);
    }
    state.updateChecking = false; notify();
  }
  // 下载+安装一条龙:Linux 通过 pkexec apt 安装 deb；Windows 启动 NSIS 后退出；
  // macOS 从 dmg 替换应用包。Linux/macOS 安装完成后由前端重启。
  async function downloadAndInstallUpdate() {
    if (!state.updateInfo || !state.updateInfo.available || state.updateDownloading) return false;
    // 入口捕获发起时的更新信息：下载/安装期间静默检查可能替换 updateInfo，
    // download/install 参数须始终指向发起时的版本，避免元数据漂移。
    const info = state.updateInfo;
    const shouldRestartAfterInstall = info.platform === "linux" || info.platform === "macos";
    let installed = false;
    cancelScheduledUpdateProgressNotification();
    state.updateDownloading = true; state.updateCancelling = false;
    state.updateProgress = 0; state.updateError = null; notify();
    try {
      const downloadResult = await invoke("download_update", { info });
      cancelScheduledUpdateProgressNotification();
      state.updateProgress = 100; notify();
      state.updateInfo = info; // 复原：install 用发起时的版本元数据，不随静默检查漂移
      if (downloadResult && typeof downloadResult === "object" && downloadResult.installer_path) {
        await invoke("install_update", { installerPath: downloadResult.installer_path, info: state.updateInfo });
      } else {
        await invoke("install_update", { debPath: downloadResult, info: state.updateInfo });
      }
      state.updateReady = true;
      installed = true;
    } catch (e) {
      // 用户主动取消下载时后端返回「已取消下载」,当正常处理不弹错误
      if (state.updateCancelling) state.updateProgress = 0;
      else state.updateError = String(e);
    }
    cancelScheduledUpdateProgressNotification();
    state.updateDownloading = false; state.updateCancelling = false; notify();
    if (installed && shouldRestartAfterInstall) restartApp();
    return installed;
  }
  // 取消进行中的下载: 置前端标志 + 通知后端中断下载循环。仅下载阶段有效;
  // 已进入 install(pkexec/apt)则无效(系统接管,装一半不能停)。
  function cancelUpdate() {
    if (!state.updateDownloading || state.updateCancelling) return;
    cancelScheduledUpdateProgressNotification();
    state.updateCancelling = true; notify();
    invoke("cancel_download").catch(function () { /* 忽略,下载循环超时也会退 */ });
  }
  function restartApp() {
    invoke("restart_app").catch(function () { /* restart 成功不会返回 */ });
  }
  function reportPendingUpdateResult() {
    invoke("report_pending_update_result").catch(function () { /* 静默重试,不阻塞启动 */ });
  }

    return {
      loadAppVersion,
      checkForUpdateSilently,
      startPeriodicUpdateChecks,
      checkForUpdate,
      downloadAndInstallUpdate,
      cancelUpdate,
      restartApp,
      reportPendingUpdateResult
    };
  };
})(window);
