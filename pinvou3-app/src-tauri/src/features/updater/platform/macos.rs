use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::AtomicBool;
use std::time::Duration;

use tauri::AppHandle;

use super::super::{DownloadUpdateResult, PendingUpdateReportResult, UpdateInfo};
use super::common;
use crate::platform::paths;

const EXPECTED_BUNDLE_ID: &str = "com.pinvou.pinvou3";

pub fn cleanup_stale_backup() {
    let Ok(target) = current_app_bundle() else {
        return;
    };
    if let Some(backup) = sibling_path(&target, ".fresh-assistant-update-backup") {
        let _ = remove_existing_path(&backup);
    }
}

pub async fn check_for_update_info(
    client: &reqwest::Client,
    current_version: &str,
) -> Result<UpdateInfo, String> {
    common::check_for_update_info(client, current_version, "macos", "dmg").await
}

pub async fn download_update_package(
    info: &UpdateInfo,
    app: AppHandle,
    cancel: &AtomicBool,
    stall_timeout: Duration,
) -> Result<DownloadUpdateResult, String> {
    common::download_update_package(info, app, cancel, stall_timeout, "dmg").await
}

pub fn install_downloaded_update(
    package_path: Option<String>,
    installer_path: Option<String>,
    info: Option<UpdateInfo>,
) -> Result<bool, String> {
    let package =
        common::validated_package_path(package_path.or(installer_path), info.as_ref(), "dmg")?;
    let info = info.ok_or_else(|| "Missing update metadata".to_string())?;
    install_dmg(&package, &info)?;
    let _ = std::fs::remove_file(&package);
    Ok(false)
}

