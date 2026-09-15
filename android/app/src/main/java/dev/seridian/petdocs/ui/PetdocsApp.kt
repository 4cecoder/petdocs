package dev.seridian.petdocs.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.seridian.petdocs.data.AppUiState
import dev.seridian.petdocs.data.AppViewModel

/**
 * Root switcher: SignedOut → SignInScreen; SignedIn → Pets list ↔ Pet
 * detail (simple state back stack — no nav library needed for two levels).
 */
@Composable
fun PetdocsApp(viewModel: AppViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    when (val current = state) {
        AppUiState.Restoring -> BootSplash()
        is AppUiState.SignedOut -> SignInScreen(viewModel)
        is AppUiState.SignedIn ->
            if (current.selectedPetId != null) {
                PetDetailScreen(state = current, onBack = viewModel::closePet)
            } else {
                PetsScreen(
                    state = current,
                    onOpenPet = viewModel::openPet,
                    onRefresh = viewModel::refresh,
                    onSignOut = { viewModel.signOut() },
                )
            }
    }
}

@Composable
private fun BootSplash() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}
