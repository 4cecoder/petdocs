package com.petdocs.android.ui.nav

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.CircleNotifications
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Pets
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material.icons.outlined.RocketLaunch
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Share
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Bottom-bar hubs. Mirrors the web tab bar in `src/lib/dashboardNav.ts`
 * (Home / Pets / Docs + More sheet for the remaining 3 web items).
 */
enum class HubId(val route: String, val label: String, val icon: ImageVector) {
    Home("home", "Home", Icons.Outlined.Home),
    Pets("pets", "Pets", Icons.Outlined.Pets),
    Docs("docs", "Docs", Icons.Outlined.Description),
    More("more", "More", Icons.Outlined.MoreHoriz),
}

data class FeatureDest(
    val route: String,
    val title: String,
    val description: String,
    val icon: ImageVector,
)

/**
 * Feature catalog. Order mirrors web `DASHBOARD_NAV`
 * (Pets / Docs / Reminders / Share / Settings) plus native extras
 * (scanner, public passport viewer).
 *
 * Icons are restricted to well-known `Icons.Outlined` entries present in
 * material-icons-core + material-icons-extended: Home, Pets, Description,
 * Notifications, CircleNotifications, Share, Settings, PhotoCamera, Info,
 * RocketLaunch, AdminPanelSettings. No exotic icons.
 */
object FeatureCatalog {
    val pets = FeatureDest(
        route = "pets",
        title = "Pets",
        description = "Every pet profile",
        icon = Icons.Outlined.Pets,
    )
    val docs = FeatureDest(
        route = "docs",
        title = "Docs",
        description = "Vaccination records and documents",
        icon = Icons.Outlined.Description,
    )
    val reminders = FeatureDest(
        route = "reminders",
        title = "Reminders",
        description = "Due dates and care alerts",
        icon = Icons.Outlined.Notifications,
    )
    val share = FeatureDest(
        route = "share",
        title = "Share",
        description = "Shareable passport links",
        icon = Icons.Outlined.Share,
    )
    val scanner = FeatureDest(
        route = "scanner",
        title = "Scanner",
        description = "Scan documents with the camera",
        icon = Icons.Outlined.PhotoCamera,
    )
    val settings = FeatureDest(
        route = "settings",
        title = "Settings",
        description = "Account and sign out",
        icon = Icons.Outlined.Settings,
    )
    val passport = FeatureDest(
        route = "passport/{token}",
        title = "Passport",
        description = "Public pet passport viewer",
        icon = Icons.Outlined.Info,
    )
    val onboarding = FeatureDest(
        route = "onboarding",
        title = "Get started",
        description = "Add your first pet in under 3 minutes",
        icon = Icons.Outlined.RocketLaunch,
    )
    val notifications = FeatureDest(
        route = "notifications",
        title = "Notifications",
        description = "Care alerts and due-soon inbox",
        icon = Icons.Outlined.CircleNotifications,
    )
    val admin = FeatureDest(
        route = "admin",
        title = "Admin",
        description = "View-only staff hub (destructive ops stay on web)",
        icon = Icons.Outlined.AdminPanelSettings,
    )

    fun all(): List<FeatureDest> = listOf(
        pets, docs, reminders, share, scanner, settings, passport,
        onboarding, notifications, admin,
    )

    fun find(route: String): FeatureDest? {
        // Resolve parameterized passport deep links ("passport/abc123") to the passport dest.
        if (route.startsWith("passport/")) return passport
        return all().find { it.route == route }
    }

    /** Entries listed in the More sheet — passport excluded (needs a share token). */
    fun moreDests(): List<FeatureDest> = listOf(
        reminders, share, scanner, notifications, onboarding, admin, settings,
    )
}
