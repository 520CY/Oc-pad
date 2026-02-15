use tauri::State;

use crate::{
    db::AppState,
    models::{ActivationResult, CreateProfileInput, Profile, UpdateProfileInput},
    profile_service,
};

#[tauri::command]
pub fn list_profiles(state: State<'_, AppState>) -> Result<Vec<Profile>, String> {
    with_conn(&state, profile_service::list_profiles)
}

#[tauri::command]
pub fn get_profile(state: State<'_, AppState>, id: String) -> Result<Profile, String> {
    with_conn(&state, |conn| profile_service::get_profile(conn, &id))
}

#[tauri::command]
pub fn create_profile(
    state: State<'_, AppState>,
    input: CreateProfileInput,
) -> Result<Profile, String> {
    with_conn(&state, |conn| profile_service::create_profile(conn, &input))
}

#[tauri::command]
pub fn update_profile(
    state: State<'_, AppState>,
    id: String,
    input: UpdateProfileInput,
) -> Result<Profile, String> {
    with_conn(&state, |conn| {
        profile_service::update_profile(conn, &id, &input)
    })
}

#[tauri::command]
pub fn delete_profile(state: State<'_, AppState>, id: String) -> Result<(), String> {
    with_conn(&state, |conn| profile_service::delete_profile(conn, &id))
}

#[tauri::command]
pub fn activate_profile(
    state: State<'_, AppState>,
    id: String,
    target_path: Option<String>,
) -> Result<ActivationResult, String> {
    with_conn(&state, |conn| {
        profile_service::activate_profile(conn, &id, target_path)
    })
}

#[tauri::command]
pub fn get_active_profile(state: State<'_, AppState>) -> Result<Option<Profile>, String> {
    with_conn(&state, profile_service::get_active_profile)
}

#[tauri::command]
pub fn import_from_disk(state: State<'_, AppState>, path: String) -> Result<Profile, String> {
    with_conn(&state, |conn| {
        profile_service::import_from_disk(conn, &path)
    })
}

#[tauri::command]
pub fn get_default_config_dir() -> Result<String, String> {
    profile_service::get_default_config_dir()
}

#[tauri::command]
pub fn bootstrap_system_config(state: State<'_, AppState>) -> Result<Option<Profile>, String> {
    with_conn(&state, profile_service::bootstrap_system_profile_from_disk)
}

#[tauri::command]
pub fn get_project_root(state: State<'_, AppState>) -> Result<Option<String>, String> {
    with_conn(&state, profile_service::get_project_root)
}

#[tauri::command]
pub fn set_project_root(state: State<'_, AppState>, path: Option<String>) -> Result<(), String> {
    with_conn(&state, |conn| profile_service::set_project_root(conn, path))
}

fn with_conn<T>(
    state: &State<'_, AppState>,
    operation: impl FnOnce(&rusqlite::Connection) -> Result<T, String>,
) -> Result<T, String> {
    let guard = state
        .conn
        .lock()
        .map_err(|err| format!("failed to lock sqlite connection: {err}"))?;
    operation(&guard)
}
