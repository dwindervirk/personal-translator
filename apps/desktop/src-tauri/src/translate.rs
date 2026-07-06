use base64::Engine;
use reqwest::Client;
use serde::Deserialize;

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
        let resp = self.client.post("https://api.sarvam.ai/speech-to-text")
            .header("api-subscription-key", api_key)
            .multipart(form)
            .send().await.map_err(|e| format!("STT request failed: {}", e))?;
        if !resp.status().is_success() {
            return Err(format!("Sarvam STT failed: {}", resp.text().await.unwrap_or_default()));
        }
        #[derive(Deserialize)]
        struct SttResponse { transcript: String, language_code: Option<String> }
        let result: SttResponse = resp.json().await.map_err(|e| format!("STT parse failed: {}", e))?;
        Ok((result.transcript, result.language_code))
    }
}

struct SarvamTranslate {
    client: Client,
}

impl SarvamTranslate {
    async fn translate(&self, api_key: &str, text: &str, source_lang: &str, target_lang: &str) -> Result<String, String> {
        let body = serde_json::json!({"input": text, "source_language_code": source_lang, "target_language_code": target_lang, "mode": "formal", "model": "mayura:v1"});
        let resp = self.client.post("https://api.sarvam.ai/translate")
            .header("api-subscription-key", api_key)
            .json(&body)
            .send().await.map_err(|e| format!("Translate request failed: {}", e))?;
        if !resp.status().is_success() {
            return Err(format!("Sarvam Translation failed: {}", resp.text().await.unwrap_or_default()));
        }
        #[derive(Deserialize)]
        struct TranslateResponse { translated_text: String }
        let result: TranslateResponse = resp.json().await.map_err(|e| format!("Translate parse failed: {}", e))?;
        Ok(result.translated_text)
    }
}

struct SarvamTTS {
    client: Client,
}

impl SarvamTTS {
    async fn synthesize(&self, api_key: &str, text: &str, language_code: &str, voice_id: Option<&str>) -> Result<Vec<u8>, String> {
        let body = serde_json::json!({"text": text, "speaker": voice_id.unwrap_or("shubh"), "language_code": language_code, "model": "bulbul:v3"});
        let resp = self.client.post("https://api.sarvam.ai/text-to-speech")
            .header("api-subscription-key", api_key)
            .json(&body)
            .send().await.map_err(|e| format!("TTS request failed: {}", e))?;
        if !resp.status().is_success() {
            return Err(format!("Sarvam TTS failed: {}", resp.text().await.unwrap_or_default()));
        }
        #[derive(Deserialize)]
        struct TtsResponse { audios: Vec<String> }
        let result: TtsResponse = resp.json().await.map_err(|e| format!("TTS parse failed: {}", e))?;
        let audio_base64 = result.audios.first().ok_or_else(|| "Sarvam TTS returned no audio".to_string())?;
        base64::engine::general_purpose::STANDARD.decode(audio_base64).map_err(|e| format!("Base64 decode failed: {}", e))
    }
}

pub struct TranslationEngine {
    client: Client,
}

impl TranslationEngine {
    pub fn new() -> Self {
        Self { client: Client::new() }
    }

    pub async fn translate_audio(&self, api_key: &str, audio_data: &[u8], source_language: Option<&str>, target_language: &str) -> Result<Vec<u8>, String> {
        let stt = SarvamSTT { client: self.client.clone() };
        let translator = SarvamTranslate { client: self.client.clone() };
        let tts = SarvamTTS { client: self.client.clone() };
        let (text, detected_lang) = stt.transcribe(api_key, audio_data, source_language).await?;
        if text.trim().is_empty() {
            return Err("No speech detected in audio".to_string());
        }
        let source_lang = detected_lang.as_deref().or(source_language).unwrap_or("unknown");
        let translated = translator.translate(api_key, &text, source_lang, target_language).await?;
        let audio = tts.synthesize(api_key, &translated, target_language, None).await?;
        Ok(audio)
    }
}
