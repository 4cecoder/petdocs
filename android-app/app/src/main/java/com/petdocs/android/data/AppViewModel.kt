package com.petdocs.android.data

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Minimal dashboard state: pets -> docs (selected pet) -> reminders (owner).
 * The [PetdocsApi] is passed in per call so the ViewModel never hardcodes the
 * Convex URL (it lives in SessionStore / BuildConfig at the call site).
 */
class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val session = SessionStore(application)

    private val _pets = MutableStateFlow<List<Pet>>(emptyList())
    val pets: StateFlow<List<Pet>> = _pets.asStateFlow()

    private val _selectedPetId = MutableStateFlow<String?>(null)
    val selectedPetId: StateFlow<String?> = _selectedPetId.asStateFlow()

    private val _docs = MutableStateFlow<List<VaultDoc>>(emptyList())
    val docs: StateFlow<List<VaultDoc>> = _docs.asStateFlow()

    private val _reminders = MutableStateFlow<List<ReminderItem>>(emptyList())
    val reminders: StateFlow<List<ReminderItem>> = _reminders.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun selectPet(petId: String?) {
        _selectedPetId.value = petId
    }

    fun clearError() {
        _error.value = null
    }

    /**
     * Sequential load: pets first, then docs for the selected (or first) pet,
     * then the owner's upcoming reminders.
     */
    fun refresh(api: PetdocsApi) {
        viewModelScope.launch {
            _loading.value = true
            _error.value = null
            try {
                val ownerId = session.ownerId.first()?.ifBlank { null }
                    ?: run {
                        _error.value = "Not signed in"
                        _pets.value = emptyList()
                        _docs.value = emptyList()
                        _reminders.value = emptyList()
                        return@launch
                    }
                val pets = api.listPets(ownerId)
                _pets.value = pets
                if (_selectedPetId.value == null || pets.none { it.id == _selectedPetId.value }) {
                    _selectedPetId.value = pets.firstOrNull()?.id
                }
                val petId = _selectedPetId.value
                _docs.value = if (petId != null) {
                    api.listDocs(ownerId, petId)
                } else {
                    emptyList()
                }
                _reminders.value = api.listReminders(ownerId, upcomingOnly = true)
            } catch (e: PetdocsApiException) {
                _error.value = e.message
            } catch (e: Exception) {
                _error.value = e.message ?: "Refresh failed"
            } finally {
                _loading.value = false
            }
        }
    }

    /** Marks a reminder done via `reminders:setStatus` and drops it from the list. */
    fun doneReminder(api: PetdocsApi, reminderId: String) {
        viewModelScope.launch {
            try {
                val ownerId = session.ownerId.first()?.ifBlank { null } ?: return@launch
                api.setReminderStatus(ownerId, reminderId, "done")
                _reminders.update { list -> list.filterNot { it.id == reminderId } }
            } catch (e: PetdocsApiException) {
                _error.value = e.message
            } catch (e: Exception) {
                _error.value = e.message ?: "Update failed"
            }
        }
    }

    /**
     * Snooze stub (v1): the backend has no snooze mutation (only
     * `reminders:setStatus` with done/dismissed), so snoozing dismisses for now.
     * TODO(reminders): add `dueAt` rescheduling once the backend supports it.
     */
    fun snoozeReminder(api: PetdocsApi, reminderId: String) {
        viewModelScope.launch {
            try {
                val ownerId = session.ownerId.first()?.ifBlank { null } ?: return@launch
                api.setReminderStatus(ownerId, reminderId, "dismissed")
                _reminders.update { list -> list.filterNot { it.id == reminderId } }
            } catch (e: PetdocsApiException) {
                _error.value = e.message
            } catch (e: Exception) {
                _error.value = e.message ?: "Update failed"
            }
        }
    }
}
