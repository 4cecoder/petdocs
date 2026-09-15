package dev.seridian.petdocs.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Brand palette mirrors the web dashboard's warm cream + teal (#0D9488).
private val Brand = Color(0xFF0D9488)
private val BrandDark = Color(0xFF0F766E)
private val BrandContainer = Color(0xFFCCFBF1)
private val Cream = Color(0xFFFFFBF5)
private val Ink = Color(0xFF1C1917)
private val InkSoft = Color(0xFF57534E)
private val ErrorRed = Color(0xFFB91C1C)

private val LightColors = lightColorScheme(
    primary = Brand,
    onPrimary = Color.White,
    primaryContainer = BrandContainer,
    onPrimaryContainer = Color(0xFF042F2E),
    secondary = BrandDark,
    background = Cream,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    onSurfaceVariant = InkSoft,
    error = ErrorRed,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF2DD4BF),
    onPrimary = Color(0xFF04302E),
    primaryContainer = Color(0xFF115E59),
    onPrimaryContainer = BrandContainer,
    secondary = Color(0xFF5EEAD4),
    background = Color(0xFF12100E),
    onBackground = Color(0xFFE7E5E4),
    surface = Color(0xFF1C1917),
    onSurface = Color(0xFFE7E5E4),
    onSurfaceVariant = Color(0xFFA8A29E),
    error = Color(0xFFFCA5A5),
)

@Composable
fun PetdocsTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
