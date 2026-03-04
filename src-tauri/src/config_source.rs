use std::{
    env, fs,
    path::{Path, PathBuf},
};

use serde_json::Value;

use crate::config_writer;

#[derive(Debug, Clone, serde::Serialize)]
pub struct AuthProviderEntry {
    pub id: String,
    pub auth_type: String,
}

fn auth_json_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let local_app_data = env::var("LOCALAPPDATA")
            .map_err(|err| format!("failed to resolve LOCALAPPDATA: {err}"))?;
        Ok(PathBuf::from(local_app_data).join("opencode").join("auth.json"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let home = env::var("HOME")
            .map_err(|err| format!("failed to resolve HOME for auth.json path: {err}"))?;
        Ok(PathBuf::from(home).join(".local").join("share").join("opencode").join("auth.json"))
    }
}

pub fn read_auth_providers() -> Result<Vec<AuthProviderEntry>, String> {
    let path = auth_json_path()?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&path)
        .map_err(|err| format!("failed to read auth.json {}: {err}", path.display()))?;
    let parsed: Value = serde_json::from_str(&content)
        .map_err(|err| format!("failed to parse auth.json: {err}"))?;
    let obj = parsed.as_object().ok_or("auth.json root is not an object")?;
    Ok(obj
        .iter()
        .map(|(k, v)| AuthProviderEntry {
            id: k.clone(),
            auth_type: v
                .get("type")
                .and_then(|t| t.as_str())
                .unwrap_or("unknown")
                .to_string(),
        })
        .collect())
}

const OPENCODE_CANDIDATES: &[&str] = &["opencode.jsonc", "opencode.json"];
const OHMY_CANDIDATES: &[&str] = &["oh-my-opencode.jsonc", "oh-my-opencode.json"];

#[derive(Debug, Clone)]
pub struct DiskConfigSnapshot {
    pub opencode_config: String,
    pub ohmyoc_config: Option<String>,
    pub target_dir: String,
    pub project_root: Option<String>,
}

pub fn load_disk_config(preferred_project_root: Option<&str>) -> Result<Option<DiskConfigSnapshot>, String> {
    let global_dir = config_writer::default_config_dir()?;
    let project_root = resolve_project_root(preferred_project_root);
    load_disk_config_from_dirs(&global_dir, project_root.as_deref())
}

pub(crate) fn load_disk_config_from_dirs(
    global_dir: &Path,
    project_root: Option<&Path>,
) -> Result<Option<DiskConfigSnapshot>, String> {
    let global_opencode = read_optional_json(global_dir, OPENCODE_CANDIDATES)?;
    let global_ohmy = read_optional_json(global_dir, OHMY_CANDIDATES)?;

    let (project_opencode, project_ohmy, normalized_project_root) = if let Some(root) = project_root {
        let project_ohmy_root = root.join(".opencode");
        let opencode = read_optional_json(root, OPENCODE_CANDIDATES)?;
        let ohmy = read_optional_json(&project_ohmy_root, OHMY_CANDIDATES)?;
        (opencode, ohmy, Some(root.to_path_buf()))
    } else {
        (None, None, None)
    };

    if global_opencode.is_none()
        && global_ohmy.is_none()
        && project_opencode.is_none()
        && project_ohmy.is_none()
    {
        return Ok(None);
    }

    let mut merged_opencode = global_opencode.unwrap_or(Value::Object(serde_json::Map::new()));
    if let Some(project_value) = &project_opencode {
        deep_merge(&mut merged_opencode, project_value);
    }

    let mut merged_ohmy = global_ohmy;
    if let Some(project_value) = &project_ohmy {
        match merged_ohmy.as_mut() {
            Some(global_value) => deep_merge(global_value, project_value),
            None => merged_ohmy = Some(project_value.clone()),
        }
    }

    Ok(Some(DiskConfigSnapshot {
        opencode_config: serde_json::to_string_pretty(&merged_opencode)
            .map_err(|err| format!("failed to serialize merged opencode config: {err}"))?
            + "\n",
        ohmyoc_config: merged_ohmy
            .map(|value| {
                serde_json::to_string_pretty(&value)
                    .map(|text| text + "\n")
                    .map_err(|err| format!("failed to serialize merged oh-my-opencode config: {err}"))
            })
            .transpose()?,
        target_dir: global_dir.display().to_string(),
        project_root: normalized_project_root.map(|path| path.display().to_string()),
    }))
}

