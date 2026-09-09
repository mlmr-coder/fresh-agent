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
    common::check_for_update_info(client, current_version, "windows", "exe").await
}

pub async fn download_update_package(
    info: &UpdateInfo,
    app: AppHandle,
    cancel: &AtomicBool,
    stall_timeout: Duration,
) -> Result<DownloadUpdateResult, String> {
    common::download_update_package(info, app, cancel, stall_timeout, "exe").await
}

pub fn install_downloaded_update(
    package_path: Option<String>,
    installer_path: Option<String>,
    info: Option<UpdateInfo>,
) -> Result<bool, String> {
    let package =
        common::validated_package_path(package_path.or(installer_path), info.as_ref(), "exe")?;
    Command::new(&package)
        .arg("/S")
        .spawn()
        .map_err(|error| format!("Failed to start the Fresh Assistant installer: {error}"))?;
    // Exit the old process after NSIS takes over so it can replace installed files.
    Ok(true)
}

pub async fn report_pending_update_result_info(
    _client: &reqwest::Client,
    _current_version: &str,
) -> Result<PendingUpdateReportResult, String> {
    Ok(PendingUpdateReportResult {
        had_pending: false,
        reported: false,
        result: String::new(),
        message: "This platform has no pending update result".to_string(),
    })
}
