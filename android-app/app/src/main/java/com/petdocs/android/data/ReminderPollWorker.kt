package com.petdocs.android.data

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.petdocs.android.BuildConfig
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.flow.first
import java.util.concurrent.TimeUnit

const val REMINDERS_NOTIFICATION_CHANNEL_ID = "petdocs_reminders"
private const val REMINDER_POLL_WORK_NAME = "petdocs-reminder-poll"

/**
 * No Firebase/FCM — plain 15-minute WorkManager poll (the shortest interval
 * Android allows for periodic work) against the same Convex deployment the web
 * app uses. Each run calls `vaccinations:dueSoon` for the signed-in owner and
 * posts a local notification for the most urgent due item.
 */
class ReminderPollWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val ctx = applicationContext
        val store = SessionStore(ctx)
        val ownerId = store.ownerId.first()?.ifBlank { null } ?: return Result.success()
        val override = store.convexUrlOverride.first()?.ifBlank { null }
        val convexUrl = override ?: BuildConfig.CONVEX_URL

        val http = HttpClient(OkHttp) {
            install(ContentNegotiation) { json(PetdocsJson) }
        }
        try {
            val api = PetdocsApi(convexUrl, http)
            val due = runCatching { api.dueSoon(ownerId) }.getOrDefault(emptyList())
            val next = due.sortedBy { it.dueAt ?: Long.MAX_VALUE }.firstOrNull()
                ?: return Result.success()
            ensureChannel(ctx)
            postReminderNotification(ctx, next)
        } catch (_: Exception) {
            // Best-effort poll — a transient failure just retries next interval.
        } finally {
            runCatching { http.close() }
        }
        return Result.success()
    }
}

private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(REMINDERS_NOTIFICATION_CHANNEL_ID) != null) return
    manager.createNotificationChannel(
        NotificationChannel(
            REMINDERS_NOTIFICATION_CHANNEL_ID,
            "Pet reminders",
            NotificationManager.IMPORTANCE_DEFAULT,
        ),
    )
}

private fun postReminderNotification(context: Context, vaccination: Vaccination) {
    val openIntent = context.packageManager
        .getLaunchIntentForPackage(context.packageName)
        ?.apply {
            flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
    val pendingIntent = openIntent?.let {
        PendingIntent.getActivity(
            context,
            vaccination.id.hashCode(),
            it,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
    val status = vaccineStatusFor(vaccination.dueAt, vaccination.status)
    val title = "Pet vaccine ${status.value}: ${vaccination.vaccineName}"
    val text = if (vaccination.dueAt != null) {
        "${vaccination.vaccineName} is ${status.value} — due ${java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.US).format(java.util.Date(vaccination.dueAt))}"
    } else {
        "${vaccination.vaccineName} is ${status.value}"
    }
    val builder = NotificationCompat.Builder(context, REMINDERS_NOTIFICATION_CHANNEL_ID)
        .setSmallIcon(context.applicationInfo.icon)
        .setContentTitle(title)
        .setContentText(text)
        .setStyle(NotificationCompat.BigTextStyle().bigText(text))
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
    if (pendingIntent != null) builder.setContentIntent(pendingIntent)
    val notification = builder.build()

    if (androidx.core.content.ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.POST_NOTIFICATIONS,
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
    ) {
        NotificationManagerCompat.from(context).notify(vaccination.id.hashCode(), notification)
    }
}

fun scheduleReminderPolling(context: Context) {
    val request = PeriodicWorkRequestBuilder<ReminderPollWorker>(15, TimeUnit.MINUTES).build()
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        REMINDER_POLL_WORK_NAME,
        ExistingPeriodicWorkPolicy.KEEP,
        request,
    )
}

fun cancelReminderPolling(context: Context) {
    WorkManager.getInstance(context).cancelUniqueWork(REMINDER_POLL_WORK_NAME)
}
