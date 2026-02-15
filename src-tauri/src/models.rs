use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub opencode_config: String,
    pub ohmyoc_enabled: bool,
    pub ohmyoc_config: String,
    pub target_path: String,
    pub stats_enabled: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_activated_at: Option<String>,
    pub active: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProfileInput {
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub opencode_config: String,
    pub ohmyoc_enabled: Option<bool>,
    pub ohmyoc_config: Option<String>,
    pub target_path: Option<String>,
    pub stats_enabled: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub opencode_config: Option<String>,
    pub ohmyoc_enabled: Option<bool>,
    pub ohmyoc_config: Option<String>,
    pub target_path: Option<String>,
    pub stats_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivationResult {
    pub profile_id: String,
    pub target_path: String,
    pub written_files: Vec<String>,
    pub activated_at: String,
}

pub fn utc_now_rfc3339() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}
