use tauri::Manager;

mod commands;
mod config_render;
mod config_source;
mod config_writer;
mod db;
mod models;
mod profile_service;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let conn = db::init_db(app.handle()).map_err(std::io::Error::other)?;
            if let Err(err) = profile_service::bootstrap_system_profile_from_disk(&conn) {
                eprintln!("failed to bootstrap system profile from disk: {err}");
            }
            app.manage(db::AppState::new(conn));
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::list_profiles,
            commands::get_profile,
            commands::create_profile,
            commands::update_profile,
            commands::delete_profile,
            commands::activate_profile,
            commands::get_active_profile,
            commands::import_from_disk,
            commands::get_default_config_dir,
            commands::bootstrap_system_config,
            commands::get_project_root,
            commands::set_project_root
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
