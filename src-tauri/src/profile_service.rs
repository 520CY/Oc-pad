use std::{fs, path::PathBuf};

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::{
    config_render, config_source, config_writer,
    models::{utc_now_rfc3339, ActivationResult, CreateProfileInput, Profile, UpdateProfileInput},
};

const PROFILE_COLUMNS: &str = "id, name, description, tags, opencode_config, ohmyoc_enabled, ohmyoc_config, target_path, stats_enabled, created_at, updated_at, last_activated_at";
const SYSTEM_PROFILE_ID: &str = "__oc_pad_system_current__";
const PROJECT_ROOT_KEY: &str = "project_root";

pub fn list_profiles(conn: &Connection) -> Result<Vec<Profile>, String> {
    let active_profile_id = get_active_profile_id(conn)?;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {PROFILE_COLUMNS} FROM profiles ORDER BY updated_at DESC"
        ))
        .map_err(|err| format!("failed to prepare list profiles query: {err}"))?;

    let profiles = stmt
        .query_map([], |row| map_profile_row(row, active_profile_id.as_deref()))
        .map_err(|err| format!("failed to query profiles: {err}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to map profiles: {err}"))?;

    Ok(profiles)
}

pub fn get_profile(conn: &Connection, id: &str) -> Result<Profile, String> {
    let active_profile_id = get_active_profile_id(conn)?;
    conn.query_row(
        &format!("SELECT {PROFILE_COLUMNS} FROM profiles WHERE id = ?1"),
        params![id],
        |row| map_profile_row(row, active_profile_id.as_deref()),
    )
    .map_err(|err| format!("failed to load profile {id}: {err}"))
}

pub fn create_profile(conn: &Connection, input: &CreateProfileInput) -> Result<Profile, String> {
    let id = Uuid::new_v4().to_string();
    let now = utc_now_rfc3339();
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("profile name cannot be empty".to_string());
    }

    let opencode_config = normalize_config_text(&input.opencode_config, "{}");
    let ohmyoc_config = input
        .ohmyoc_config
        .as_deref()
        .map(|value| normalize_config_text(value, "{}"))
        .unwrap_or_else(|| "{}\n".to_string());
    let description = input.description.clone().unwrap_or_default();
    let target_path = input.target_path.clone().unwrap_or_default();
    let tags_json = serde_json::to_string(&input.tags.clone().unwrap_or_default())
        .map_err(|err| format!("failed to serialize tags: {err}"))?;
    let ohmyoc_enabled = input.ohmyoc_enabled.unwrap_or(false);
    let stats_enabled = input.stats_enabled.unwrap_or(false);

    conn.execute(
        "INSERT INTO profiles (
            id, name, description, tags, opencode_config, ohmyoc_enabled, ohmyoc_config, target_path,
            stats_enabled, created_at, updated_at, last_activated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, NULL)",
        params![
            &id,
            &name,
            &description,
            &tags_json,
            &opencode_config,
            bool_to_int(ohmyoc_enabled),
            &ohmyoc_config,
            &target_path,
            bool_to_int(stats_enabled),
            &now,
            &now
        ],
    )
    .map_err(|err| format!("failed to create profile: {err}"))?;

    get_profile(conn, &id)
}

