# petdocs Android app

Native Kotlin + Jetpack Compose client for petdocs. Shares the same Convex
backend as the web dashboard (`convex/`).

## Prerequisites

- JDK 17 (`java -version` → 17.x)
- Android SDK with `ANDROID_HOME` set and `platforms;android-35` +
  `build-tools;35.0.0` installed
- The Convex deployment URL for `BuildConfig.CONVEX_URL`
  (see `.env.local` → `NEXT_PUBLIC_CONVEX_URL` in the repo root)

## Build

```sh
cd android-app
./gradlew assembleDebug
```

Point at a Convex deployment (defaults to
`https://YOUR-DEPLOYMENT.convex.cloud` when unset):

```sh
./gradlew assembleDebug -PconvexUrl=https://YOUR-DEPLOYMENT.convex.cloud
```

## No Firebase (MVP)

This app has **no Firebase / google-services plugin and no FCM**.
Reminder notifications use local WorkManager polling against Convex —
see `docs/06-roadmap.md` for the post-MVP push story.

## Feature parity

What the Android client must cover (screens ↔ web routes ↔ Convex
functions) is tracked in `docs/07-feature-parity.md` — the single source
of truth. Keep it in sync when adding screens.
