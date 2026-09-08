# petdocs iOS app

Native SwiftUI client for petdocs. Shares the same Convex backend as the
web dashboard (`convex/`) and mirrors the Android client (`android-app/`).

## Prerequisites

- Xcode 16+ with the iOS 17 SDK
- A simulator such as iPhone 16 (Xcode ships one)
- The Convex deployment URL (repo root `.env.local` →
  `NEXT_PUBLIC_CONVEX_URL`)

## Open and run

```sh
open ios-app/PetDocs.xcodeproj
```

Point at a Convex deployment. Either set a per-device override in the app
(Settings screen, stored in the `petdocs` UserDefaults suite), or pass it
for the run via the scheme environment. Then pick an iPhone 16 simulator
and press Run.

## Backend contract

Same as Android: `POST {convexUrl}/api/query|mutation` with
`{ path, args, format: "json" }`, unwrapping the `{ value }` envelope.
See `PetDocs/ConvexAPI.swift`. No third-party dependencies.

## Parity

The screen map lives in `docs/20-android-parity.md`. iOS mirrors the
Android destination list one to one: Home, Pets, Pet detail, Docs,
Scanner, Reminders, Share, Passport, Login, Onboarding, Notifications,
Admin, Settings. All views live in `ios-app/PetDocs/Views/`.
