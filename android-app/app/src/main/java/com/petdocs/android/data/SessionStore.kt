package com.petdocs.android.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.petdocsStore by preferencesDataStore("petdocs_session")

/**
 * Lightweight session for the Android app. Mirrors the portal's SessionStore
 * shape but with `petdocs_*` keys: the owner's email (for display + upload
 * attribution), the Convex `owners` id (required arg for every query), and an
 * optional Convex URL override (defaults to BuildConfig.CONVEX_URL).
 */
class SessionStore(private val context: Context) {
    private val ownerEmailKey = stringPreferencesKey("petdocs_owner_email")
    private val ownerIdKey = stringPreferencesKey("petdocs_owner_id")
    private val convexUrlOverrideKey = stringPreferencesKey("petdocs_convex_url")

    val ownerEmail: Flow<String?> = context.petdocsStore.data.map { prefs ->
        prefs[ownerEmailKey]?.ifBlank { null }
    }

    val ownerId: Flow<String?> = context.petdocsStore.data.map { prefs ->
        prefs[ownerIdKey]?.ifBlank { null }
    }

    val convexUrlOverride: Flow<String?> = context.petdocsStore.data.map { prefs ->
        prefs[convexUrlOverrideKey]?.ifBlank { null }
    }

    suspend fun setOwnerEmail(email: String?) {
        context.petdocsStore.edit { prefs ->
            if (email.isNullOrBlank()) prefs.remove(ownerEmailKey) else prefs[ownerEmailKey] = email
        }
    }

    suspend fun setOwnerId(ownerId: String?) {
        context.petdocsStore.edit { prefs ->
            if (ownerId.isNullOrBlank()) prefs.remove(ownerIdKey) else prefs[ownerIdKey] = ownerId
        }
    }

    suspend fun setConvexUrlOverride(url: String?) {
        context.petdocsStore.edit { prefs ->
            if (url.isNullOrBlank()) prefs.remove(convexUrlOverrideKey) else prefs[convexUrlOverrideKey] = url.trim()
        }
    }

    suspend fun setSession(email: String?, ownerId: String?) {
        context.petdocsStore.edit { prefs ->
            if (email.isNullOrBlank()) prefs.remove(ownerEmailKey) else prefs[ownerEmailKey] = email
            if (ownerId.isNullOrBlank()) prefs.remove(ownerIdKey) else prefs[ownerIdKey] = ownerId
        }
    }

    suspend fun clear() {
        context.petdocsStore.edit { it.clear() }
    }
}