pub fn update_profile(
    conn: &Connection,
    id: &str,
    input: &UpdateProfileInput,
) -> Result<Profile, String> {
    let current = get_profile(conn, id)?;
    let now = utc_now_rfc3339();

    let next_name = input.name.clone().unwrap_or(current.name);
    if next_name.trim().is_empty() {
        return Err("profile name cannot be empty".to_string());
    }

    let next_description = input.description.clone().unwrap_or(current.description);
    let next_tags = input.tags.clone().unwrap_or(current.tags);
    let next_tags_json = serde_json::to_string(&next_tags)
        .map_err(|err| format!("failed to serialize tags: {err}"))?;
    let next_opencode = input
        .opencode_config
        .as_deref()
        .map(|value| normalize_config_text(value, "{}"))
        .unwrap_or(current.opencode_config);
    let next_ohmy_enabled = input.ohmyoc_enabled.unwrap_or(current.ohmyoc_enabled);
    let next_ohmy_config = input
        .ohmyoc_config
        .as_deref()
        .map(|value| normalize_config_text(value, "{}"))
        .unwrap_or(current.ohmyoc_config);
    let next_target_path = input.target_path.clone().unwrap_or(current.target_path);
    let next_stats_enabled = input.stats_enabled.unwrap_or(current.stats_enabled);

    conn.execute(
        "UPDATE profiles
         SET name = ?2, description = ?3, tags = ?4, opencode_config = ?5, ohmyoc_enabled = ?6,
             ohmyoc_config = ?7, target_path = ?8, stats_enabled = ?9, updated_at = ?10
         WHERE id = ?1",
        params![
            id,
            next_name,
            next_description,
            next_tags_json,
            next_opencode,
            bool_to_int(next_ohmy_enabled),
            next_ohmy_config,
            next_target_path,
            bool_to_int(next_stats_enabled),
            now
        ],
    )
    .map_err(|err| format!("failed to update profile {id}: {err}"))?;

    get_profile(conn, id)
}

pub fn delete_profile(conn: &Connection, id: &str) -> Result<(), String> {
    let now = utc_now_rfc3339();
    let tx = conn
        .unchecked_transaction()
        .map_err(|err| format!("failed to start delete transaction: {err}"))?;

    tx.execute("DELETE FROM profiles WHERE id = ?1", params![id])
        .map_err(|err| format!("failed to delete profile {id}: {err}"))?;
    tx.execute(
        "DELETE FROM settings WHERE key = 'active_profile_id' AND value = ?1",
        params![id],
    )
    .map_err(|err| format!("failed to clear active profile setting: {err}"))?;
    tx.execute(
        "UPDATE activation_events
         SET deactivated_at = ?1
         WHERE profile_id = ?2 AND deactivated_at IS NULL",
        params![now, id],
    )
    .map_err(|err| format!("failed to close activation events for profile {id}: {err}"))?;

    tx.commit()
        .map_err(|err| format!("failed to commit delete transaction: {err}"))?;
    Ok(())
}

pub fn activate_profile(
    conn: &Connection,
    profile_id: &str,
    requested_target_path: Option<String>,
) -> Result<ActivationResult, String> {
    let profile = get_profile(conn, profile_id)?;
    let rendered = config_render::render_profile_configs(&profile)?;

    let target_override = requested_target_path
        .as_deref()
        .filter(|path| !path.trim().is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            if profile.target_path.trim().is_empty() {
                None
            } else {
                Some(profile.target_path.clone())
            }
        });

    let write_result = config_writer::write_profile_configs(target_override.as_deref(), &rendered)?;
    let activated_at = utc_now_rfc3339();
    let previous_active_profile = get_active_profile_id(conn)?;

    let profile_id = profile.id.clone();
    let tx = conn
        .unchecked_transaction()
        .map_err(|err| format!("failed to start activation transaction: {err}"))?;

    if let Some(previous_id) = previous_active_profile {
        if previous_id != profile.id {
            tx.execute(
                "UPDATE activation_events
                 SET deactivated_at = ?1
                 WHERE id = (
                     SELECT id
                     FROM activation_events
                     WHERE profile_id = ?2 AND deactivated_at IS NULL
                     ORDER BY id DESC
                     LIMIT 1
                 )",
                params![activated_at, previous_id],
            )
            .map_err(|err| format!("failed to close previous activation event: {err}"))?;
        }
    }

    tx.execute(
        "INSERT INTO settings (key, value) VALUES ('active_profile_id', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![&profile_id],
    )
    .map_err(|err| format!("failed to update active profile pointer: {err}"))?;

    tx.execute(
        "INSERT INTO activation_events (profile_id, activated_at, deactivated_at, target_path)
         VALUES (?1, ?2, NULL, ?3)",
        params![&profile_id, &activated_at, &write_result.target_dir],
    )
    .map_err(|err| format!("failed to insert activation event: {err}"))?;

    tx.execute(
        "UPDATE profiles
         SET last_activated_at = ?2, updated_at = ?2, target_path = ?3
         WHERE id = ?1",
        params![&profile_id, &activated_at, &write_result.target_dir],
    )
    .map_err(|err| format!("failed to update activated profile metadata: {err}"))?;

    tx.commit()
        .map_err(|err| format!("failed to commit activation transaction: {err}"))?;

    Ok(ActivationResult {
        profile_id,
        target_path: write_result.target_dir,
        written_files: write_result.written_files,
        activated_at,
    })
}

