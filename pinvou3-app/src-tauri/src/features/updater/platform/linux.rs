use std::process::Command;
use std::sync::atomic::AtomicBool;
use std::time::Duration;

use tauri::AppHandle;

use super::super::{DownloadUpdateResult, PendingUpdateReportResult, UpdateInfo};
use super::common;

pub fn cleanup_stale_backup() {}

pub async fn check_for_update_info(
    client: &reqwest::Client,
    current_version: &str,
) -> Result<UpdateInfo, String> {
    common::check_for_update_info(client, current_version, "linux", "deb").await
}

pub async fn download_update_package(
    info: &UpdateInfo,
    app: AppHandle,
    cancel: &AtomicBool,
    stall_timeout: Duration,
) -> Result<DownloadUpdateResult, String> {
    common::download_update_package(info, app, cancel, stall_timeout, "deb").await
}

pub fn install_downloaded_update(
    package_path: Option<String>,
    installer_path: Option<String>,
    info: Option<UpdateInfo>,
) -> Result<bool, String> {
    let package =
        common::validated_package_path(package_path.or(installer_path), info.as_ref(), "deb")?;
    let output = Command::new("pkexec")
        .arg("apt-get")
        .args(["install", "-y", "--reinstall"])
        .arg(&package)
        .output()
        .map_err(|error| format!("Failed to start the system installer: {error}"))?;
    if output.status.success() {
        return Ok(false);
    }
    let code = output.status.code().unwrap_or(-1);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let details = stderr.lines().rev().take(4).collect::<Vec<_>>();
    let details = details.into_iter().rev().collect::<Vec<_>>().join(" / ");
    Err(match code {
        126 => "The user cancelled system installation authorization".to_string(),
        127 => "pkexec is unavailable or authorization was denied".to_string(),
        _ => format!("Installation failed (exit {code}): {details}"),
    })
}

pub async fn report_pending_update_result_info(
    _client: &reqwest::Client,
    _current_version: &str,
) -> Result<PendingUpdateReportResult, String> {
    Ok(no_pending_report())
}

fn no_pending_report() -> PendingUpdateReportResult {
    PendingUpdateReportResult {
        had_pending: false,
        reported: false,
        result: String::new(),
        message: "This platform has no pending update result".to_string(),
    }
}
