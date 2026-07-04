use tauri::Manager;
use tauri_plugin_shell::ShellExt;

mod keystore;

#[cfg(target_os = "android")]
mod server;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(not(target_os = "android"))]
    let builder = builder.plugin(tauri_plugin_shell::init());

    builder
        .invoke_handler(tauri::generate_handler![save_api_key, get_api_key, clear_api_key])
        .setup(|app| {
            #[cfg(debug_assertions)]
            if let Err(e) = app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            ) {
                log::error!("Failed to init log plugin: {}", e);
            }

            #[cfg(target_os = "android")]
            {
                let port = server::start_server();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.eval(&format!("window.__API_PORT__ = {};", port));
                }
            }

            #[cfg(not(target_os = "android"))]
            if !cfg!(debug_assertions) {
                let port = portpicker::pick_unused_port().expect("no free port found");

                let (mut rx, _child) = app
                    .shell()
                    .sidecar("server")
                    .expect("failed to create sidecar")
                    .env("PORT", port.to_string())
                    .env("HOST", "127.0.0.1")
                    .spawn()
                    .expect("failed to spawn sidecar server");

                let port_clone = port;
                std::thread::spawn(move || {
                    let start = std::time::Instant::now();
                    while let Some(event) = rx.blocking_recv() {
                        if let tauri_plugin_shell::process::CommandEvent::Stdout(line) = event {
                            let output = String::from_utf8_lossy(&line);
                            if output.contains("Server listening") {
                                log::info!("Sidecar ready on port {}", port_clone);
                                break;
                            }
                        }
                        if start.elapsed() > std::time::Duration::from_secs(30) {
                            log::error!("Sidecar did not start within 30 seconds");
                            break;
                        }
                    }
                });

                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.eval(&format!("window.__API_PORT__ = {};", port));
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn save_api_key(key: String) -> Result<(), String> {
    keystore::save(&key)
}

#[tauri::command]
fn get_api_key() -> Result<Option<String>, String> {
    keystore::load()
}

#[tauri::command]
fn clear_api_key() -> Result<(), String> {
    Ok(())
}