pub fn get_active_profile(conn: &Connection) -> Result<Option<Profile>, String> {
    let active_profile_id = get_active_profile_id(conn)?;
    match active_profile_id {
        Some(id) => get_profile(conn, &id).map(Some),
        None => Ok(None),
    }
}

pub fn import_from_disk(conn: &Connection, source_dir: &str) -> Result<Profile, String> {
    let source_path = PathBuf::from(source_dir);
    if !source_path.exists() || !source_path.is_dir() {
        return Err(format!(
            "import path is not an existing directory: {}",
            source_path.display()
        ));
    }

    let opencode_file = find_first_existing_file(
        &source_path,
        &["opencode.jsonc", "opencode.json"],
        "opencode config",
    )?;
    let opencode_config = fs::read_to_string(&opencode_file).map_err(|err| {
        format!(
            "failed to read imported opencode config {}: {err}",
            opencode_file.display()
        )
    })?;

    let ohmy_file = find_optional_existing_file(
        &source_path,
        &["oh-my-opencode.jsonc", "oh-my-opencode.json"],
    );
    let ohmy_config = if let Some(path) = &ohmy_file {
        Some(fs::read_to_string(path).map_err(|err| {
            format!(
                "failed to read imported oh-my-opencode config {}: {err}",
                path.display()
            )
        })?)
    } else {
        None
    };

    let fallback_name = "Imported Profile".to_string();
    let profile_name = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| format!("Imported {value}"))
        .unwrap_or(fallback_name);

    let input = CreateProfileInput {
        name: profile_name,
        description: Some(format!("Imported from {}", source_path.display())),
        tags: Some(vec!["imported".to_string()]),
        opencode_config,
        ohmyoc_enabled: Some(ohmy_file.is_some()),
        ohmyoc_config: ohmy_config,
        target_path: Some(source_path.display().to_string()),
        stats_enabled: Some(false),
    };

    create_profile(conn, &input)
}

pub fn get_default_config_dir() -> Result<String, String> {
    config_writer::default_config_dir().map(|path| path.display().to_string())
}

pub fn bootstrap_system_profile_from_disk(conn: &Connection) -> Result<Option<Profile>, String> {
    let preferred_project_root = get_project_root(conn)?;
    let Some(snapshot) = config_source::load_disk_config(preferred_project_root.as_deref())? else {
        return Ok(None);
    };

    let now = utc_now_rfc3339();
    let tags_json = serde_json::to_string(&vec!["system".to_string(), "bootstrap".to_string()])
        .map_err(|err| format!("failed to serialize system profile tags: {err}"))?;
    let description = snapshot
        .project_root
        .as_deref()
        .map(|path| format!("Auto-synced from disk (global + project: {path})"))
        .unwrap_or_else(|| "Auto-synced from disk (global only)".to_string());
    let ohmy_enabled = snapshot.ohmyoc_config.is_some();
    let ohmy_config = snapshot.ohmyoc_config.unwrap_or_else(|| "{}\n".to_string());

    let tx = conn
        .unchecked_transaction()
        .map_err(|err| format!("failed to start bootstrap transaction: {err}"))?;

    tx.execute(
        "INSERT INTO profiles (
            id, name, description, tags, opencode_config, ohmyoc_enabled, ohmyoc_config, target_path,
            stats_enabled, created_at, updated_at, last_activated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            tags = excluded.tags,
            opencode_config = excluded.opencode_config,
            ohmyoc_enabled = excluded.ohmyoc_enabled,
            ohmyoc_config = excluded.ohmyoc_config,
            target_path = excluded.target_path,
            stats_enabled = excluded.stats_enabled,
            updated_at = excluded.updated_at,
            last_activated_at = excluded.last_activated_at",
        params![
            SYSTEM_PROFILE_ID,
            "System Current",
            description,
            tags_json,
            snapshot.opencode_config,
            bool_to_int(ohmy_enabled),
            ohmy_config,
            snapshot.target_dir,
            0_i64,
            &now,
            &now,
            &now
        ],
    )
    .map_err(|err| format!("failed to upsert system profile from disk: {err}"))?;

    tx.execute(
        "INSERT INTO settings (key, value) VALUES ('active_profile_id', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![SYSTEM_PROFILE_ID],
    )
    .map_err(|err| format!("failed to set active system profile: {err}"))?;

    tx.commit()
        .map_err(|err| format!("failed to commit bootstrap transaction: {err}"))?;

    get_profile(conn, SYSTEM_PROFILE_ID).map(Some)
}

