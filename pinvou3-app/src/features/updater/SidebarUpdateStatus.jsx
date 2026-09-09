import { bridge } from '../../hooks/useBridge.js';

function UpdateArrow() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 8-6-6-6 6" />
      <path d="M12 2v14" />
    </svg>
  );
}

export function SidebarUpdateStatus({ bs, t, dark = false }) {
  const info = bs && bs.updateInfo;
  const currentVersion = (bs && bs.appVersion) || (info && info.current_version) || '—';
  const latestVersion = (info && info.latest_version) || currentVersion;
  const available = !!(info && info.available);
  const downloading = !!(bs && bs.updateDownloading);
  const cancelling = !!(bs && bs.updateCancelling);
  const ready = !!(bs && bs.updateReady);
  const progress = Math.max(0, Math.min(100, Number((bs && bs.updateProgress) || 0)));
  const error = bs && bs.updateError ? String(bs.updateError) : '';

  const mutedClass = dark ? 'text-[#9AA0A6]' : 'text-[#80868B]';

  if (downloading) {
    const status = progress >= 100
      ? t.installing
      : (cancelling ? t.cancelling : t.uiSettings.downloading(progress));
    return (
      <div
        data-testid="sidebar-update-status"
        role="status"
        aria-live="polite"
        title={status}
        className={`w-[116px] shrink-0 px-1 ${mutedClass}`}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] leading-none">
          <span className="truncate font-medium">v{latestVersion}</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className={`h-1 overflow-hidden rounded-full ${dark ? 'bg-white/10' : 'bg-black/[0.08]'}`}>
          <div
            data-testid="sidebar-update-progress"
            className="h-full rounded-full bg-[#0B57D0] transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (ready) {
    const installerTakesOver = info && info.platform === 'windows';
    const label = installerTakesOver ? t.updateInstallerStarted : t.restartNow;
    return (
      <button
        type="button"
        data-testid="sidebar-update-ready"
        disabled={installerTakesOver || !bridge.available}
        onClick={() => bridge.available && bridge.updater.restartApp()}
        title={label}
        className={`h-9 w-[116px] shrink-0 truncate rounded-full px-1 text-[11px] font-medium disabled:cursor-default ${mutedClass}`}
      >
        {label}
      </button>
    );
  }

  if (available) {
    return (
      <button
        type="button"
        data-testid="sidebar-update-action"
        onClick={() => bridge.available && bridge.updater.downloadAndInstallUpdate()}
        title={error || `${t.newVersionFound}: v${latestVersion}`}
        aria-label={error || `${t.newVersionFound}: v${latestVersion}`}
        className={`relative flex h-9 w-[116px] shrink-0 items-center justify-end gap-2 rounded-full px-1 transition-colors ${mutedClass} ${dark ? 'hover:bg-white/[0.06]' : 'hover:bg-black/[0.04]'}`}
      >
        <span className="truncate text-[11px] font-medium">v{currentVersion}</span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0B57D0] text-white shadow-sm">
          <UpdateArrow />
        </span>
        {error && <span aria-hidden="true" className="absolute h-1.5 w-1.5 translate-x-0 -translate-y-3 rounded-full bg-[#EA4335]" />}
      </button>
    );
  }

  return (
    <div
      data-testid="sidebar-update-status"
      title={`${t.uiSettings.currentVersion}: v${currentVersion}`}
      className={`w-[116px] shrink-0 px-1 text-right text-[11px] font-medium leading-none ${mutedClass}`}
    >
      v{currentVersion}
    </div>
  );
}