fn resolve_project_root(preferred_project_root: Option<&str>) -> Option<PathBuf> {
    if let Some(root) = preferred_project_root {
        let trimmed = root.trim();
        if !trimmed.is_empty() {
            let path = PathBuf::from(trimmed);
            if path.exists() && path.is_dir() {
                return Some(path);
            }
        }
    }

    match env::current_dir() {
        Ok(path) if path.exists() && path.is_dir() => Some(path),
        _ => None,
    }
}

fn read_optional_json(base_dir: &Path, candidates: &[&str]) -> Result<Option<Value>, String> {
    if !base_dir.exists() || !base_dir.is_dir() {
        return Ok(None);
    }

    let candidate = candidates
        .iter()
        .map(|name| base_dir.join(name))
        .find(|path| path.exists() && path.is_file());

    let Some(path) = candidate else {
        return Ok(None);
    };

    let content = fs::read_to_string(&path)
        .map_err(|err| format!("failed to read config file {}: {err}", path.display()))?;

    let parsed = parse_loose_json(&content).map_err(|err| {
        format!(
            "failed to parse config file {} as JSON/JSONC: {err}",
            path.display()
        )
    })?;
    Ok(Some(parsed))
}

fn parse_loose_json(source: &str) -> Result<Value, String> {
    serde_json::from_str(source)
        .or_else(|_| json5::from_str(source))
        .map_err(|err| err.to_string())
}

fn deep_merge(base: &mut Value, overlay: &Value) {
    if let (Some(base_obj), Some(overlay_obj)) = (base.as_object_mut(), overlay.as_object()) {
        for (key, overlay_value) in overlay_obj {
            match base_obj.get_mut(key) {
                Some(base_value) => deep_merge(base_value, overlay_value),
                None => {
                    base_obj.insert(key.clone(), overlay_value.clone());
                }
            }
        }
        return;
    }

    *base = overlay.clone();
}

#[cfg(test)]
mod tests {
    use tempfile::TempDir;

    use super::load_disk_config_from_dirs;

    #[test]
    fn merges_global_and_project_configs() {
        let global_dir = TempDir::new().expect("create global temp dir failed");
        let project_dir = TempDir::new().expect("create project temp dir failed");

        std::fs::write(
            global_dir.path().join("opencode.json"),
            r#"{
              "theme": "dark",
              "server": { "port": 3000 },
              "plugin": ["global-only"]
            }"#,
        )
        .expect("write global opencode config failed");

        std::fs::write(
            global_dir.path().join("oh-my-opencode.json"),
            r#"{
              "agents": { "sisyphus": { "model": "openai/gpt-5.2" } }
            }"#,
        )
        .expect("write global oh-my-opencode config failed");

        std::fs::write(
            project_dir.path().join("opencode.jsonc"),
            r#"{
              // project overrides
              "server": { "hostname": "localhost" },
              "model": "openai/gpt-5.3-codex"
            }"#,
        )
        .expect("write project opencode config failed");

        let project_ohmy_dir = project_dir.path().join(".opencode");
        std::fs::create_dir_all(&project_ohmy_dir).expect("create project .opencode dir failed");
        std::fs::write(
            project_ohmy_dir.join("oh-my-opencode.json"),
            r#"{
              "agents": { "oracle": { "model": "openai/gpt-5.3-codex" } }
            }"#,
        )
        .expect("write project oh-my-opencode config failed");

        let snapshot = load_disk_config_from_dirs(global_dir.path(), Some(project_dir.path()))
            .expect("load merged snapshot failed")
            .expect("snapshot should exist");

        let opencode: serde_json::Value =
            serde_json::from_str(&snapshot.opencode_config).expect("parse merged opencode failed");
        assert_eq!(opencode["theme"], "dark");
        assert_eq!(opencode["server"]["port"], 3000);
        assert_eq!(opencode["server"]["hostname"], "localhost");
        assert_eq!(opencode["model"], "openai/gpt-5.3-codex");

        let ohmy: serde_json::Value = serde_json::from_str(
            snapshot
                .ohmyoc_config
                .as_deref()
                .expect("merged oh-my-opencode should exist"),
        )
        .expect("parse merged oh-my-opencode failed");
        assert_eq!(ohmy["agents"]["sisyphus"]["model"], "openai/gpt-5.2");
        assert_eq!(ohmy["agents"]["oracle"]["model"], "openai/gpt-5.3-codex");
    }
}
