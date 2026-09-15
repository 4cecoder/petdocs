plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "dev.seridian.petdocs"
    compileSdk = 35

    defaultConfig {
        applicationId = "dev.seridian.petdocs"
        minSdk = 26
        targetSdk = 35
        // CI overrides these so build metadata matches the published artifact
        // (see .github/workflows/android.yml).
        versionCode = (project.findProperty("appVersionCode") as String?)?.toIntOrNull() ?: 1
        versionName = project.findProperty("appVersionName") as String? ?: "0.1.0"

        // Same Convex deployment the web dashboard uses (override via
        // -PconvexUrl=... for a dev deployment).
        val convexUrl = project.findProperty("convexUrl") as String?
            ?: "https://hallowed-falcon-806.convex.cloud"
        buildConfigField("String", "CONVEX_URL", "\"$convexUrl\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    testOptions {
        unitTests {
            // Robolectric needs the merged resources for Compose UI tests, and
            // the ViewModels touch android.jar stubs on the JVM.
            isIncludeAndroidResources = true
            isReturnDefaultValues = true
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")

    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")

    // Encrypted session storage (session token never in plaintext prefs).
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Network: Ktor + OkHttp engine, kotlinx-serialization for the DTOs that
    // mirror convex/http.ts responses.
    implementation("io.ktor:ktor-client-okhttp:3.0.3")
    implementation("io.ktor:ktor-client-content-negotiation:3.0.3")
    implementation("io.ktor:ktor-serialization-kotlinx-json:3.0.3")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Unit tests: JUnit + Robolectric (JVM) + MockWebServer for the API layer,
    // Compose UI test for SignIn — all runnable without an emulator.
    testImplementation("junit:junit:4.13.2")
    testImplementation(kotlin("test")) // kotlin.test assertions
    testImplementation("org.robolectric:robolectric:4.14.1")
    testImplementation("androidx.test:core-ktx:1.6.1")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    testImplementation(composeBom)
    testImplementation("androidx.compose.ui:ui-test-junit4")

    // Declares androidx.activity.ComponentActivity so createComposeRule()
    // can launch it under Robolectric — its manifest must merge into the
    // debug variant, hence debugImplementation (not testImplementation).
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