fn install_dmg(dmg: &Path, info: &UpdateInfo) -> Result<(), String> {
    let mountpoint = paths::updates_dir().join(format!(".dmg-mount-{}", std::process::id()));
    if mountpoint.symlink_metadata().is_ok() {
        let _ = Command::new("/usr/bin/hdiutil")
            .arg("detach")
            .arg(&mountpoint)
            .arg("-force")
            .status();
        remove_existing_path(&mountpoint)?;
    }
    std::fs::create_dir(&mountpoint)
        .map_err(|error| format!("Failed to create the disk image mount point: {error}"))?;
    let output = Command::new("/usr/bin/hdiutil")
        .args(["attach", "-readonly", "-nobrowse", "-mountpoint"])
        .arg(&mountpoint)
        .arg(dmg)
        .output()
        .map_err(|error| format!("Failed to mount the Fresh Assistant disk image: {error}"))?;
    if !output.status.success() {
        let _ = std::fs::remove_dir(&mountpoint);
        return Err(format!(
            "Failed to mount the Fresh Assistant disk image: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let guard = MountGuard(mountpoint.clone());
    let source = find_app_bundle(&mountpoint)?;
    verify_app_bundle(&source, &info.latest_version)?;
    let target = current_app_bundle()?;
    replace_app_bundle(&source, &target, &info.latest_version)?;
    drop(guard);
    Ok(())
}

struct MountGuard(PathBuf);

impl Drop for MountGuard {
    fn drop(&mut self) {
        let _ = Command::new("/usr/bin/hdiutil")
            .arg("detach")
            .arg(&self.0)
            .arg("-force")
            .status();
        let _ = std::fs::remove_dir(&self.0);
    }
}

fn find_app_bundle(mountpoint: &Path) -> Result<PathBuf, String> {
    let entries = std::fs::read_dir(mountpoint)
        .map_err(|error| format!("Failed to inspect the mounted disk image: {error}"))?;
    let apps = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.symlink_metadata()
                .is_ok_and(|metadata| metadata.is_dir() && !metadata.file_type().is_symlink())
                && path
                    .extension()
                    .is_some_and(|extension| extension.eq_ignore_ascii_case("app"))
        })
        .collect::<Vec<_>>();
    match apps.as_slice() {
        [app] => Ok(app.clone()),
        _ => Err(format!(
            "Expected one application in the disk image, found {}",
            apps.len()
        )),
    }
}

fn verify_app_bundle(app: &Path, expected_version: &str) -> Result<(), String> {
    let plist = app.join("Contents/Info.plist");
    let identifier = plist_value(&plist, "CFBundleIdentifier")?;
    if identifier != EXPECTED_BUNDLE_ID {
        return Err(format!(
            "Unexpected application identifier: expected {EXPECTED_BUNDLE_ID}, got {identifier}"
        ));
    }
    let version = plist_value(&plist, "CFBundleShortVersionString")?;
    if version != expected_version {
        return Err(format!(
            "Disk image version differs from latest.json: expected {expected_version}, got {version}"
        ));
    }
    let output = Command::new("/usr/bin/codesign")
        .args(["--verify", "--deep", "--strict"])
        .arg(app)
        .output()
        .map_err(|error| format!("Failed to verify the application signature: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "Application signature verification failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

fn plist_value(plist: &Path, key: &str) -> Result<String, String> {
    let output = Command::new("/usr/libexec/PlistBuddy")
        .args(["-c", &format!("Print :{key}")])
        .arg(plist)
        .output()
        .map_err(|error| format!("Failed to read {key}: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "Failed to read {key}: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn current_app_bundle() -> Result<PathBuf, String> {
    let executable = std::env::current_exe()
        .map_err(|error| format!("Failed to locate the running application: {error}"))?;
    executable
        .ancestors()
        .find(|path| {
            path.extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("app"))
        })
        .map(Path::to_path_buf)
        .ok_or_else(|| {
            "Automatic updates require running Fresh Assistant from an app bundle".to_string()
        })
}

fn sibling_path(target: &Path, name: &str) -> Option<PathBuf> {
    target.parent().map(|parent| parent.join(name))
}

fn remove_existing_path(path: &Path) -> Result<(), String> {
    let Ok(metadata) = path.symlink_metadata() else {
        return Ok(());
    };
    if metadata.file_type().is_symlink() || metadata.is_file() {
        std::fs::remove_file(path)
    } else {
        std::fs::remove_dir_all(path)
    }
    .map_err(|error| format!("Failed to remove stale update data: {error}"))
}

fn replace_app_bundle(source: &Path, target: &Path, expected_version: &str) -> Result<(), String> {
    let staging = sibling_path(
        target,
        &format!(".fresh-assistant-update-staging-{}", std::process::id()),
    )
    .ok_or_else(|| "The installed application has no parent directory".to_string())?;
    let backup = sibling_path(target, ".fresh-assistant-update-backup")
        .ok_or_else(|| "The installed application has no parent directory".to_string())?;
    remove_existing_path(&staging)?;
    remove_existing_path(&backup)?;

    let copy = Command::new("/usr/bin/ditto")
        .arg(source)
        .arg(&staging)
        .output()
        .map_err(|error| format!("Failed to stage the new application: {error}"))?;
    if !copy.status.success() {
        return Err(format!(
            "Failed to stage the new application: {}",
            String::from_utf8_lossy(&copy.stderr).trim()
        ));
    }
    if let Err(error) = verify_app_bundle(&staging, expected_version) {
        let _ = remove_existing_path(&staging);
        return Err(format!(
            "The staged application failed verification: {error}"
        ));
    }

    std::fs::rename(target, &backup)
        .map_err(|error| format!("Failed to back up the installed application: {error}"))?;
    if let Err(error) = std::fs::rename(&staging, target) {
        let rollback = std::fs::rename(&backup, target);
        let _ = remove_existing_path(&staging);
        return match rollback {
            Ok(()) => Err(format!(
                "Failed to activate the update; the old version was restored: {error}"
            )),
            Err(rollback_error) => Err(format!(
                "Failed to activate the update ({error}) and restore the old version ({rollback_error})"
            )),
        };
    }
    Ok(())
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
