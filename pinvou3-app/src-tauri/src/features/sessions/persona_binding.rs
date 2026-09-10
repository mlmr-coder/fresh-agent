//! Durable expert selection belongs to the conversation, not the app bundle.
//! Restore only the selected card ID from legacy display events; card bodies
//! always come from the expert registry, never from the event payload.

use std::io::ErrorKind;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use super::{SessionStore, validate_session_id};

const BINDING_FILE: &str = "persona.json";

#[derive(Serialize, Deserialize)]
struct PersonaBinding {
    // An explicit null is a durable removal, preventing old events from
    // resurrecting an expert after the next restart.
    persona_id: Option<String>,
}

fn write_binding(path: &std::path::Path, binding: &PersonaBinding) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).context("create expert binding directory")?;
    }
    let bytes = serde_json::to_vec(binding).context("serialize expert binding")?;
    deepseek_tui::utils::write_atomic(path, &bytes).context("save expert binding")
}

impl SessionStore {
    /// Commit the binding before publishing it to the UI/runtime. A failed
    /// save leaves both the previous identity and pending injection intact.
    pub fn set_session_persona(
        &self,
        id: &str,
        persona_id: Option<String>,
        body: Option<String>,
    ) -> Result<()> {
        validate_session_id(id)?;
        self.load(id).context("load session for expert binding")?;
        let default_mode = self.resolved_default_mode(id);
        let mut states = self.mode_states.write();
        let binding = PersonaBinding { persona_id };
        write_binding(
            &self.manager.sessions_dir().join(id).join(BINDING_FILE),
            &binding,
        )?;
        let state = Self::mode_state_entry(&mut states, id, default_mode);
        state.pending_persona_body = binding.persona_id.as_ref().and(body);
        state.active_persona = binding.persona_id;
        state.persona_loaded = true;
        Ok(())
    }

    /// Lazy restoration works for cold startup, session switching and stores
    /// reopened against the same user data after an application reinstall.
    pub(crate) fn ensure_session_persona_loaded(&self, id: &str) -> Result<()> {
        validate_session_id(id)?;
        if self
            .mode_states
            .read()
            .get(id)
            .is_some_and(|state| state.persona_loaded)
        {
            return Ok(());
        }
        self.load(id)
            .context("load session for expert restoration")?;
        let root = self.manager.sessions_dir().join(id);
        let path = root.join(BINDING_FILE);
        let default_mode = self.resolved_default_mode(id);
        let mut states = self.mode_states.write();
        let state = Self::mode_state_entry(&mut states, id, default_mode);
        if state.persona_loaded {
            return Ok(()); // An equip/unequip completed while the session was loading.
        }
        let binding = match std::fs::read_to_string(&path) {
            Ok(content) => {
                serde_json::from_str::<PersonaBinding>(&content).context("read expert binding")?
            }
            Err(error) if error.kind() == ErrorKind::NotFound => {
                let mut binding = PersonaBinding { persona_id: None };
                match std::fs::read_to_string(root.join("persona_events.json")) {
                    Ok(content) => {
                        let events: Vec<serde_json::Value> =
                            serde_json::from_str(&content).context("read legacy expert events")?;
                        let mut found = false;
                        for event in events {
                            match event.get("kind").and_then(|kind| kind.as_str()) {
                                Some("equip") => {
                                    binding.persona_id = event
                                        .pointer("/card/id")
                                        .and_then(|id| id.as_str())
                                        .map(str::to_string);
                                    found = true;
                                }
                                Some("unequip") => {
                                    binding.persona_id = None;
                                    found = true;
                                }
                                _ => {}
                            }
                        }
                        if found {
                            write_binding(&path, &binding)?;
                        }
                    }
                    Err(error) if error.kind() == ErrorKind::NotFound => {}
                    Err(error) => return Err(error).context("read legacy expert events"),
                }
                binding
            }
            Err(error) => return Err(error).context("read expert binding"),
        };
        // Re-establish the full persona once on the first resumed turn. The
        // existing transactional injection guard handles submission failures;
        // later reads/turns keep the normal short persona anchor.
        state.pending_persona_body = binding
            .persona_id
            .as_deref()
            .and_then(crate::features::personas::get)
            .map(|card| crate::features::personas::equip_body_injection(&card));
        state.active_persona = binding.persona_id;
        state.persona_loaded = true;
        Ok(())
    }
}
