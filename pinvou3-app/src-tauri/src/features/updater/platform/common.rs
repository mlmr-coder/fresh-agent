use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use semver::Version;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};
use tokio::time::timeout;

use super::super::{DownloadUpdateResult, PlatformAsset, UpdateInfo};
use crate::platform::{encoding::hex_lower, hashing::sha256_file, paths};

const UPDATE_MANIFEST_URL: &str =
    "https://github.com/mlmr-coder/fresh-agent/releases/latest/download/latest.json";
const UPDATE_MANIFEST_ENV: &str = "PINVOU3_UPDATE_URL";
const GITHUB_RELEASE_PREFIX: &str = "https://github.com/mlmr-coder/fresh-agent/releases/download/";
const MAX_DOWNLOAD_BYTES: u64 = 4 * 1024 * 1024 * 1024;

#[derive(Debug, Clone, Deserialize)]
struct LatestManifest {
    schema_version: u32,
    version: String,
    #[serde(default)]
    notes: String,
    #[serde(default)]
    pub_date: String,
    #[serde(default)]
    platforms: HashMap<String, PlatformAsset>,
}

fn manifest_url() -> (String, bool) {
    #[cfg(debug_assertions)]
    if let Ok(value) = std::env::var(UPDATE_MANIFEST_ENV) {
        if !value.trim().is_empty() {
            return (value, true);
        }
    }
    (UPDATE_MANIFEST_URL.to_string(), false)
}

fn update_source_overridden() -> bool {
    manifest_url().1
}

fn validate_manifest_schema(manifest: &LatestManifest) -> Result<(), String> {
    if manifest.schema_version == 1 {
        Ok(())
    } else {
        Err(format!(
            "Unsupported latest.json schema version: {}",
            manifest.schema_version
        ))
    }
}

pub(super) fn platform_key(os: &str, arch: &str) -> Option<&'static str> {
    match (os, arch) {
        ("macos", _) => Some("macos-universal"),
        ("linux", "x86_64") => Some("linux-x64"),
        ("linux", "aarch64") => Some("linux-arm64"),
        ("windows", "x86_64") => Some("windows-x64"),
        _ => None,
    }
}

pub(super) async fn check_for_update_info(
    client: &reqwest::Client,
    current_version: &str,
    platform: &str,
    expected_format: &str,
) -> Result<UpdateInfo, String> {
    let key = platform_key(std::env::consts::OS, std::env::consts::ARCH).ok_or_else(|| {
        format!(
            "In-app updates are unsupported on {}-{}",
            std::env::consts::OS,
            std::env::consts::ARCH
        )
    })?;
    let (source, source_overridden) = manifest_url();
    let manifest: LatestManifest = client
        .get(&source)
        .header(reqwest::header::CACHE_CONTROL, "no-cache")
        .send()
        .await
        .map_err(|error| format!("Failed to connect to the update source: {error}"))?
        .error_for_status()
        .map_err(|error| format!("The update source returned an error: {error}"))?
        .json()
        .await
        .map_err(|error| format!("Failed to parse latest.json: {error}"))?;
    validate_manifest_schema(&manifest)?;

    let asset = manifest
        .platforms
        .get(key)
        .ok_or_else(|| format!("latest.json has no asset for {key}"))?;
    if !asset.format.eq_ignore_ascii_case(expected_format) {
        return Err(format!(
            "Invalid asset format for this platform: expected {expected_format}, got {}",
            asset.format
        ));
    }
    validate_sha256(&asset.sha256)?;
    if asset.size == 0 || asset.size > MAX_DOWNLOAD_BYTES {
        return Err(format!(
            "Invalid asset size for this platform: {} bytes",
            asset.size
        ));
    }
    validate_asset_url(&asset.url, source_overridden)?;

    let latest_version = if asset.version.trim().is_empty() {
        manifest.version.trim()
    } else {
        asset.version.trim()
    };
    let latest = parse_version(latest_version, "latest.json version")?;
    let current = parse_version(current_version, "current version")?;
    let notes = if asset.notes.trim().is_empty() {
        manifest.notes.clone()
    } else {
        asset.notes.clone()
    };

    Ok(UpdateInfo {
        available: latest > current,
        current_version: current_version.to_string(),
        latest_version: latest_version.to_string(),
        notes,
        pub_date: manifest.pub_date,
        url: asset.url.clone(),
        sha256: asset.sha256.to_ascii_lowercase(),
        size: asset.size,
        platform: platform.to_string(),
        platforms: manifest.platforms,
    })
}

