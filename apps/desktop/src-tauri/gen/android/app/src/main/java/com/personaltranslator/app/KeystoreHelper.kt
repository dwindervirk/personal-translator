package com.personaltranslator.app

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

object KeystoreHelper {
    private const val PREF_NAME = "secure_prefs"
    private const val KEY_API_KEY = "translator_api_key"

    private var prefs: SharedPreferences? = null

    fun init(context: Context) {
        if (prefs != null) return
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        prefs = EncryptedSharedPreferences.create(
            PREF_NAME,
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    @JvmStatic
    fun save(apiKey: String): Boolean {
        val p = prefs ?: return false
        p.edit().putString(KEY_API_KEY, apiKey).apply()
        return true
    }

    @JvmStatic
    fun load(): String? {
        val p = prefs ?: return null
        return p.getString(KEY_API_KEY, null)
    }

    @JvmStatic
    fun clear(): Boolean {
        val p = prefs ?: return false
        p.edit().remove(KEY_API_KEY).apply()
        return true
    }
}
