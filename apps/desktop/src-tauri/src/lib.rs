use base64::Engine;

mod audio;
mod gemini;
mod gemini_translate;
mod keystore;
mod translate;

#[cfg(not(target_os = "android"))]
use tauri::Manager;
#[cfg(not(target_os = "android"))]
use std::io::BufRead;

#[cfg(target_os = "android")]
mod server;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_api_key,
            get_api_key,
            clear_api_key,
            translate_audio,
            translate_text,
            translate_audio_gemini
        ])
        .setup(|app| {
            #[cfg(target_os = "android")]
            let _ = &app;
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
                let port = server::start_server(Some(3004));
                let _ = &port;
            }

            #[cfg(not(target_os = "android"))]
            if !cfg!(debug_assertions) {
                let port = portpicker::pick_unused_port().expect("no free port found");
                let exe_dir = std::env::current_exe()
                    .ok()
                    .and_then(|p| p.parent().map(|d| d.to_path_buf()))
                    .unwrap_or_default();
                let sidecar_path = exe_dir.join("server.exe");

                let mut child = std::process::Command::new(&sidecar_path)
                    .env("PORT", port.to_string())
                    .env("HOST", "127.0.0.1")
                    .stdout(std::process::Stdio::piped())
                    .stderr(std::process::Stdio::piped())
                    .spawn()
                    .expect("failed to spawn server.exe");

                let stdout = child.stdout.take().unwrap();
                let port_clone = port;
                std::thread::spawn(move || {
                    let reader = std::io::BufReader::new(stdout);
                    let start = std::time::Instant::now();
                    for line in reader.lines() {
                        if let Ok(output) = line {
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
fn save_api_key(provider: String, key: String) -> Result<(), String> {
    keystore::save(&provider, &key)
}

#[tauri::command]
fn get_api_key(provider: String) -> Result<Option<String>, String> {
    keystore::load(&provider)
}

#[tauri::command]
fn clear_api_key(provider: String) -> Result<(), String> {
    keystore::clear(&provider)
}

const MAX_RETRIES: u32 = 3;

fn clean_error(msg: &str) -> String {
    if let Some(pos) = msg.find(": ") {
        msg[pos + 2..].to_string()
    } else {
        msg.to_string()
    }
}

#[tauri::command]
async fn translate_audio(
    api_key: String,
    audio_b64: String,
    target_language: String,
    provider: Option<String>,
    source_language: Option<String>,
) -> Result<String, String> {
    let audio_data = base64::engine::general_purpose::STANDARD
        .decode(audio_b64.as_bytes())
        .map_err(|e| format!("Invalid base64 audio: {}", e))?;

    let provider = provider.as_deref().unwrap_or("sarvam");

    match provider {
        "gemini" => {
            let translator = gemini::GeminiLiveTranslator::new(api_key);
            let result = translator.translate_audio(&audio_data, &target_language).await?;
            Ok(base64::engine::general_purpose::STANDARD.encode(&result))
        }
        _ => {
            let engine = translate::TranslationEngine::new();
            let mut last_error = String::new();

            for attempt in 0..MAX_RETRIES {
                let result = engine
                    .translate_audio(&api_key, &audio_data, source_language.as_deref(), &target_language)
                    .await;
                match &result {
                    Ok(audio_bytes) => {
                        return Ok(base64::engine::general_purpose::STANDARD.encode(audio_bytes));
                    }
                    Err(e) if e.starts_with("RATE_LIMIT:") && attempt < MAX_RETRIES - 1 => {
                        let delay = std::time::Duration::from_secs((2 * (attempt + 1)).into());
                        tokio::time::sleep(delay).await;
                        last_error = clean_error(e);
                    }
                    Err(e) => {
                        return Err(clean_error(e));
                    }
                }
            }
            Err(last_error)
        }
    }
}

#[tauri::command]
async fn translate_text(
    api_key: String,
    text: String,
    source_language: Option<String>,
    target_language: String,
) -> Result<String, String> {
    let source_lang = source_language.as_deref().unwrap_or("unknown");
    let result = gemini_translate::translate_text(&api_key, &text, source_lang, &target_language).await?;
    Ok(result.translated_text)
}

#[tauri::command]
async fn translate_audio_gemini(
    api_key: String,
    audio_b64: String,
    source_language: Option<String>,
    target_language: String,
) -> Result<String, String> {
    let source_lang = source_language.as_deref().unwrap_or("unknown");
    let result = gemini_translate::translate_audio(&api_key, &audio_b64, source_lang, &target_language).await?;
    Ok(result.translated_text)
}
