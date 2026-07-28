// Android Keystore integration for secure API key storage.
//
// On Android: Uses EncryptedSharedPreferences via the KeystoreHelper.kt Kotlin class.
//   The JNI bridge calls KeystoreHelper.save/load/clear static methods with a provider
//   parameter so each provider (sarvam, gemini) gets its own encrypted storage key.
//
// On Desktop: Falls back to localStorage in the WebView (handled by the frontend).

#[cfg(target_os = "android")]
use std::sync::OnceLock;

#[cfg(target_os = "android")]
static JVM: OnceLock<jni::JavaVM> = OnceLock::new();

#[cfg(target_os = "android")]
#[no_mangle]
pub extern "system" fn JNI_OnLoad(
    vm: *mut jni::sys::JavaVM,
    _: *mut std::ffi::c_void,
) -> jni::sys::jint {
    match unsafe { jni::JavaVM::from_raw(vm) } {
        Ok(jvm) => {
            log::info!("keystore::JNI_OnLoad: JavaVM captured successfully");
            let _ = JVM.set(jvm);
            jni::sys::JNI_VERSION_1_6
        }
        Err(e) => {
            log::error!("keystore::JNI_OnLoad: failed to capture JavaVM: {:?}", e);
            0
        }
    }
}

#[cfg(target_os = "android")]
mod android_keystore {
    use super::JVM;

    fn with_jni_env<F, R>(f: F) -> Result<R, String>
    where
        F: FnOnce(&mut jni::JNIEnv<'_>) -> Result<R, String>,
    {
        let vm = JVM
            .get()
            .ok_or_else(|| "JVM not initialized (JNI_OnLoad)".to_string())?;
        let mut guard = vm
            .attach_current_thread()
            .map_err(|e| format!("JNI attach failed: {}", e))?;
        f(&mut guard)
    }

    pub fn save(provider: &str, api_key: &str) -> Result<(), String> {
        log::info!("keystore::save called for provider={}", provider);
        with_jni_env(|env| {
            let class = env
                .find_class("com/personaltranslator/app/KeystoreHelper")
                .map_err(|e| format!("KeystoreHelper class not found: {}", e))?;

            let j_provider = env
                .new_string(provider)
                .map_err(|e| format!("Failed to create provider string: {}", e))?;
            let j_key = env
                .new_string(api_key)
                .map_err(|e| format!("Failed to create key string: {}", e))?;

            let result = env
                .call_static_method(
                    &class,
                    "save",
                    "(Ljava/lang/String;Ljava/lang/String;)Z",
                    &[(&j_provider).into(), (&j_key).into()],
                )
                .map_err(|e| format!("KeystoreHelper.save() failed: {}", e))?;

            if result.z().map_err(|e| format!("Failed to extract bool: {}", e))? {
                Ok(())
            } else {
                Err("KeystoreHelper.save() returned false".to_string())
            }
        })
    }

    pub fn load(provider: &str) -> Result<Option<String>, String> {
        log::info!("keystore::load called for provider={}", provider);
        with_jni_env(|env| {
            let class = env
                .find_class("com/personaltranslator/app/KeystoreHelper")
                .map_err(|e| format!("KeystoreHelper class not found: {}", e))?;

            let j_provider = env
                .new_string(provider)
                .map_err(|e| format!("Failed to create provider string: {}", e))?;

            let result = env
                .call_static_method(
                    &class,
                    "load",
                    "(Ljava/lang/String;)Ljava/lang/String;",
                    &[(&j_provider).into()],
                )
                .map_err(|e| format!("KeystoreHelper.load() failed: {}", e))?;

            let j_obj = result.l().map_err(|e| {
                format!("Failed to extract object: {}", e)
            })?;

            if j_obj.is_null() {
                log::info!("keystore::load: no key found for provider={}", provider);
                return Ok(None);
            }

            let jstr = jni::objects::JString::from(j_obj);
            let java_str = env.get_string(&jstr).map_err(|e| {
                format!("Failed to read string: {}", e)
            })?;
            Ok(Some(java_str.into()))
        })
    }

    pub fn clear(provider: &str) -> Result<(), String> {
        log::info!("keystore::clear called for provider={}", provider);
        with_jni_env(|env| {
            let class = env
                .find_class("com/personaltranslator/app/KeystoreHelper")
                .map_err(|e| format!("KeystoreHelper class not found: {}", e))?;

            let j_provider = env
                .new_string(provider)
                .map_err(|e| format!("Failed to create provider string: {}", e))?;

            let result = env
                .call_static_method(
                    &class,
                    "clear",
                    "(Ljava/lang/String;)Z",
                    &[(&j_provider).into()],
                )
                .map_err(|e| format!("KeystoreHelper.clear() failed: {}", e))?;

            if result.z().map_err(|e| format!("Failed to extract bool: {}", e))? {
                Ok(())
            } else {
                Err("KeystoreHelper.clear() returned false".to_string())
            }
        })
    }
}

#[cfg(not(target_os = "android"))]
mod desktop_keystore {
    pub fn save(_provider: &str, _api_key: &str) -> Result<(), String> {
        Ok(())
    }
    pub fn load(_provider: &str) -> Result<Option<String>, String> {
        Ok(None)
    }
    pub fn clear(_provider: &str) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(target_os = "android")]
pub use android_keystore::{clear, load, save};

#[cfg(not(target_os = "android"))]
pub use desktop_keystore::{clear, load, save};