pub(super) async fn download_update_package(
    info: &UpdateInfo,
    app: AppHandle,
    cancel: &AtomicBool,
    stall_timeout: Duration,
    extension: &str,
) -> Result<DownloadUpdateResult, String> {
    validate_sha256(&info.sha256)?;
    validate_asset_url(&info.url, update_source_overridden())?;
    if info.size == 0 || info.size > MAX_DOWNLOAD_BYTES {
        return Err(format!("Invalid update package size: {} bytes", info.size));
    }

    let dir = paths::updates_dir();
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("Failed to create the update directory: {error}"))?;
    let basename = format!(
        "fresh-agent-{}-{}.{}",
        safe_component(&info.latest_version),
        safe_component(&info.platform),
        extension
    );
    let destination = dir.join(&basename);
    let temporary = dir.join(format!("{basename}.part.{}", std::process::id()));
    let expected = info.sha256.to_ascii_lowercase();

    if destination.is_file() && sha256_file(&destination).ok().as_deref() == Some(expected.as_str())
    {
        return Ok(DownloadUpdateResult::Path(
            destination.to_string_lossy().into_owned(),
        ));
    }
    remove_stale_downloads(&dir, &destination);
    let _ = std::fs::remove_file(&temporary);

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| format!("Failed to create the HTTP client: {error}"))?;
    let mut response = client
        .get(&info.url)
        .send()
        .await
        .map_err(|error| format!("Failed to request the update package: {error}"))?
        .error_for_status()
        .map_err(|error| format!("The update download returned an error: {error}"))?;
    if let Some(length) = response.content_length() {
        if length != info.size {
            return Err(format!(
                "Package size differs from latest.json: manifest {} bytes, response {} bytes",
                info.size, length
            ));
        }
    }

    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|error| format!("Failed to create the temporary download: {error}"))?;
    let mut hasher = Sha256::new();
    let mut downloaded = 0_u64;
    let mut last_emitted = 0_u64;
    cancel.store(false, Ordering::SeqCst);

    let transfer: Result<String, String> = async {
        loop {
            if cancel.load(Ordering::SeqCst) {
                return Err("The update download was cancelled".to_string());
            }
            let chunk = match timeout(stall_timeout, response.chunk()).await {
                Err(_) => {
                    return Err(format!(
                        "The update download stalled for more than {} seconds",
                        stall_timeout.as_secs()
                    ));
                }
                Ok(Err(error)) => return Err(format!("The update download failed: {error}")),
                Ok(Ok(None)) => break,
                Ok(Ok(Some(chunk))) => chunk,
            };
            downloaded = downloaded.saturating_add(chunk.len() as u64);
            if downloaded > info.size || downloaded > MAX_DOWNLOAD_BYTES {
                return Err(
                    "The downloaded data exceeds the size declared in latest.json".to_string(),
                );
            }
            file.write_all(&chunk)
                .map_err(|error| format!("Failed to write the update file: {error}"))?;
            hasher.update(&chunk);
            if downloaded.saturating_sub(last_emitted) >= 256 * 1024 || downloaded == info.size {
                last_emitted = downloaded;
                let _ = app.emit(
                    "update:progress",
                    serde_json::json!({ "downloaded": downloaded, "total": info.size }),
                );
            }
        }
        file.flush()
            .map_err(|error| format!("Failed to flush the update file: {error}"))?;
        if downloaded != info.size {
            return Err(format!(
                "The update package is incomplete: expected {} bytes, got {} bytes",
                info.size, downloaded
            ));
        }
        Ok(hex_lower(&hasher.finalize()))
    }
    .await;

    let actual = match transfer {
        Ok(actual) => actual,
        Err(error) => {
            drop(file);
            let _ = std::fs::remove_file(&temporary);
            return Err(error);
        }
    };
    drop(file);
    if actual != expected {
        let _ = std::fs::remove_file(&temporary);
        return Err(format!(
            "SHA-256 verification failed: expected {expected}, got {actual}"
        ));
    }
    if destination.exists() {
        std::fs::remove_file(&destination)
            .map_err(|error| format!("Failed to remove the old update file: {error}"))?;
    }
    std::fs::rename(&temporary, &destination)
        .map_err(|error| format!("Failed to save the update file: {error}"))?;
    Ok(DownloadUpdateResult::Path(
        destination.to_string_lossy().into_owned(),
    ))
}

