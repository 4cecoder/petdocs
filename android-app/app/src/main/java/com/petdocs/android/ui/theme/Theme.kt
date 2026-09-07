package com.petdocs.android.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Petdocs brand palette.
 *
 * - Background cream #FFFBF5, primary teal #0D9488, accent amber #F59E0B,
 *   text ink #1C1917. Surface is white.
 * - Display font is the platform default (no downloadable fonts) so the app
 *   stays fully usable offline.
 */
object PetdocsColors {
    val Cream = Color(0xFFFFFBF5)
    val CreamDark = Color(0xFFF5EBDD)
    val Teal = Color(0xFF0D9488)
    val TealDark = Color(0xFF0B7C72)
    val TealContainer = Color(0xFFCCFBF1)
    val OnTealContainer = Color(0xFF134E4A)
    val Amber = Color(0xFFF59E0B)
    val AmberDark = Color(0xFFB45309)
    val AmberContainer = Color(0xFFFEF3C7)
    val OnAmberContainer = Color(0xFF78350F)
    val Ink = Color(0xFF1C1917)
    val InkSoft = Color(0xFF78716C)
    val White = Color(0xFFFFFFFF)
    val Danger = Color(0xFFDC2626)
    val Success = Color(0xFF16A34A)
}

private val PetdocsLightColors = lightColorScheme(
    primary = PetdocsColors.Teal,
    onPrimary = PetdocsColors.White,
    primaryContainer = PetdocsColors.TealContainer,
    onPrimaryContainer = PetdocsColors.OnTealContainer,
    secondary = PetdocsColors.Amber,
    onSecondary = PetdocsColors.Ink,
    secondaryContainer = PetdocsColors.AmberContainer,
    onSecondaryContainer = PetdocsColors.OnAmberContainer,
    tertiary = PetdocsColors.AmberDark,
    background = PetdocsColors.Cream,
    onBackground = PetdocsColors.Ink,
    surface = PetdocsColors.White,
    onSurface = PetdocsColors.Ink,
    surfaceVariant = PetdocsColors.CreamDark,
    onSurfaceVariant = PetdocsColors.InkSoft,
    outline = PetdocsColors.InkSoft,
    error = PetdocsColors.Danger,
    onError = PetdocsColors.White,
)

/** Default Material3 type scale — platform font only (offline-safe, no downloads). */
private val PetdocsTypography = Typography()

/** Rounded 16dp geometry used across cards, sheets, and dialogs. */
private val PetdocsShapes = Shapes(
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(16.dp),
)

/**
 * Petdocs Material3 theme (light). Imported by `MainActivity` as
 * `com.petdocs.android.ui.theme.PetdocsTheme`.
 */
@Composable
fun PetdocsTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = PetdocsLightColors,
        typography = PetdocsTypography,
        shapes = PetdocsShapes,
        content = content,
    )
}
