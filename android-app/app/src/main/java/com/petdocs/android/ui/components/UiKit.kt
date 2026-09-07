package com.petdocs.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.petdocs.android.data.VaccineStatus
import com.petdocs.android.ui.theme.PetdocsColors

private data class BadgeStyle(val dot: Color, val label: String)

private fun badgeStyleFor(status: VaccineStatus): BadgeStyle = when (status) {
    // Web copy ("Vaccines valid" / "Expiring soon" / "Expired") maps onto the
    // Android status enum (due / administered / overdue / waived).
    VaccineStatus.ADMINISTERED -> BadgeStyle(PetdocsColors.Success, "Vaccines valid")
    VaccineStatus.DUE -> BadgeStyle(PetdocsColors.Amber, "Due soon")
    VaccineStatus.OVERDUE -> BadgeStyle(PetdocsColors.Danger, "Overdue")
    VaccineStatus.WAIVED -> BadgeStyle(PetdocsColors.InkSoft, "Waived")
}

/**
 * Status dot + text (never color-only), mirroring web `VaccineBadge`.
 */
@Composable
fun VaccineBadge(
    status: VaccineStatus,
    modifier: Modifier = Modifier,
    label: String? = null,
) {
    val style = badgeStyleFor(status)
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(999.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(style.dot),
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = label ?: style.label,
                style = MaterialTheme.typography.labelLarge,
            )
        }
    }
}

/**
 * Pet row card. Mirrors web `PetCard`: avatar block, name, species/breed line,
 * vaccine badge, and "N due soon" / "All clear" line. 48dp+ touch target.
 */
@Composable
fun PetCardRow(
    name: String,
    species: String,
    breed: String?,
    dueCount: Int = 0,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {},
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 48.dp)
            .clickable(role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center,
            ) {
                Text(text = "🐾", style = MaterialTheme.typography.headlineSmall)
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = name,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = buildString {
                        append(species.replaceFirstChar { it.uppercase() })
                        if (!breed.isNullOrBlank()) append(" · $breed")
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                VaccineBadge(
                    status = if (dueCount > 0) VaccineStatus.DUE else VaccineStatus.ADMINISTERED,
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = if (dueCount > 0) "$dueCount due soon" else "All clear",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (dueCount > 0) {
                        MaterialTheme.colorScheme.secondary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                )
            }
        }
    }
}

/**
 * Document row. Mirrors web `DocList` rows: PDF/photo emoji, name, and
 * "category · date" subtitle. 48dp+ touch target.
 */
@Composable
fun DocRow(
    name: String,
    category: String,
    date: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {},
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 48.dp)
            .clickable(role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = if (name.lowercase().endsWith(".pdf")) "📕" else "🖼️",
                    style = MaterialTheme.typography.titleLarge,
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = name,
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = "${category.replace('_', ' ').replaceFirstChar { it.uppercase() }} · $date",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/**
 * Reminder row. Mirrors web `ReminderRow`: done checkbox, title, "pet · due"
 * line with overdue emphasis, and a 48dp Snooze action.
 */
@Composable
fun ReminderRow(
    title: String,
    pet: String,
    due: String,
    overdue: Boolean,
    modifier: Modifier = Modifier,
    onDone: () -> Unit = {},
    onSnooze: () -> Unit = {},
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 48.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(
                onClick = onDone,
                modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp),
            ) {
                Text(text = "☐", style = MaterialTheme.typography.titleLarge)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Row {
                    Text(
                        text = "$pet · ",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = due,
                        style = if (overdue) {
                            MaterialTheme.typography.bodySmall.copy(
                                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                            )
                        } else {
                            MaterialTheme.typography.bodySmall
                        },
                        color = if (overdue) {
                            MaterialTheme.colorScheme.error
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                }
            }
            TextButton(
                onClick = onSnooze,
                modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp),
            ) {
                Text(text = "Snooze")
            }
        }
    }
}

/** Section title row with an optional trailing action. */
@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 48.dp)
            .padding(horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(text = title, style = MaterialTheme.typography.titleLarge)
        if (actionLabel != null && onAction != null) {
            TextButton(
                onClick = onAction,
                modifier = Modifier.defaultMinSize(minHeight = 48.dp),
            ) {
                Text(text = actionLabel)
            }
        }
    }
}

/** Centered empty state with optional CTA, mirroring web empty hints. */
@Composable
fun EmptyState(
    emoji: String,
    title: String,
    body: String,
    modifier: Modifier = Modifier,
    ctaLabel: String? = null,
    onCta: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = emoji, style = MaterialTheme.typography.displaySmall)
        Spacer(modifier = Modifier.height(8.dp))
        Text(text = title, style = MaterialTheme.typography.titleMedium)
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = body,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (ctaLabel != null && onCta != null) {
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = onCta,
                modifier = Modifier.defaultMinSize(minHeight = 48.dp),
            ) {
                Text(text = ctaLabel)
            }
        }
    }
}
