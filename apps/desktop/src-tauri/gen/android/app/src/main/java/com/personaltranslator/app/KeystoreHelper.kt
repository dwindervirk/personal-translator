package com.personaltranslator.app

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

object KeystoreHelper {
    private const val PREF_NAME = "secure_prefs"

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
    fun save(provider: String, apiKey: String): Boolean {
        val p = prefs ?: return false
        p.edit().putString("translator_api_key_$provider", apiKey).apply()
        return true
    }

    @JvmStatic
    fun load(provider: String): String? {
        val p = prefs ?: return null
        return p.getString("translator_api_key_$provider", null)
    }

    @JvmStatic
    fun clear(provider: String): Boolean {
        val p = prefs ?: return false
        p.edit().remove("translator_api_key_$provider").apply()
        return true
    }
}
