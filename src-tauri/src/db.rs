use std::{fs, path::PathBuf, sync::Mutex, time::Duration};

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

pub const DB_FILE_NAME: &str = "oc-pad.db";
const MIGRATION_SQL: &str = include_str!("../migrations/001_init.sql");

pub struct AppState {
    pub conn: Mutex<Connection>,
}

impl AppState {
    pub fn new(conn: Connection) -> Self {
        Self {
            conn: Mutex::new(conn),
        }
    }
}

pub fn init_db(app_handle: &AppHandle) -> Result<Connection, String> {
    let db_path = resolve_db_path(app_handle)?;
    let conn = Connection::open(&db_path)
        .map_err(|err| format!("failed to open sqlite db at {}: {err}", db_path.display()))?;

    conn.busy_timeout(Duration::from_secs(5))
        .map_err(|err| format!("failed to configure sqlite busy timeout: {err}"))?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|err| format!("failed to enable sqlite foreign keys: {err}"))?;

    run_migrations(&conn)?;
    Ok(conn)
}

pub fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(MIGRATION_SQL)
        .map_err(|err| format!("failed to run sqlite migrations: {err}"))?;
    Ok(())
}

fn resolve_db_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|err| format!("failed to resolve app data dir: {err}"))?;

    fs::create_dir_all(&app_data_dir).map_err(|err| {
        format!(
            "failed to create app data directory {}: {err}",
            app_data_dir.display()
        )
    })?;

    Ok(app_data_dir.join(DB_FILE_NAME))
}
