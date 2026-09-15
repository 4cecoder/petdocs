# PetDocs iOS (scaffold)

SwiftUI app for petdocs. **This is the M0 scaffold for issue #36** — plan and
milestones live in [`docs/ios-macos-plan.md`](../../../docs/ios-macos-plan.md).

## Layout

```
Package.swift          SwiftPM package: PetDocsKit (core, testable via `swift test`)
Sources/PetDocsKit/
  Models.swift         User/Pet + non-throwing outcome types + transport copy
  APIClient.swift      REST client for the mobile auth HTTP contract
                       (POST /api/auth/request, POST /api/auth/verify, GET /api/me Bearer)
  SessionStore.swift   Keychain-backed session persistence (+ InMemory for tests)
  AppLink.swift        Pure parser: petdocs://signin?token=… and
                       https://petdocs.seridian.dev/signin?token=…
App/                   SwiftUI app target (XcodeGen)
  PetDocsApp.swift     @main, URL routing, -e2eResetSession test hook
  AuthController.swift request/verify orchestration (mirrors portal AuthState)
  RootView.swift       SignIn → CheckEmail flow + deep-link listener
  PetsView.swift       Read-only pet list/detail skeletons (M2)
project.yml            XcodeGen definition → PetDocs.xcodeproj
UITests/               XCUITest smoke (launch, identifiers)
Tests/PetDocsKitTests/ XCTest unit tests (client, session, links)
```

## Commands

```bash
# Core package (no simulator needed)
swift build && swift test

# Full app (requires Xcode)
xcodegen generate
xcodebuild -project PetDocs.xcodeproj -scheme PetDocs \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build CODE_SIGNING_ALLOWED=NO
```

Patterns are ported from `adventurers-portal ios/Adventurers` (Auth.swift,
LoginView.swift, AppLink) — non-throwing client with user-facing copy,
single pure deep-link parser, notification-routed token verification.
The session upgrade vs. the portal: Keychain instead of UserDefaults.

NOTE: the legacy root `ios-app/` scaffold (direct-Convex client from
b7b8157) stays untouched and is superseded by this directory — migration is
documented in the plan doc (§7).
