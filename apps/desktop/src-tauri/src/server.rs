use axum::{
    extract::Multipart,
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use base64::Engine;
use reqwest::Client;
use serde::Deserialize;
use std::sync::Arc;
use tower_http::cors::CorsLayer;

// ── TranslationEngine ──────────────────────────────────────────

struct SarvamSTT {
    client: Client,
}

impl SarvamSTT {
    async fn transcribe(
        &self,
        api_key: &str,
        audio_data: &[u8],
        language_code: Option<&str>,
    ) -> Result<(String, Option<String>), String> {
        let lang = language_code.unwrap_or("unknown");

        let part = reqwest::multipart::Part::bytes(audio_data.to_vec())
            .file_name("audio.wav")
            .mime_str("audio/wav")
            .map_err(|e| e.to_string())?;

        let form = reqwest::multipart::Form::new()
            .part("file", part)
            .text("model", "saaras:v3".to_string())
            .text("language_code", lang.to_string())
            .text("mode", "transcribe".to_string());

        let resp = self
            .client
            .post("https://api.sarvam.ai/speech-to-text")
            .header("api-subscription-key", api_key)
            .multipart(form)
            .send()
            .await
            .map_err(|e| format!("STT request failed: {}", e))?;

        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Sarvam STT failed: {}", text));
        }

        #[derive(Deserialize)]
        struct SttResponse {
            transcript: String,
            language_code: Option<String>,
        }

        let result: SttResponse = resp.json().await.map_err(|e| format!("STT parse failed: {}", e))?;
        Ok((result.transcript, result.language_code))
    }
}

struct SarvamTranslate {
    client: Client,
}

impl SarvamTranslate {
    async fn translate(
        &self,
        api_key: &str,
        text: &str,
        source_lang: &str,
        target_lang: &str,
    ) -> Result<String, String> {
        let body = serde_json::json!({
            "input": text,
            "source_language_code": source_lang,
            "target_language_code": target_lang,
            "mode": "formal",
            "model": "mayura:v1",
        });

        let resp = self
            .client
            .post("https://api.sarvam.ai/translate")
            .header("api-subscription-key", api_key)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Translate request failed: {}", e))?;

        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Sarvam Translation failed: {}", text));
        }

        #[derive(Deserialize)]
        struct TranslateResponse {
            translated_text: String,
        }

        let result: TranslateResponse = resp.json().await.map_err(|e| format!("Translate parse failed: {}", e))?;
        Ok(result.translated_text)
    }
}

struct SarvamTTS {
    client: Client,
}

impl SarvamTTS {
    async fn synthesize(
        &self,
        api_key: &str,
        text: &str,
        language_code: &str,
        voice_id: Option<&str>,
    ) -> Result<Vec<u8>, String> {
        let body = serde_json::json!({
            "text": text,
            "speaker": voice_id.unwrap_or("shubh"),
            "language_code": language_code,
            "model": "bulbul:v3",
        });

        let resp = self
            .client
            .post("https://api.sarvam.ai/text-to-speech")
            .header("api-subscription-key", api_key)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("TTS request failed: {}", e))?;

        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Sarvam TTS failed: {}", text));
        }

        #[derive(Deserialize)]
        struct TtsResponse {
            audios: Vec<String>,
        }

        let result: TtsResponse = resp.json().await.map_err(|e| format!("TTS parse failed: {}", e))?;

        let audio_base64 = result
            .audios
            .first()
            .ok_or_else(|| "Sarvam TTS returned no audio".to_string())?;

        base64::engine::general_purpose::STANDARD
            .decode(audio_base64)
            .map_err(|e| format!("Base64 decode failed: {}", e))
    }
}

struct TranslationEngine {
    client: Client,
}

impl TranslationEngine {
    fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    async fn translate_audio(
        &self,
        api_key: &str,
        audio_data: &[u8],
        source_language: Option<&str>,
        target_language: &str,
    ) -> Result<Vec<u8>, String> {
        let stt = SarvamSTT {
            client: self.client.clone(),
        };
        let translate = SarvamTranslate {
            client: self.client.clone(),
        };
        let tts = SarvamTTS {
            client: self.client.clone(),
        };

        let (text, detected_lang) = stt.transcribe(api_key, audio_data, source_language).await?;

        if text.trim().is_empty() {
            return Err("No speech detected in audio".to_string());
        }

        let source_lang = detected_lang
            .as_deref()
            .or(source_language)
            .unwrap_or("unknown");

        let translated = translate
            .translate(api_key, &text, source_lang, target_language)
            .await?;

        let audio = tts.synthesize(api_key, &translated, target_language, None).await?;

        Ok(audio)
    }
}

// ── Axum HTTP Server ──────────────────────────────────────────

pub fn start_server() -> u16 {
    let port = portpicker::pick_unused_port().expect("no free port found");
    let engine = Arc::new(TranslationEngine::new());

    let app = Router::new()
        .route("/api/translate", post(translate_handler))
        .layer(CorsLayer::permissive())
        .with_state(engine);

    let addr = format!("127.0.0.1:{}", port);
    let addr_clone = addr.clone();

    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let listener = tokio::net::TcpListener::bind(&addr_clone).await.unwrap();
            log::info!("Embedded server listening on {}", addr_clone);
            axum::serve(listener, app).await.unwrap();
        });
    });

    log::info!("Starting embedded server on {}", addr);
    port
}

async fn translate_handler(
    engine: Arc<TranslationEngine>,
    headers: axum::http::HeaderMap,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let api_key = match headers
        .get("x-api-key")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
    {
        Some(key) => key,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "API key is required. Set it in the Settings modal."
                })),
            )
        }
    };

    let mut audio_data: Option<Vec<u8>> = None;
    let mut target_language = String::from("en-IN");
    let mut source_language: Option<String> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            audio_data = Some(field.bytes().await.unwrap_or_default().to_vec());
        }
    }

    let audio = match audio_data {
        Some(data) => data,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "No audio file provided" })),
            )
        }
    };

    match engine
        .translate_audio(&api_key, &audio, source_language.as_deref(), &target_language)
        .await
    {
        Ok(audio_bytes) => {
            let headers = [(
                axum::http::header::CONTENT_TYPE,
                "audio/wav",
            )];
            (StatusCode::OK, headers, axum::response::Body::from(audio_bytes))
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            [(
                axum::http::header::CONTENT_TYPE,
                "application/json",
            )],
            axum::response::Body::from(
                serde_json::json!({ "error": e }).to_string(),
            ),
        ),
    }
}
