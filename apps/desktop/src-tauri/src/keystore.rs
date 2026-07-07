// Android Keystore integration for secure API key storage.
//
// On Android: Uses EncryptedSharedPreferences via the KeystoreHelper.kt Kotlin class.
//   The JNI bridge calls KeystoreHelper.save/load/clear static methods through the
//   JNI layer. The JavaVM pointer is captured in JNI_OnLoad when the library loads.
//
// On Desktop: Falls back to localStorage in the WebView (handled by the frontend).
//   The Tauri commands save/load/clear_api_key are registered but storage is
//   delegated to the frontend via the Redux store.

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
    // Safety: JNI_OnLoad receives a valid JavaVM pointer from the JVM
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

    pub fn save(api_key: &str) -> Result<(), String> {
        log::info!("keystore::save called, key length: {}", api_key.len());
        with_jni_env(|env| {
            let class = env
                .find_class("com/personaltranslator/app/KeystoreHelper")
                .map_err(|e| format!("KeystoreHelper class not found: {}", e))?;

            let j_key = env
                .new_string(api_key)
                .map_err(|e| format!("Failed to create JNI string: {}", e))?;

            let result = env
                .call_static_method(
                    &class,
                    "save",
                    "(Ljava/lang/String;)Z",
                    &[(&j_key).into()],
                )
                .map_err(|e| format!("KeystoreHelper.save() failed: {}", e))?;

            if result.z().map_err(|e| format!("Failed to extract bool: {}", e))? {
                Ok(())
            } else {
                Err("KeystoreHelper.save() returned false (prefs not initialized)".to_string())
            }
        })
    }

    pub fn load() -> Result<Option<String>, String> {
        log::info!("keystore::load called");
        let result = with_jni_env(|env| {
            log::info!("keystore::load: JNI env acquired");
            let class = env
                .find_class("com/personaltranslator/app/KeystoreHelper")
                .map_err(|e| {
                    log::error!("keystore::load: find_class failed: {}", e);
                    format!("KeystoreHelper class not found: {}", e)
                })?;
            log::info!("keystore::load: class found");

            let result = env
                .call_static_method(&class, "load", "()Ljava/lang/String;", &[])
                .map_err(|e| {
                    log::error!("keystore::load: call_static_method failed: {}", e);
                    format!("KeystoreHelper.load() failed: {}", e)
                })?;
            log::info!("keystore::load: method called");

            let j_obj = result
                .l()
                .map_err(|e| {
                    log::error!("keystore::load: extract object failed: {}", e);
                    format!("Failed to extract object: {}", e)
                })?;
            log::info!("keystore::load: object extracted, is_null: {}", j_obj.is_null());

            if j_obj.is_null() {
                log::info!("keystore::load: no key found (null)");
                return Ok(None);
            }

            let jstr = jni::objects::JString::from(j_obj);
            let java_str = env
                .get_string(&jstr)
                .map_err(|e| {
                    log::error!("keystore::load: get_string failed: {}", e);
                    format!("Failed to read string: {}", e)
                })?;
            let key: String = java_str.into();
            log::info!("keystore::load: key retrieved, length: {}", key.len());
            Ok(Some(key))
        });
        log::info!("keystore::load: returning {:?}", result);
        result
    }

    pub fn clear() -> Result<(), String> {
        with_jni_env(|env| {
            let class = env
                .find_class("com/personaltranslator/app/KeystoreHelper")
                .map_err(|e| format!("KeystoreHelper class not found: {}", e))?;

            let result = env
                .call_static_method(&class, "clear", "()Z", &[])
                .map_err(|e| format!("KeystoreHelper.clear() failed: {}", e))?;

            if result.z().map_err(|e| format!("Failed to extract bool: {}", e))? {
                Ok(())
            } else {
                Err("KeystoreHelper.clear() returned false (prefs not initialized)".to_string())
            }
        })
    }
}

#[cfg(not(target_os = "android"))]
mod desktop_keystore {
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
