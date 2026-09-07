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
import com.petdocs.android.ui.screens.DocsScreen
import com.petdocs.android.ui.screens.HomeScreen
import com.petdocs.android.ui.screens.LoginScreen
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
    HubId.More -> route in setOf("reminders", "share", "scanner", "settings")
}

private fun isBottomBarRoute(route: String): Boolean = when {
    route == "login" -> false
    route.startsWith("passport/") -> false
    route == "passport/{token}" -> false
    route.isEmpty() -> false
    else -> true
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PetdocsNav() {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route.orEmpty()
    var showMore by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()

    // TODO(session): check persisted session (SessionStore/DataStore) here.
    // Start at "login" when there is no session, else "home".
    val startDestination = "login"

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
                )
            }
            composable("home") {
                HomeScreen(
                    onPet = { petId -> nav.navigate("petDetail/$petId") },
                    onDocs = { nav.navigate("docs") },
                    onReminders = { nav.navigate("reminders") },
                )
            }
            composable("pets") {
                PetsScreen(
                    onPet = { petId -> nav.navigate("petDetail/$petId") },
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
                )
            }
            composable("docs") {
                DocsScreen()
            }
            composable("reminders") {
                RemindersScreen()
            }
            composable("share") {
                ShareScreen()
            }
            composable("scanner") {
                ScannerScreen(
                    onDone = { nav.popBackStack() },
                )
            }
            composable(
                route = "passport/{token}",
                arguments = listOf(navArgument("token") { type = NavType.StringType }),
            ) { entry ->
                val token = entry.arguments?.getString("token").orEmpty()
                PassportScreen(token = token)
            }
            composable("settings") {
                SettingsScreen()
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
