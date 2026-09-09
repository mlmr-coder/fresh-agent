use crate::features::{assistant::composer, sessions::SessionStore};

#[tauri::command]
pub fn list_composer_skills(language: Option<String>) -> Vec<composer::ComposerSkill> {
    composer::skills(language.as_deref().unwrap_or("zh"))
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
