package com.petdocs.android.ui.nav

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.petdocs.android.data.AppViewModel
import com.petdocs.android.data.PetdocsApi
import com.petdocs.android.data.SessionStore
import kotlinx.coroutines.flow.flowOf
import com.petdocs.android.ui.screens.AdminScreen
import com.petdocs.android.ui.screens.DocsScreen
import com.petdocs.android.ui.screens.HomeScreen
import com.petdocs.android.ui.screens.LoginScreen
import com.petdocs.android.ui.screens.NotificationsScreen
import com.petdocs.android.ui.screens.OnboardingScreen
import com.petdocs.android.ui.screens.PassportScreen
import com.petdocs.android.ui.screens.PetDetailScreen
import com.petdocs.android.ui.screens.PetsScreen
import com.petdocs.android.ui.screens.RemindersScreen
import com.petdocs.android.ui.screens.ScannerScreen
import com.petdocs.android.ui.screens.SettingsScreen
import com.petdocs.android.ui.screens.ShareScreen

private val bottomTabs = HubId.entries.toList()

private fun hubSelected(hub: HubId, route: String): Boolean = when (hub) {
    HubId.Home -> route == HubId.Home.route
    HubId.Pets -> route == HubId.Pets.route || route.startsWith("petDetail/")
    HubId.Docs -> route == HubId.Docs.route
    HubId.More -> route == "reminders" || route == "share" ||
        route.startsWith("scanner") || route == "settings" ||
        route == "notifications" || route == "admin" || route == "onboarding"
}

private fun isBottomBarRoute(route: String): Boolean = when {
    route == "login" -> false
    route == "onboarding" -> false
    route.startsWith("passport/") -> false
    route == "passport/{token}" -> false
    route.isEmpty() -> false
    else -> true
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PetdocsNav(
    api: PetdocsApi? = null,
    session: SessionStore? = null,
    appViewModel: AppViewModel? = null,
) {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route.orEmpty()
    var showMore by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()

    // Session-backed routing: null session/api keeps previews + tests working.
    val ownerId by remember(session) { session?.ownerId ?: flowOf(null) }
        .collectAsState(initial = null)
    val ownerEmail by remember(session) { session?.ownerEmail ?: flowOf(null) }
        .collectAsState(initial = null)
    // Start at "home" when a session email is persisted, else "login".
    val startDestination = if (ownerEmail != null) "home" else "login"

    // Bridge the shared client + owner into the dashboard ViewModel so its
    // parameterless refresh() loads pets -> docs -> reminders when both set.
    LaunchedEffect(api, ownerId) {
        if (api != null) appViewModel?.init(api, ownerId)
    }

    Scaffold(
        bottomBar = {
            if (isBottomBarRoute(route)) {
                NavigationBar {
                    bottomTabs.forEach { hub ->
                        NavigationBarItem(
                            selected = hubSelected(hub, route),
                            onClick = {
                                if (hub == HubId.More) {
                                    showMore = true
                                } else {
                                    nav.navigate(hub.route) {
                                        popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            },
                            icon = { Icon(hub.icon, contentDescription = hub.label) },
                            label = { Text(hub.label) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = startDestination,
            modifier = Modifier.padding(padding),
        ) {
            composable("login") {
                LoginScreen(
                    onSignedIn = {
                        nav.navigate("home") {
                            popUpTo("login") { inclusive = true }
                        }
                    },
                    session = session,
                )
            }
            composable("home") {
                HomeScreen(
                    onPet = { petId -> nav.navigate("petDetail/$petId") },
                    onDocs = { nav.navigate("docs") },
                    onReminders = { nav.navigate("reminders") },
                    api = api,
                    ownerId = ownerId,
                )
            }
            composable("pets") {
                PetsScreen(
                    onPet = { petId -> nav.navigate("petDetail/$petId") },
                    api = api,
                    ownerId = ownerId,
                )
            }
            composable(
                route = "petDetail/{petId}",
                arguments = listOf(navArgument("petId") { type = NavType.StringType }),
            ) { entry ->
                val petId = entry.arguments?.getString("petId").orEmpty()
                PetDetailScreen(
                    petId = petId,
                    onShare = { nav.navigate("share") },
                    api = api,
                    ownerId = ownerId,
                )
            }
            composable("docs") {
                DocsScreen(
                    api = api,
                    ownerId = ownerId,
                )
            }
            composable("reminders") {
                RemindersScreen(
                    api = api,
                    ownerId = ownerId,
                )
            }
            composable("share") {
                ShareScreen(
                    api = api,
                    ownerId = ownerId,
                )
            }
            composable(
                route = "scanner?petId={petId}",
                arguments = listOf(
                    navArgument("petId") {
                        type = NavType.StringType
                        defaultValue = ""
                    },
                ),
            ) { entry ->
                val argPetId = entry.arguments?.getString("petId").orEmpty().ifEmpty { null }
                ScannerScreen(
                    onDone = { nav.popBackStack() },
                    api = api,
                    ownerId = ownerId,
                    petId = argPetId,
                )
            }
            composable(
                route = "passport/{token}",
                arguments = listOf(navArgument("token") { type = NavType.StringType }),
            ) { entry ->
                val token = entry.arguments?.getString("token").orEmpty()
                PassportScreen(token = token, api = api)
            }
            composable("settings") {
                SettingsScreen()
            }
            composable("onboarding") {
                // First-run entry point (also in the More sheet). LoginScreen's
                // onSignedIn signature is frozen, so fresh-account
                // login → onboarding routing stays a TODO at the call site.
                OnboardingScreen(
                    onDone = {
                        nav.navigate("home") {
                            popUpTo("onboarding") { inclusive = true }
                        }
                    },
                    api = api,
                    ownerId = ownerId,
                )
            }
            composable("notifications") {
                NotificationsScreen(
                    api = api,
                    ownerId = ownerId,
                )
            }
            composable("admin") {
                AdminScreen(
                    api = api,
                    ownerId = ownerId,
                    ownerEmail = ownerEmail,
                )
            }
        }
    }

    if (showMore) {
        ModalBottomSheet(
            onDismissRequest = { showMore = false },
            sheetState = sheetState,
        ) {
            Column(modifier = Modifier.padding(bottom = 32.dp)) {
                FeatureCatalog.moreDests().forEach { dest ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                showMore = false
                                nav.navigate(dest.route) {
                                    popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                            .padding(horizontal = 24.dp, vertical = 12.dp),
                    ) {
                        Icon(
                            dest.icon,
                            contentDescription = dest.title,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(24.dp),
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text(dest.title, style = MaterialTheme.typography.titleMedium)
                            Text(
                                dest.description,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
    }
}
