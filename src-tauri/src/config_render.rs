use serde_json::{Map, Value};

use crate::models::Profile;

pub struct RenderedConfigs {
    pub opencode_config: String,
    pub ohmyoc_config: Option<String>,
}

pub fn render_profile_configs(profile: &Profile) -> Result<RenderedConfigs, String> {
    let mut opencode_value = parse_loose_json(&profile.opencode_config).map_err(|err| {
        format!(
            "failed to parse opencode config for profile {}: {err}",
            profile.id
        )
    })?;

    ensure_plugin_linkage(&mut opencode_value, profile.ohmyoc_enabled)?;

    let opencode_config = serde_json::to_string_pretty(&opencode_value)
        .map_err(|err| format!("failed to serialize opencode config: {err}"))?
        + "\n";

    let ohmyoc_config = if profile.ohmyoc_enabled {
        let ohmy_source = if profile.ohmyoc_config.trim().is_empty() {
            "{}"
        } else {
            profile.ohmyoc_config.as_str()
        };
        let ohmy_value = parse_loose_json(ohmy_source).map_err(|err| {
            format!(
                "failed to parse oh-my-opencode config for profile {}: {err}",
                profile.id
            )
        })?;
        Some(
            serde_json::to_string_pretty(&ohmy_value)
                .map_err(|err| format!("failed to serialize oh-my-opencode config: {err}"))?
                + "\n",
        )
    } else {
        None
    };

    Ok(RenderedConfigs {
        opencode_config,
        ohmyoc_config,
    })
}

fn parse_loose_json(source: &str) -> Result<Value, String> {
    serde_json::from_str(source)
        .or_else(|_| json5::from_str(source))
        .map_err(|err| err.to_string())
}

fn ensure_plugin_linkage(value: &mut Value, ohmyoc_enabled: bool) -> Result<(), String> {
    let root_obj = value
        .as_object_mut()
        .ok_or_else(|| "opencode config must be a JSON object".to_string())?;

    let has_plugin = root_obj.contains_key("plugin");
    let has_plugins = root_obj.contains_key("plugins");

    let mut effective_plugins = if has_plugin {
        read_plugins(root_obj, "plugin")?
    } else if has_plugins {
        read_plugins(root_obj, "plugins")?
    } else {
        Vec::new()
    };

    let exists = effective_plugins
        .iter()
        .any(|item| item.as_str() == Some("oh-my-opencode"));

    if ohmyoc_enabled && !exists {
        effective_plugins.push(Value::String("oh-my-opencode".to_string()));
    }

    if !ohmyoc_enabled {
        effective_plugins.retain(|item| item.as_str() != Some("oh-my-opencode"));
    }

    if effective_plugins.is_empty() {
        root_obj.remove("plugin");
        root_obj.remove("plugins");
        return Ok(());
    }

    if has_plugin || (!has_plugin && !has_plugins) {
        root_obj.insert("plugin".to_string(), Value::Array(effective_plugins.clone()));
    } else {
        root_obj.remove("plugin");
    }

    if has_plugins {
        root_obj.insert("plugins".to_string(), Value::Array(effective_plugins));
    } else if has_plugin {
        root_obj.remove("plugins");
    }

    Ok(())
}

fn read_plugins(root_obj: &Map<String, Value>, key: &str) -> Result<Vec<Value>, String> {
    let Some(value) = root_obj.get(key) else {
        return Ok(Vec::new());
    };
    let Some(array) = value.as_array() else {
        return Err(format!(
            "opencode config field `{key}` must be an array when present"
        ));
    };
    Ok(array.clone())
}

#[cfg(test)]
mod tests {
    use serde_json::Value;

    use crate::models::Profile;

    use super::render_profile_configs;

    #[test]
    fn keeps_plugin_field_when_present() {
        let profile = build_profile(
            r#"{
              "plugin": ["foo"]
            }"#,
            true,
        );
        let rendered = render_profile_configs(&profile).expect("render profile failed");
        let value: Value =
            serde_json::from_str(&rendered.opencode_config).expect("parse rendered opencode failed");
        assert_eq!(value["plugin"][0], "foo");
        assert_eq!(value["plugin"][1], "oh-my-opencode");
        assert!(value.get("plugins").is_none());
    }

    #[test]
    fn keeps_plugins_field_when_present() {
        let profile = build_profile(
            r#"{
              "plugins": ["foo"]
            }"#,
            true,
        );
        let rendered = render_profile_configs(&profile).expect("render profile failed");
        let value: Value =
            serde_json::from_str(&rendered.opencode_config).expect("parse rendered opencode failed");
        assert_eq!(value["plugins"][0], "foo");
        assert_eq!(value["plugins"][1], "oh-my-opencode");
        assert!(value.get("plugin").is_none());
    }

    #[test]
    fn syncs_plugin_and_plugins_when_both_present() {
        let profile = build_profile(
            r#"{
              "plugin": ["foo", "oh-my-opencode"],
              "plugins": ["foo"]
            }"#,
            false,
        );
        let rendered = render_profile_configs(&profile).expect("render profile failed");
        let value: Value =
            serde_json::from_str(&rendered.opencode_config).expect("parse rendered opencode failed");
        assert_eq!(value["plugin"][0], "foo");
        assert_eq!(value["plugins"][0], "foo");
        assert_eq!(value["plugin"].as_array().expect("plugin array missing").len(), 1);
        assert_eq!(
            value["plugins"]
                .as_array()
                .expect("plugins array missing")
                .len(),
            1
        );
    }

    fn build_profile(opencode_config: &str, ohmyoc_enabled: bool) -> Profile {
        Profile {
            id: "test".to_string(),
            name: "Test".to_string(),
            description: String::new(),
            tags: Vec::new(),
            opencode_config: opencode_config.to_string(),
            ohmyoc_enabled,
            ohmyoc_config: "{}".to_string(),
            target_path: String::new(),
            stats_enabled: false,
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
            last_activated_at: None,
            active: false,
        }
    }
}
