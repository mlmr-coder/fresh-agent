//! Composer suggestions adapt the existing skill catalogue and session files.
//! No separate skill parser, registry, execution loop or permission state.
// architecture-guard: allow-target-cfg -- Unix-only symlink fixtures in tests; production file discovery uses portable std::fs.
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use serde::Serialize;

#[derive(Serialize)]
pub struct ComposerSkill {
    name: String,
    title: String,
    catalogue_id: String,
    description: String,
    aliases: Vec<String>,
}

pub fn skills(language: &str) -> Vec<ComposerSkill> {
    let metadata = crate::features::marketplace::skill_marketplace::SkillMarketplaceManager::new()
        .list_skills();
    catalogue_from_sources(
        super::skill_materialization::enabled_skills_for(
            crate::features::marketplace::ConnectorScope::Plain,
            None,
        ),
        &metadata,
        language,
    )
}

fn catalogue_from_sources(
    sources: Vec<(String, PathBuf)>,
    metadata: &[crate::features::marketplace::skill_marketplace::MarketplaceSkillInfo],
    language: &str,
) -> Vec<ComposerSkill> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    let mut registries = HashMap::new();
    for (directory_name, source) in sources {
        let Some(parent) = source.parent() else {
            continue;
        };
        // CodeWhale discovers SKILL.md in child directories, not in the supplied
        // root itself. Filter the collection to directories admitted by scope.
        let registry = registries
            .entry(parent.to_path_buf())
            .or_insert_with(|| deepseek_tui::skills::SkillRegistry::discover(parent));
        for skill in registry
            .list()
            .iter()
            .filter(|skill| skill.path.parent() == Some(source.as_path()))
        {
            if seen.insert(skill.name.clone()) {
                out.push(ComposerSkill {
                    name: skill.name.clone(),
                    title: metadata
                        .iter()
                        .find(|entry| entry.id == directory_name || entry.id == skill.name)
                        .map(|entry| entry.title.clone())
                        .unwrap_or_else(|| skill.name.clone()),
                    catalogue_id: directory_name.clone(),
                    description: skill.description_for_locale(language).to_string(),
                    aliases: skill.aliases.clone(),
                });
            }
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

pub fn connector_bundles() -> Vec<crate::features::marketplace::bundle::BundleInfo> {
    use crate::features::marketplace::bundle::{BundleKind, BundleRegistry};
    BundleRegistry::new()
        .list_bundles()
        .into_iter()
        .filter(|bundle| {
            // Credential-backed skill packages (for example ima) are connectors too.
            (bundle.kind != BundleKind::Skill || !bundle.credentials.is_empty())
                && (bundle.installed
                    || bundle.kind == BundleKind::Cli
                    || (bundle.kind == BundleKind::Skill && !bundle.credentials.is_empty()))
        })
        .collect()
}

#[derive(Serialize)]
pub struct ComposerFile {
    name: String,
    path: String,
}

pub fn files(
    session_id: &str,
    store: &crate::features::sessions::SessionStore,
) -> Result<Vec<ComposerFile>, String> {
    let root = store.ledger_root(session_id).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    collect_files(&root, 0, &mut out);
    collect_files(&root.join("attachments"), 4, &mut out);
    collect_files(
        &crate::platform::paths::session_artifacts_dir(session_id),
        4,
        &mut out,
    );
    out.sort_by(|a, b| a.path.cmp(&b.path));
    out.dedup_by(|a, b| a.path == b.path);
    Ok(out)
}

fn collect_files(dir: &Path, depth: usize, out: &mut Vec<ComposerFile>) {
    if std::fs::symlink_metadata(dir).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let mut entries = entries.flatten().collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        if out.len() >= 500 {
            break;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.')
            || name.starts_with("~$")
            || name.ends_with('~')
            || [".tmp", ".bak", ".swp", ".swo"]
                .iter()
                .any(|suffix| name.ends_with(suffix))
        {
            continue;
        }
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        // Do not follow links out of the conversation's file roots.
        if kind.is_file() {
            out.push(ComposerFile {
                name,
                path: entry.path().to_string_lossy().into_owned(),
            });
        } else if kind.is_dir() && depth > 0 {
            collect_files(&entry.path(), depth - 1, out);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn composer_catalogue_discovers_allowed_directories_and_excludes_siblings() {
        let temp = tempfile::tempdir().unwrap();
        for name in ["visualizer", "disabled-skill"] {
            let dir = temp.path().join(name);
            std::fs::create_dir(&dir).unwrap();
            std::fs::write(dir.join("SKILL.md"), format!("---\nname: {name}\ndescription: Charts\ndescription_zh: 数据图表\naliases-for: chart\n---\nSkill body\n")).unwrap();
        }
        let entries = catalogue_from_sources(
            vec![("visualizer".to_string(), temp.path().join("visualizer"))],
            &[],
            "zh",
        );
        assert_eq!(entries.len(), 1, "discover must scan the parent collection");
        assert_eq!(entries[0].name, "visualizer");
        assert_eq!(entries[0].description, "数据图表");
        assert_eq!(entries[0].aliases, vec!["chart"]);
    }

    #[test]
    fn composer_files_include_nested_attachments_but_skip_hidden_temporary_and_links() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::create_dir(temp.path().join("nested")).unwrap();
        for name in [
            "report.md",
            "nested/同名 文件.csv",
            ".private",
            "draft.tmp",
            "~$document.docx",
        ] {
            std::fs::write(temp.path().join(name), "fixture").unwrap();
        }
        #[cfg(unix)]
        std::os::unix::fs::symlink(temp.path(), temp.path().join("linked")).unwrap();
        let mut files = Vec::new();
        collect_files(temp.path(), 4, &mut files);
        assert_eq!(files.len(), 2);
        assert!(files.iter().any(|file| file.name == "同名 文件.csv"));
        assert!(files.iter().all(|file| Path::new(&file.path).is_file()));
        #[cfg(unix)]
        {
            let mut linked = Vec::new();
            collect_files(&temp.path().join("linked"), 4, &mut linked);
            assert!(linked.is_empty());
        }
    }
}
