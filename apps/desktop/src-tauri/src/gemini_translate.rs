use serde::{Deserialize, Serialize};

const GEMINI_API_BASE: &str = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL: &str = "gemini-2.0-flash-lite";

fn get_language_name(code: &str) -> &str {
    match code.split('-').next().unwrap_or("") {
        "am" => "Amharic",
        "ar" => "Arabic",
        "as" => "Assamese",
        "bn" => "Bengali",
        "my" => "Burmese",
        "zh" => "Chinese",
        "nl" => "Dutch",
        "en" => "English",
        "fr" => "French",
        "de" => "German",
        "gu" => "Gujarati",
        "ha" => "Hausa",
        "hi" => "Hindi",
        "ig" => "Igbo",
        "id" => "Indonesian",
        "it" => "Italian",
        "ja" => "Japanese",
        "kn" => "Kannada",
        "km" => "Khmer",
        "ko" => "Korean",
        "lo" => "Lao",
        "ml" => "Malayalam",
        "ms" => "Malay",
        "mr" => "Marathi",
        "ne" => "Nepali",
        "or" => "Odia",
        "pl" => "Polish",
        "pt" => "Portuguese",
        "pa" => "Punjabi",
        "ru" => "Russian",
        "si" => "Sinhala",
        "es" => "Spanish",
        "sw" => "Swahili",
        "sv" => "Swedish",
        "ta" => "Tamil",
        "te" => "Telugu",
        "th" => "Thai",
        "tr" => "Turkish",
        "ur" => "Urdu",
        "vi" => "Vietnamese",
        "yo" => "Yoruba",
        "zu" => "Zulu",
        _ => code,
    }
}

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<Content>,
    #[serde(skip_serializing_if = "Option::is_none")]
    generation_config: Option<GenerationConfig>,
}

#[derive(Serialize)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Serialize)]
struct Part {
    text: String,
}

#[derive(Serialize)]
struct GenerationConfig {
    temperature: f32,
    max_output_tokens: u32,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<Candidate>>,
}

#[derive(Deserialize)]
struct Candidate {
    content: Option<ContentResponse>,
}

#[derive(Deserialize)]
struct ContentResponse {
    parts: Option<Vec<PartResponse>>,
}

#[derive(Deserialize)]
struct PartResponse {
    text: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct TranslationResult {
    pub translated_text: String,
}

#[derive(Serialize)]
struct AudioPart {
    #[serde(rename = "inlineData")]
    inline_data: InlineData,
}

#[derive(Serialize)]
struct InlineData {
    mime_type: String,
    data: String,
}

#[derive(Serialize)]
struct GeminiRequestWithAudio {
    contents: Vec<ContentWithAudio>,
    #[serde(skip_serializing_if = "Option::is_none")]
    generation_config: Option<GenerationConfig>,
}

#[derive(Serialize)]
struct ContentWithAudio {
    parts: Vec<PartWithAudio>,
}

#[derive(Serialize)]
#[serde(untagged)]
enum PartWithAudio {
    Text { text: String },
    Audio { #[serde(rename = "inlineData")] inline_data: InlineData },
}

pub async fn translate_text(
    api_key: &str,
    text: &str,
    source_lang: &str,
    target_lang: &str,
) -> Result<TranslationResult, String> {
    let target_name = get_language_name(target_lang);
    let source_name = if source_lang.is_empty() || source_lang == "unknown" {
        "the detected language"
    } else {
        get_language_name(source_lang)
    };

    let prompt = format!(
        "Translate the following text from {} to {}. Return ONLY the translated text, nothing else.\n\nText to translate:\n{}",
        source_name, target_name, text
    );

    let url = format!(
        "{}/models/{}:generateContent?key={}",
        GEMINI_API_BASE, GEMINI_MODEL, api_key
    );

    let request_body = GeminiRequest {
        contents: vec![Content {
            parts: vec![Part { text: prompt }],
        }],
        generation_config: Some(GenerationConfig {
            temperature: 0.2,
            max_output_tokens: 1024,
        }),
    };

    let client = reqwest::Client::new();
    let mut last_error = String::new();

    for attempt in 0..3 {
        if attempt > 0 {
            let delay = attempt as u64 * 10;
            log::warn!("Gemini: Retry {}/3, waiting {}s...", attempt, delay);
            tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
        }

        let response = client
            .post(&url)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        if response.status().as_u16() == 429 {
            let error_text = response.text().await.unwrap_or_default();
            let wait_time = if let Some(caps) = regex::Regex::new(r"retry in ([\d.]+)s")
                .ok()
                .and_then(|re| re.captures(&error_text))
                .and_then(|c| c.get(1))
                .and_then(|m| m.as_str().parse::<u64>().ok())
            {
                caps
            } else {
                15
            };
            last_error = format!("Rate limited. Please wait {}s and try again.", wait_time);
            log::warn!("Gemini: 429 received, will retry after {}s", wait_time);
            continue;
        }

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Gemini API error: {} - {}", status, error_text));
        }

        let gemini_response: GeminiResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        let translated_text = gemini_response
            .candidates
            .as_ref()
            .and_then(|c| c.first())
            .and_then(|c| c.content.as_ref())
            .and_then(|c| c.parts.as_ref())
            .and_then(|p| p.first())
            .and_then(|p| p.text.as_ref())
            .map(|t| t.trim().to_string())
            .ok_or_else(|| "No translation received from Gemini".to_string())?;

        return Ok(TranslationResult { translated_text });
    }

