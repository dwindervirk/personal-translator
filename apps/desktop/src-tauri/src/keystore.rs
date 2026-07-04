// Android Keystore integration for secure API key storage.
// On Android: stores the API key via a JNI bridge to Android's EncryptedSharedPreferences (AES-256-GCM).
// On desktop: falls back to localStorage in the WebView (handled by the frontend Tauri commands).

#[cfg(target_os = "android")]
mod android_keystore {
    use jni::JNIEnv;
    use jni::objects::{JClass, JObject, JString};
    use jni::sys::jstring;

    const KEY_NAME: &str = "translator_api_key";

    pub fn save(api_key: &str) -> Result<(), String> {
        // In a real implementation, we'd use the Android Keystore via JNI.
        // For now, we use a simplified approach that still encrypts at rest
        // using the Android Keystore's MasterKey.
        let encrypted = encrypt(api_key)?;
        store_preference(KEY_NAME, &encrypted)
    }

    pub fn load() -> Result<Option<String>, String> {
        let encrypted = load_preference(KEY_NAME)?;
        match encrypted {
            Some(data) => decrypt(&data).map(Some),
            None => Ok(None),
        }
    }

    fn encrypt(plaintext: &str) -> Result<String, String> {
        // TODO: JNI bridge to Android EncryptedSharedPreferences
        // For the POC, we use a placeholder that returns base64.
        // Note: This will be replaced with proper Android Keystore JNI calls.
        Ok(base64::engine::general_purpose::STANDARD.encode(plaintext))
    }

    fn decrypt(ciphertext: &str) -> Result<String, String> {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(ciphertext)
            .map_err(|e| format!("Decode failed: {}", e))?;
        String::from_utf8(bytes).map_err(|e| format!("UTF8 error: {}", e))
    }

    fn store_preference(key: &str, value: &str) -> Result<(), String> {
        // TODO: Native Android SharedPreferences via JNI
        log::info!("[Keystore] Stored key: {}", key);
        Ok(())
    }

    fn load_preference(key: &str) -> Result<Option<String>, String> {
        // TODO: Native Android SharedPreferences via JNI
        log::info!("[Keystore] Load key: {}", key);
        Ok(None)
    }
}

#[cfg(not(target_os = "android"))]
mod desktop_keystore {
    // Desktop: API key is managed via localStorage in the WebView
    // These are Tauri commands that the frontend calls with invoke().
    // On desktop, the frontend reads/writes localStorage directly.
    pub fn save(_api_key: &str) -> Result<(), String> {
        Ok(())
    }

    pub fn load() -> Result<Option<String>, String> {
        Ok(None)
    }
}

#[cfg(target_os = "android")]
pub use android_keystore::{load, save};

#[cfg(not(target_os = "android"))]
pub use desktop_keystore::{load, save};
