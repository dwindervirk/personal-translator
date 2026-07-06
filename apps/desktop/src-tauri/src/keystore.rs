// Android Keystore integration for secure API key storage.
//
// On Android: Uses EncryptedSharedPreferences via the KeystoreHelper.kt Kotlin class.
//   The KeystoreHelper is initialized in MainActivity.kt and uses AES-256-GCM encryption
//   with Android MasterKey. The JNI bridge from Rust to Kotlin is available for future
//   integration. Currently, the API key is primarily managed through the frontend's
//   localStorage (which persists reliably across app restarts on both platforms).
//
// On Desktop: Falls back to localStorage in the WebView (handled by the frontend).
//   The Tauri commands save/load/clear_api_key are registered but the storage is
//   delegated to the frontend.
//
// Future: To use Android Keystore directly from Rust, add `jni` crate to Cargo.toml,
//   use KeystoreHelper's JNI methods (JVM pointer available through Tauri's Android API).

#[cfg(target_os = "android")]
mod android_keystore {
    pub fn save(_api_key: &str) -> Result<(), String> {
        // TODO: JNI bridge to KeystoreHelper.kt's EncryptedSharedPreferences
        // See KeystoreHelper.kt for the Kotlin implementation
        Ok(())
    }

    pub fn load() -> Result<Option<String>, String> {
        // TODO: JNI bridge to KeystoreHelper.kt's EncryptedSharedPreferences
        Ok(None)
    }

    pub fn clear() -> Result<(), String> {
        Ok(())
    }
}

#[cfg(not(target_os = "android"))]
mod desktop_keystore {
    // Desktop: API key is managed via localStorage in the WebView
    pub fn save(_api_key: &str) -> Result<(), String> {
        Ok(())
    }

    pub fn load() -> Result<Option<String>, String> {
        Ok(None)
    }

    pub fn clear() -> Result<(), String> {
        Ok(())
    }
}

#[cfg(target_os = "android")]
pub use android_keystore::{clear, load, save};

#[cfg(not(target_os = "android"))]
pub use desktop_keystore::{clear, load, save};