    Err(last_error)
}

pub async fn translate_audio(
    api_key: &str,
    audio_b64: &str,
    source_lang: &str,
    target_lang: &str,
) -> Result<TranslationResult, String> {
    let target_name = get_language_name(target_lang);
    let source_name = if source_lang.is_empty() || source_lang == "unknown" {
        "the detected language"
    } else {
        get_language_name(source_lang)
    };

    let prompt = format!(
        "Listen to this audio. Transcribe what is spoken, then translate it from {} to {}. Return ONLY the translated text, nothing else.",
        source_name, target_name
    );

    let url = format!(
        "{}/models/{}:generateContent?key={}",
        GEMINI_API_BASE, GEMINI_MODEL, api_key
    );

    let request_body = GeminiRequestWithAudio {
        contents: vec![ContentWithAudio {
            parts: vec![
                PartWithAudio::Text { text: prompt },
                PartWithAudio::Audio {
                    inline_data: InlineData {
                        mime_type: "audio/wav".to_string(),
                        data: audio_b64.to_string(),
                    },
                },
            ],
        }],
        generation_config: Some(GenerationConfig {
            temperature: 0.2,
            max_output_tokens: 1024,
        }),
    };

    let client = reqwest::Client::new();
    let mut last_error = String::new();

    for attempt in 0..3 {
        if attempt > 0 {
            let delay = attempt as u64 * 10;
            tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
        }

        let response = client
            .post(&url)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        if response.status().as_u16() == 429 {
            let error_text = response.text().await.unwrap_or_default();
            let wait_time = if let Some(caps) = regex::Regex::new(r"retry in ([\d.]+)s")
                .ok()
                .and_then(|re| re.captures(&error_text))
                .and_then(|c| c.get(1))
                .and_then(|m| m.as_str().parse::<u64>().ok())
            {
                caps
            } else {
                15
            };
            last_error = format!("Rate limited. Please wait {}s and try again.", wait_time);
            continue;
        }

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Gemini API error: {} - {}", status, error_text));
        }

        let gemini_response: GeminiResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        let translated_text = gemini_response
            .candidates
            .as_ref()
            .and_then(|c| c.first())
            .and_then(|c| c.content.as_ref())
            .and_then(|c| c.parts.as_ref())
            .and_then(|p| p.first())
            .and_then(|p| p.text.as_ref())
            .map(|t| t.trim().to_string())
            .ok_or_else(|| "No translation received from Gemini".to_string())?;

        return Ok(TranslationResult { translated_text });
    }

    Err(last_error)
}