pub fn get_project_root(conn: &Connection) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![PROJECT_ROOT_KEY],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(|err| format!("failed to read project root setting: {err}"))
}

pub fn set_project_root(conn: &Connection, path: Option<String>) -> Result<(), String> {
    let normalized = path.map(|value| value.trim().to_string()).filter(|value| !value.is_empty());

    if let Some(value) = &normalized {
        let project_root = PathBuf::from(value);
        if !project_root.exists() || !project_root.is_dir() {
            return Err(format!(
                "project root path is not an existing directory: {}",
                project_root.display()
            ));
        }

        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![PROJECT_ROOT_KEY, value],
        )
        .map_err(|err| format!("failed to persist project root setting: {err}"))?;
        return Ok(());
    }

    conn.execute(
        "DELETE FROM settings WHERE key = ?1",
        params![PROJECT_ROOT_KEY],
    )
    .map_err(|err| format!("failed to clear project root setting: {err}"))?;
    Ok(())
}

fn get_active_profile_id(conn: &Connection) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = 'active_profile_id'",
        [],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(|err| format!("failed to read active profile id: {err}"))
}

fn map_profile_row(row: &Row<'_>, active_profile_id: Option<&str>) -> rusqlite::Result<Profile> {
    let id: String = row.get("id")?;
    let tags_raw: String = row.get("tags")?;
    let tags = serde_json::from_str::<Vec<String>>(&tags_raw).unwrap_or_default();
    let active = active_profile_id.is_some_and(|active_id| active_id == id.as_str());

    Ok(Profile {
        id,
        name: row.get("name")?,
        description: row.get("description")?,
        tags,
        opencode_config: row.get("opencode_config")?,
        ohmyoc_enabled: int_to_bool(row.get::<_, i64>("ohmyoc_enabled")?),
        ohmyoc_config: row.get("ohmyoc_config")?,
        target_path: row.get("target_path")?,
        stats_enabled: int_to_bool(row.get::<_, i64>("stats_enabled")?),
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        last_activated_at: row.get("last_activated_at")?,
        active,
    })
}

fn find_first_existing_file(
    base_dir: &PathBuf,
    candidates: &[&str],
    label: &str,
) -> Result<PathBuf, String> {
    candidates
        .iter()
        .map(|name| base_dir.join(name))
        .find(|path| path.exists())
        .ok_or_else(|| {
            format!(
                "failed to import profile: missing {label} in {}",
                base_dir.display()
            )
        })
}

fn find_optional_existing_file(base_dir: &PathBuf, candidates: &[&str]) -> Option<PathBuf> {
    candidates
        .iter()
        .map(|name| base_dir.join(name))
        .find(|path| path.exists())
}

fn normalize_config_text(raw: &str, fallback: &str) -> String {
    let trimmed = raw.trim();
    let normalized = if trimmed.is_empty() {
        fallback
    } else {
        trimmed
    };
    format!("{normalized}\n")
}

