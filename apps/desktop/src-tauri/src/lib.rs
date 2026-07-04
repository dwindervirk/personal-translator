use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            } else {
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
