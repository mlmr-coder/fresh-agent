use crate::features::{assistant::composer, sessions::SessionStore};
use std::path::Path;

#[tauri::command]
pub fn list_composer_skills(
    language: Option<String>,
    scope: Option<String>,
    workspace_path: Option<String>,
) -> Result<Vec<composer::ComposerSkill>, String> {
    use crate::core::session_mode::SessionMode;
    let scope = match scope.as_deref() {
        Some(value) if !value.trim().is_empty() => SessionMode::from_scope_str(value)
            .ok_or_else(|| format!("未知的技能 scope '{value}'，仅支持 \"plain\" 或 \"code\""))?,
        _ => SessionMode::Plain,
    };
    Ok(composer::skills_for_scope(
        language.as_deref().unwrap_or("zh"),
        scope,
        workspace_path.as_deref().map(Path::new),
    ))
}

#[tauri::command]
pub fn list_composer_display_skills(
    language: Option<String>,
    workspace_path: Option<String>,
) -> Result<Vec<composer::ComposerSkill>, String> {
    Ok(composer::display_skills(
        language.as_deref().unwrap_or("zh"),
        workspace_path.as_deref().map(Path::new),
    ))
}

#[tauri::command]
pub fn list_composer_files(
    session_id: String,
    store: tauri::State<'_, SessionStore>,
) -> Result<Vec<composer::ComposerFile>, String> {
    composer::files(&session_id, &store)
}

#[derive(serde::Serialize)]
pub struct ComposerConnector {
    id: String,
    name: String,
    installed: bool,
    connected: bool,
    companion_skills: Vec<String>,
    icon_data_url: Option<String>,
}

#[tauri::command]
pub async fn list_composer_connectors() -> Vec<ComposerConnector> {
    let checks = composer::connector_bundles()
        .into_iter()
        .map(|bundle| async move {
            let status = super::marketplace::bundle_readiness(bundle.id.clone()).await;
            let installed = status
                .as_ref()
                .map(|s| s.installed)
                .unwrap_or(bundle.installed);
            if !installed {
                return None;
            }
            let mut connected = status.as_ref().is_ok_and(|s| s.ready);
            if bundle.oauth && connected {
                connected = super::marketplace::get_marketplace_tool_auth_status(bundle.id.clone())
                    .await
                    .is_ok_and(|auth| auth.status == "connected");
            }
            Some(ComposerConnector {
                icon_data_url: crate::features::marketplace::bundle::bundle_icon_data_url(
                    &bundle.id,
                ),
                id: bundle.id,
                name: bundle.name,
                installed,
                connected,
                companion_skills: bundle.skills,
            })
        });
    futures_util::future::join_all(checks)
        .await
        .into_iter()
        .flatten()
        .collect()
}