fn bool_to_int(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn int_to_bool(value: i64) -> bool {
    value != 0
}

#[cfg(test)]
mod tests {
    use std::fs;

    use rusqlite::{params, Connection};
    use tempfile::TempDir;

    use crate::{
        db::run_migrations,
        models::{CreateProfileInput, UpdateProfileInput},
    };

    use super::{activate_profile, create_profile, get_active_profile, update_profile};

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory sqlite failed");
        run_migrations(&conn).expect("run migrations failed");
        conn
    }

    #[test]
    fn create_update_activate_switch_and_write_files() {
        let conn = setup_conn();
        let temp_dir = TempDir::new().expect("create temp dir failed");
        let target_dir = temp_dir.path().join("opencode");

        let p1 = create_profile(
            &conn,
            &CreateProfileInput {
                name: "profile-a".to_string(),
                description: Some("first profile".to_string()),
                tags: Some(vec!["a".to_string(), "relay".to_string()]),
                opencode_config: r#"{"providers":{"a":{"endpoint":"https://a.example.com"}}}"#
                    .to_string(),
                ohmyoc_enabled: Some(true),
                ohmyoc_config: Some(r#"{"mode":"strict"}"#.to_string()),
                target_path: Some(target_dir.display().to_string()),
                stats_enabled: Some(false),
            },
        )
        .expect("create profile a failed");

        let p2 = create_profile(
            &conn,
            &CreateProfileInput {
                name: "profile-b".to_string(),
                description: Some("second profile".to_string()),
                tags: Some(vec!["b".to_string()]),
                opencode_config: r#"{"providers":{"b":{"endpoint":"https://b.example.com"}}}"#
                    .to_string(),
                ohmyoc_enabled: Some(false),
                ohmyoc_config: Some(r#"{}"#.to_string()),
                target_path: Some(target_dir.display().to_string()),
                stats_enabled: Some(false),
            },
        )
        .expect("create profile b failed");

        let updated = update_profile(
            &conn,
            &p1.id,
            &UpdateProfileInput {
                name: Some("profile-a-updated".to_string()),
                description: None,
                tags: Some(vec!["updated".to_string()]),
                opencode_config: None,
                ohmyoc_enabled: None,
                ohmyoc_config: None,
                target_path: None,
                stats_enabled: None,
            },
        )
        .expect("update profile a failed");
        assert_eq!(updated.name, "profile-a-updated");
        assert_eq!(updated.tags, vec!["updated".to_string()]);

        let first_activation =
            activate_profile(&conn, &p1.id, Some(target_dir.display().to_string()))
                .expect("activate profile a failed");
        assert_eq!(first_activation.profile_id, p1.id);
        assert_eq!(first_activation.written_files.len(), 2);
        let opencode_path = target_dir.join("opencode.jsonc");
        let ohmy_path = target_dir.join("oh-my-opencode.json");
        assert!(opencode_path.exists());
        assert!(ohmy_path.exists());

        let opencode_a =
            fs::read_to_string(&opencode_path).expect("read first opencode config failed");
        assert!(opencode_a.contains("\"oh-my-opencode\""));
        let ohmy_a = fs::read_to_string(&ohmy_path).expect("read first oh-my config failed");
        assert!(ohmy_a.contains("\"mode\""));

        let second_activation =
            activate_profile(&conn, &p2.id, Some(target_dir.display().to_string()))
                .expect("activate profile b failed");
        assert_eq!(second_activation.profile_id, p2.id);
        assert!(!second_activation
            .written_files
            .iter()
            .any(|path| path.ends_with("oh-my-opencode.json")));

        let active = get_active_profile(&conn)
            .expect("query active profile failed")
            .expect("active profile should exist");
        assert_eq!(active.id, p2.id);

        let opencode_b =
            fs::read_to_string(&opencode_path).expect("read second opencode config failed");
        assert!(!opencode_b.contains("\"oh-my-opencode\""));

        let event_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM activation_events", [], |row| {
                row.get(0)
            })
            .expect("query activation event count failed");
        assert_eq!(event_count, 2);

        let first_event_deactivated_at: Option<String> = conn
            .query_row(
                "SELECT deactivated_at FROM activation_events WHERE profile_id = ?1 ORDER BY id ASC LIMIT 1",
                params![&p1.id],
                |row| row.get(0),
            )
            .expect("query first activation deactivated_at failed");
        assert!(first_event_deactivated_at.is_some());
    }
}
