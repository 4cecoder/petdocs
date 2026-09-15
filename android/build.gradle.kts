// PetDocs Android build (#24). Versions are pinned to the combination the
// repo has already shipped on CI (AGP 8.7.3 / Kotlin 2.1.0 / Gradle 8.9).
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.1.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.0" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.1.0" apply false
}
