use base64::Engine;
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::time::Duration;
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::audio;

const SEND_CHUNK_SIZE: usize = 3200;
const SEND_DELAY_MS: Duration = Duration::from_millis(20);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(600);
const RECEIVE_SAMPLE_RATE: u32 = 24000;

/// Gemini Live Translate provider (Rust).
/// Streams audio via WebSocket realtimeInput chunks, matching the Python template.

pub struct GeminiLiveTranslator {
    api_key: String,
}

impl GeminiLiveTranslator {
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }

    pub async fn translate_audio(
        &self,
        wav_data: &[u8],
        target_language: &str,
    ) -> Result<Vec<u8>, String> {
        let pcm = audio::extract_pcm_from_wav(wav_data)?;
        let lang_code = target_language.split('-').next().unwrap_or("en");

        let ws_url = format!(
            "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={}",
            self.api_key
        );

        log::info!("Gemini: Connecting to Live API...");
        let (ws_stream, _) = connect_async(&ws_url)
            .await
            .map_err(|e| format!("Gemini WebSocket connect failed: {}", e))?;

        let (mut write, mut read) = ws_stream.split();

        // 1. Send setup message
        log::info!("Gemini: Sending setup...");
        let setup = json!({
            "setup": {
                "model": "models/gemini-3.5-live-translate-preview",
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "translationConfig": {
                        "targetLanguageCode": lang_code,
                        "echoTargetLanguage": true
                    },
                    "inputAudioTranscription": {},
                    "outputAudioTranscription": {}
                }
            }
        });
        write
            .send(Message::Text(setup.to_string()))
            .await
            .map_err(|e| format!("Gemini: Failed to send setup: {}", e))?;

        // 2. Wait for setupComplete
        let setup_done = wait_for_setup_complete(&mut read).await?;
        if !setup_done {
            return Err("Gemini: Setup was not completed".to_string());
        }
        log::info!("Gemini: Setup complete");

        // 3. Stream audio in 3200-byte chunks via realtimeInput
        log::info!("Gemini: Streaming audio via realtimeInput...");
        for offset in (0..pcm.len()).step_by(SEND_CHUNK_SIZE) {
            let end = (offset + SEND_CHUNK_SIZE).min(pcm.len());
            let chunk = &pcm[offset..end];
            let audio_msg = json!({
                "realtimeInput": {
                    "audio": {
                        "data": base64::engine::general_purpose::STANDARD.encode(chunk),
                        "mimeType": "audio/pcm;rate=16000"
                    }
                }
            });
            write
                .send(Message::Text(audio_msg.to_string()))
                .await
                .map_err(|e| format!("Gemini: Failed to send audio: {}", e))?;
            tokio::time::sleep(SEND_DELAY_MS).await;
        }
        log::info!("Gemini: Audio streaming complete, sending turnComplete...");

        // Signal end of input — server starts processing after this
        let turn_done = json!({
            "clientContent": {
                "turnComplete": true
            }
        });
        let _ = write.send(Message::Text(turn_done.to_string())).await;

        log::info!("Gemini: Waiting for response...");

        // 4. Wait for server response (with timeout)
        // The server may not send turnComplete; we stop on close or GoAway.
        let translated_chunks = tokio::time::timeout(CONNECT_TIMEOUT, async {
            collect_audio_chunks(&mut read).await
        })
        .await
        .map_err(|_| "Gemini Live Translate timed out".to_string())?
        .map_err(|e| format!("Gemini: Failed to collect audio chunks: {}", e))?;

        if translated_chunks.is_empty() {
            return Err("No translated audio received from Gemini".to_string());
        }

        let combined = translated_chunks.concat();
        log::info!("Gemini: Response received, {} bytes", combined.len());

        // Wrap in WAV header at 24kHz
        let header = audio::write_wav_header(RECEIVE_SAMPLE_RATE, combined.len() as u32);
        let mut result = Vec::with_capacity(header.len() + combined.len());
        result.extend_from_slice(&header);
        result.extend_from_slice(&combined);

        Ok(result)
    }
}

async fn wait_for_setup_complete(
    read: &mut (impl futures_util::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin),
) -> Result<bool, String> {
    loop {
        match read.next().await {
            Some(Ok(Message::Text(text))) => {
                let val: Value =
                    serde_json::from_str(&text).map_err(|e| format!("JSON parse: {}", e))?;
                if val.get("setupComplete").is_some() {
                    return Ok(true);
                }
            }
            Some(Ok(Message::Close(_))) => {
                return Err("Gemini: WebSocket closed during setup".to_string());
            }
            Some(Err(e)) => {
                return Err(format!("Gemini: WebSocket error during setup: {}", e));
            }
            None => {
                return Err("Gemini: WebSocket stream ended during setup".to_string());
            }
            _ => {}
        }
    }
}

async fn collect_audio_chunks(
    read: &mut (impl futures_util::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin),
) -> Result<Vec<Vec<u8>>, String> {
    let mut chunks: Vec<Vec<u8>> = Vec::new();

    loop {
        match read.next().await {
            Some(Ok(Message::Text(text))) => {
                let val: Value =
                    serde_json::from_str(&text).map_err(|e| format!("JSON parse: {}", e))?;

                if let Some(sc) = val.get("serverContent") {
                    let parts = sc
                        .get("modelTurn")
                        .and_then(|mt| mt.get("parts"))
                        .and_then(|p| p.as_array());

                    if let Some(parts) = parts {
                        for part in parts {
                            if let Some(data) = part
                                .get("inlineData")
                                .and_then(|id| id.get("data"))
                                .and_then(|d| d.as_str())
                            {
                                let audio_bytes = base64::engine::general_purpose::STANDARD
                                    .decode(data)
                                    .map_err(|e| format!("Base64 decode: {}", e))?;
                                chunks.push(audio_bytes);
                            }
                        }
                    }

                    if sc
                        .get("turnComplete")
                        .and_then(|t| t.as_bool())
                        .unwrap_or(false)
                    {
                        break;
                    }
                }
            }
            Some(Ok(Message::Close(_))) => break,
            Some(Err(e)) => return Err(format!("Gemini: WebSocket error: {}", e)),
            None => break,
            _ => {}
        }
    }

    Ok(chunks)
}