pub(super) fn validated_package_path(
    package_path: Option<String>,
    info: Option<&UpdateInfo>,
    extension: &str,
) -> Result<PathBuf, String> {
    let raw = package_path.ok_or_else(|| format!("Missing .{extension} update file path"))?;
    let path = Path::new(&raw)
        .canonicalize()
        .map_err(|error| format!("The update file does not exist: {error}"))?;
    let update_dir = paths::updates_dir()
        .canonicalize()
        .map_err(|error| format!("The update directory does not exist: {error}"))?;
    if !path.starts_with(&update_dir) {
        return Err("The update file is outside the Fresh Assistant update directory".to_string());
    }
    if !path
        .extension()
        .is_some_and(|value| value.eq_ignore_ascii_case(extension))
    {
        return Err(format!("Invalid update file type: expected .{extension}"));
    }
    let expected = info
        .map(|value| value.sha256.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Missing update SHA-256; installation was rejected".to_string())?;
    validate_sha256(&expected)?;
    let actual =
        sha256_file(&path).map_err(|error| format!("Failed to verify the update file: {error}"))?;
    if actual != expected {
        return Err(format!(
            "Pre-install SHA-256 verification failed: expected {expected}, got {actual}"
        ));
    }
    Ok(path)
}

fn parse_version(value: &str, field: &str) -> Result<Version, String> {
    Version::parse(value.trim().trim_start_matches('v'))
        .map_err(|error| format!("Invalid SemVer in {field}: {error}"))
}

fn validate_sha256(value: &str) -> Result<(), String> {
    let value = value.trim();
    if value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Ok(())
    } else {
        Err("latest.json SHA-256 must contain 64 hexadecimal characters".to_string())
    }
}

fn validate_asset_url(value: &str, source_overridden: bool) -> Result<(), String> {
    if source_overridden {
        return if value.starts_with("http://") || value.starts_with("https://") {
            Ok(())
        } else {
            Err("The overridden update URL must use HTTP or HTTPS".to_string())
        };
    }
    if value.starts_with(GITHUB_RELEASE_PREFIX) {
        Ok(())
    } else {
        Err("Update assets must come from the fresh-agent GitHub Release".to_string())
    }
}

fn safe_component(value: &str) -> String {
    let value: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                character
            } else {
                '_'
            }
        })
        .collect();
    if value.is_empty() {
        "unknown".to_string()
    } else {
        value
    }
}

fn remove_stale_downloads(dir: &Path, keep: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path == keep {
            continue;
        }
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with("fresh-agent-")
            && (name.ends_with(".deb")
                || name.ends_with(".dmg")
                || name.ends_with(".exe")
                || name.contains(".part."))
        {
            let _ = std::fs::remove_file(path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn platform_keys_match_release_manifest() {
        assert_eq!(platform_key("macos", "aarch64"), Some("macos-universal"));
        assert_eq!(platform_key("macos", "x86_64"), Some("macos-universal"));
        assert_eq!(platform_key("linux", "x86_64"), Some("linux-x64"));
        assert_eq!(platform_key("linux", "aarch64"), Some("linux-arm64"));
        assert_eq!(platform_key("windows", "x86_64"), Some("windows-x64"));
        assert_eq!(platform_key("windows", "aarch64"), None);
    }

    #[test]
    fn semver_comparison_handles_prereleases() {
        let release = parse_version("v1.0.0", "test").unwrap();
        let candidate = parse_version("1.0.0-rc.1", "test").unwrap();
        assert!(release > candidate);
    }

    #[test]
    fn sha256_validation_is_strict() {
        assert!(validate_sha256(&"a".repeat(64)).is_ok());
        assert!(validate_sha256(&"g".repeat(64)).is_err());
        assert!(validate_sha256("abc").is_err());
    }

    #[test]
    fn safe_component_blocks_path_separators() {
        assert_eq!(safe_component("1.2.3/../../bad"), "1.2.3_.._.._bad");
    }

    #[test]
    fn manifest_schema_rejects_unknown_versions() {
        let manifest: LatestManifest = serde_json::from_str(
            r#"{
                "schema_version": 2,
                "version": "1.0.0",
                "platforms": {}
            }"#,
        )
        .unwrap();
        assert!(validate_manifest_schema(&manifest).is_err());
    }
}
