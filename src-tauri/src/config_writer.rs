use std::{
    env,
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
};

use tempfile::Builder;

use crate::config_render::RenderedConfigs;

const OPENCODE_FILENAME: &str = "opencode.jsonc";
const OHMYOC_FILENAME: &str = "oh-my-opencode.json";

#[derive(Debug, Clone)]
pub struct WriteResult {
    pub target_dir: String,
    pub written_files: Vec<String>,
}

pub fn write_profile_configs(
    requested_target: Option<&str>,
    rendered: &RenderedConfigs,
) -> Result<WriteResult, String> {
    let target_dir = resolve_target_dir(requested_target)?;
    fs::create_dir_all(&target_dir).map_err(|err| {
        format!(
            "failed to create target config directory {}: {err}",
            target_dir.display()
        )
    })?;

    let mut written_files = Vec::new();

    let opencode_path = target_dir.join(OPENCODE_FILENAME);
    atomic_write(&opencode_path, &rendered.opencode_config)?;
    written_files.push(opencode_path.display().to_string());

    if let Some(ohmyoc_config) = &rendered.ohmyoc_config {
        let ohmyoc_path = target_dir.join(OHMYOC_FILENAME);
        atomic_write(&ohmyoc_path, ohmyoc_config)?;
        written_files.push(ohmyoc_path.display().to_string());
    }

    Ok(WriteResult {
        target_dir: target_dir.display().to_string(),
        written_files,
    })
}

pub fn resolve_target_dir(requested_target: Option<&str>) -> Result<PathBuf, String> {
    if let Some(path) = requested_target {
        if !path.trim().is_empty() {
            return Ok(PathBuf::from(path));
        }
    }
    default_config_dir()
}

pub fn default_config_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let app_data = env::var("APPDATA")
            .map_err(|err| format!("failed to resolve APPDATA for default path: {err}"))?;
        Ok(PathBuf::from(app_data).join("opencode"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let home = env::var("HOME")
            .map_err(|err| format!("failed to resolve HOME for default path: {err}"))?;
        Ok(PathBuf::from(home).join(".config").join("opencode"))
    }
}

fn atomic_write(target_path: &Path, content: &str) -> Result<(), String> {
    let parent_dir = target_path.parent().ok_or_else(|| {
        format!(
            "failed to resolve parent directory for {}",
            target_path.display()
        )
    })?;

    let mut temp_file = Builder::new()
        .prefix(".oc-pad-")
        .suffix(".tmp")
        .tempfile_in(parent_dir)
        .map_err(|err| {
            format!(
                "failed to create temp file for {}: {err}",
                target_path.display()
            )
        })?;

    temp_file.write_all(content.as_bytes()).map_err(|err| {
        format!(
            "failed to write temp file for {}: {err}",
            target_path.display()
        )
    })?;
    temp_file.flush().map_err(|err| {
        format!(
            "failed to flush temp file for {}: {err}",
            target_path.display()
        )
    })?;
    temp_file.as_file().sync_all().map_err(|err| {
        format!(
            "failed to fsync temp file for {}: {err}",
            target_path.display()
        )
    })?;

    let temp_path = temp_file.path().to_path_buf();
    temp_file.persist(target_path).map_err(|err| {
        format!(
            "failed to atomically rename temp file {} -> {}: {}",
            temp_path.display(),
            target_path.display(),
            err.error
        )
    })?;

    fsync_directory(parent_dir)?;
    Ok(())
}

fn fsync_directory(dir: &Path) -> Result<(), String> {
    let dir_handle = File::open(dir)
        .map_err(|err| format!("failed to open directory {}: {err}", dir.display()))?;
    dir_handle
        .sync_all()
        .map_err(|err| format!("failed to fsync directory {}: {err}", dir.display()))
}
