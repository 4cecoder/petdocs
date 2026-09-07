package com.petdocs.android

import android.app.Application
import android.os.Build
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.decode.GifDecoder
import coil.decode.ImageDecoderDecoder

/**
 * Application subclass for PetDocs.
 *
 * - Coil image loading is provided via [ImageLoaderFactory] (no manual init needed).
 * - No Firebase — push/sync is handled via Convex + WorkManager.
 */
class PetdocsApp : Application(), ImageLoaderFactory {
    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .components {
                if (Build.VERSION.SDK_INT >= 28) {
                    add(ImageDecoderDecoder.Factory())
                } else {
                    add(GifDecoder.Factory())
                }
            }
            .crossfade(true)
            .build()
    }

    override fun onCreate() {
        super.onCreate()
        // Coil is initialized lazily via ImageLoaderFactory above.
        // WorkManager init: schedule reminder/passport-sync workers here
        // (e.g. PeriodicWorkRequest for due reminders). No Firebase init.
    }
}
