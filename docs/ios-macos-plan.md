# iOS + macOS Plan — petdocs

Issue #36 (input to #34 monorepo; IPA hosting per #42).
Status: **M0 scaffold landed in this PR** — verified with `swift test` (26/26)
and `xcodebuild build` for the iOS Simulator (see §9 for toolchain versions).

---

## 1. Summary

petdocs gets a native iOS SwiftUI app (magic-link sign-in, read-only pet
access) and, later, a macOS story via Catalyst. The app is designed
contract-first against the **mobile auth HTTP contract** owned by the
android agent — iOS never speaks Convex directly.

Everything here was pattern-studied from the adventurers-portal iOS app
(`adventurers-portal/ios/Adventurers/`), which already solved the same
problems for the portal: passwordless sign-in (commit `bb4bf78`), iPhone
submit-crash resilience + os_log/Sentry diagnostics (`Auth.swift` /
`AuthTrace`), personal-team signing constraints + custom-scheme handoff
(`d1c207d`), deep-link parity, and real e2e UI tests with a
prod-safety-reviewed reset hook (`LoginUITests.swift`). petdocs also had an
earlier scaffold (`ios-app/` from commit `b7b8157`, direct-Convex
`ConvexAPI.swift`); it is **superseded** by `apps/ios/PetDocs/` and its
absorption/removal is a documented milestone (§7).

## 2. Auth contract (owned by the android agent)

iOS implements exactly this surface and nothing else:

| Method | Path                | Body / Auth                     | Response assumption            |
| ------ | ------------------- | ------------------------------- | ------------------------------ |
| POST   | `/api/auth/request` | `{ email }`                     | `{ ok, error? }`               |
| POST   | `/api/auth/verify`  | `{ email, token }`              | `{ ok, token, user, error? }`  |
| GET    | `/api/me`           | `Authorization: Bearer <token>` | `{ user }` / `401`             |

Assumptions to reconcile when the android agent lands the server side
(single point of truth will be the contract file in `packages/shared`,
§7):

- `verify` returns the **session bearer token** + a `user` object
  (`{ id, email, name? }`). If the android agent names fields differently
  (e.g. `ownerId`, `sessionToken`), only `APIClient.decodeVerify` /
  `decodeUser` change — the decoders already accept the `ownerId` alias.
- Sign-in token is opaque; it is sent verbatim and never normalized.
- Magic link is **one tap** (link, not an 8-char code) — matches petdocs
  web/Android UX, unlike the portal's `XXXX-XXXX` code. If the android
  agent adds code-fallback later, the portal's `magicCodePattern`
  normalize/shape-gate helpers port over unchanged.

## 3. Architecture

```
apps/ios/PetDocs/
├── Package.swift            SwiftPM — PetDocsKit (core, host-testable)
├── Sources/PetDocsKit/
│   ├── Models.swift         User/Pet + outcome structs + TransportCopy
│   ├── APIClient.swift      URLSession REST client (§3.1)
│   ├── SessionStore.swift   Keychain-backed session (§3.2)
│   └── AppLink.swift        Pure deep-link parser (§3.3)
├── App/                     SwiftUI app target (XcodeGen)
│   ├── PetDocsApp.swift     @main — URL routing, -e2eResetSession hook
│   ├── AuthController.swift request/verify orchestration
│   ├── RootView.swift       SignIn→CheckEmail flow + token listener
│   └── PetsView.swift       Read-only pets + detail skeletons (M2)
├── Tests/PetDocsKitTests/   XCTest unit tests (26)
├── UITests/                 XCUITest smoke
└── project.yml              XcodeGen → PetDocs.xcodeproj (committed)
```

### 3.1 Networking — URLSession client

Ported from the portal's `ConvexClient` transport rules, adapted to REST:

- **One shared `URLSession`**: no cache, no cookies, HTTP/2 + keepalive,
  30 s request / 60 s resource timeout, 4 connections per host.
- **Non-throwing call surface**: every method resolves to an outcome struct
  (`RequestLinkOutcome` / `VerifyOutcome` / `MeOutcome`) carrying
  user-facing copy. No raw `URLError` text ever reaches a screen.
- **Friendly transport copy**: offline trio
  (`notConnectedToInternet`, `networkConnectionLost`, `timedOut`) →
  "You're offline…", everything else → "Couldn't reach the server…".
- **Testable parsing**: static `decode*` functions are pure and tolerant
  (`ok` as Bool/NSNumber/"true"; missing fields fail closed with copy, not
  crashes).
- `GET /api/me` 401 → `MeOutcome.unauthorized` → sign-out (stale session);
  5xx → retry-able error, session kept.

### 3.2 Session storage — Keychain (upgrade over the portal)

The portal persists sessions in UserDefaults; petdocs upgrades to
**Keychain** (`SessionStoring` protocol):

- `KeychainSessionStore`: one generic-password item
  (service `dev.seridian.petdocs.session`), JSON-encoded `Session`
  (bearer token + user), `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`
  — the token never rides backups; a new device just signs in again.
- Corrupted payload → treated as signed out + evicted (never crashes).
- `InMemorySessionStore` for unit tests/previews; `SessionStore`
  (`@MainActor ObservableObject`) is the single published source of truth,
  mirroring the portal's `AuthState`.

### 3.3 Deep links — `petdocs://signin` + universal links

One pure parser (`AppLink.parse`) for both transports, exactly the portal
pattern (single code path, notification-routed):

- **Now (personal team)**: `petdocs://signin?token=…` via
  `CFBundleURLTypes` — no entitlement needed (`d1c207d` lesson).
- **M3 (paid team)**: universal links
  `https://petdocs.seridian.dev/signin?token=…` require
  - Associated Domains entitlement `applinks:petdocs.seridian.dev`,
  - AASA at `https://petdocs.seridian.dev/.well-known/apple-app-site-association`
    (Netlify: file in `public/.well-known/`, `content-type:
    application/json`, no redirect),
  - `"apps": []` + the appID `TEAMID.dev.seridian.petdocs.ios`.
- The parser is host-agnostic for https + `/signin` (any AASA-served host
  is OS-trusted), case-insensitive, rejects garbage to `nil`.
- Routing: `PetDocsApp.onOpenURL` / `onContinueUserActivity` →
  `AppLink.parse` → `.signinTokenReceived` notification →
  `SignInFlowView` verifies → session persisted → root switches to Pets.
  Pending email from the SignIn step is kept so a link landing on a fresh
  install still has the address.

### 3.4 APNs — later (M5+)

Push (share/reminder notifications) is intentionally out of M1: token
registration, an upload endpoint, and backend send paths are contract work
the android agent owns first. iOS-side plan: UNUserNotificationCenter,
APNs environment headers already travel with TestFlight builds; store the
device token via the same mobile-contract pattern (`POST /api/push/register`,
to be defined). Nothing in the M1–M4 scaffold blocks it.

## 4. Screens

| Screen         | File(s)                  | Notes |
| -------------- | ------------------------ | ----- |
| **SignIn**     | `RootView.swift`         | Email + "Send magic link"; disabled until non-empty email; `onSubmit` keyboard path (portal lesson); identifiers `signin.emailField`, `signin.sendButton`, `signin.errorLabel`. |
| **CheckEmail** | `RootView.swift`         | "Check your inbox" copy with the address; Back / Resend; shows "Opening your link…" spinner while a deep-link token verifies. |
| **Pets**       | `PetsView.swift`         | `NavigationStack` + list; sign-out row; M2 fills with `APIClient` pet queries (read-only). |
| **PetDetail**  | `PetsView.swift`         | Read-only: species/breed/sex/color, birth (epoch-ms → formatted date), weight, microchip. No editing until a write contract exists. |

Accessibility identifiers are the UI-test contract (portal convention:
dotted, stable, never user-visible).

## 5. Test plan

**Unit (XCTest, `swift test` on any host — already green, 26 tests)**

- `APIClientTests` via `URLProtocol` stub: method/path/body assertions for
  all three endpoints, Bearer header, trimmed email, verbatim token,
  server-error copy pass-through, offline/other transport mapping,
  401→`unauthorized`, malformed-payload fail-closed, tolerant `ok` decode.
- `SessionStoreTests`: start signed out, sign-in publishes + persists,
  restore on relaunch, sign-out clears both layers, overwrite, failed-load
  self-healing.
- `AppLinkTests`: custom scheme, case-insensitivity, universal links
  (prod + alternate host + trailing slash), wrong scheme/host/path/missing
  token rejection.

**UI (XCUITest, simulator)**

- `SignInSmokeUITests`: launch → sign-in screen, send disabled without
  email. Launch arg `-e2eResetSession` clears the Keychain session
  (PetDocsApp init) so runs always start signed out — the portal's
  `-e2eResetDefaults` pattern.
- M1 adds real e2e sign-in tests mirroring `LoginUITests` (return-key +
  button submit paths) **only after** the prod-safety review of the auth
  endpoints (which requests send email / mutate state) — the portal wrote
  that analysis into the test file header and petdocs will too.
- Keychain-path unit coverage runs on simulator/device (SecItem is not
  exercisable under plain `swift test` on the host); the storage boundary
  keeps everything else host-testable.

**CI**: the existing `.github/workflows/ios.yml` (unsigned simulator build
on `macos-15`, path-filtered) repoints to `apps/ios/**` and gains a
`swift test` step for PetDocsKit (M1).

## 6. Build / sign / distribute path (to IPA)

**Local dev (today, personal/free team)** — signing is automatic;
simulator builds are unsigned (`CODE_SIGNING_ALLOWED=NO`), device runs use
the personal team with the custom scheme only (no Associated Domains, no
push — same constraint log as portal `d1c207d`).

**TestFlight (M4, requires paid Apple Developer Program, $99/yr)**

```bash
xcodegen generate
xcodebuild -project PetDocs.xcodeproj -scheme PetDocs \
  -configuration Release -destination 'generic/platform=iOS' archive \
  -archivePath build/PetDocs.xcarchive
xcodebuild -exportArchive -archivePath build/PetDocs.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath build/ipa   # → PetDocs.ipa
xcrun altool --upload-app -f build/ipa/PetDocs.ipa -t ios \
  --apiKey KEY_ID --apiIssuer ISSUER                              # → TestFlight
```

App Store Connect metadata is trivial (no IAP, no entitlements beyond
push-later). `ITSAppUsesNonExemptEncryption=false` is already set.

**IPA artifact into the Convex builds API (#42) — direct install, later
(M5)** with hard caveats:

- **Ad-hoc**: ≤ 100 devices/yr (testers) — each tester's UDID must be
  registered into the provisioning profile; profiles expire (renewal =
  rebuild + re-upload). Fine for a handful of friendly testers only.
- **Enterprise (in-house) distribution**: Apple restricts this program to
  organizations distributing to *their own employees* (D-U-N-S, vetting);
  using it for public beta distribution violates the agreement. Do not
  plan on it.
- Therefore the **sanctioned public channel is TestFlight**; the
  builds-API direct-install IPA is a convenience for registered devices
  only. The Settings → Mobile apps panel (#42) should link TestFlight for
  iOS and label direct install accordingly.
- Pipeline: tag → CI builds the archive → exports ad-hoc IPA (registered
  UDIDs) or a TestFlight upload → stores the artifact in Convex storage
  with version metadata, mirroring the portal APK pipeline.

## 7. Monorepo placement (input to #34)

- This PR lands `apps/ios/PetDocs/` — exactly the `apps/ios` slot from
  #34. The legacy root `ios-app/` (b7b8157, direct-Convex) is **frozen**
  by this PR and removed in M1 once `apps/ios` reaches auth parity with it
  (its CI workflow repoints to `apps/ios/**` in the same change so nothing
  dangles).
- **Shared Swift package**: `PetDocsKit` inside `apps/ios/PetDocs/` is the
  seed of the future `packages/shared-swift` (or `packages/shared` Swift
  product). It is already contract-only (no Convex, no app UI); the macOS
  target consumes the same package. Cross-platform truth stays in
  `packages/shared` (the contract doc/JSON the android agent lands); iOS
  decodes tolerantly so contract additions are non-breaking.
- CI path filters update with the migration (no break in between — the
  legacy workflow keeps building `ios-app/` until M1 removes it).

## 8. Phased milestones

| Milestone | Scope | Exit criteria |
| --------- | ----- | ------------- |
| **M0** (this PR) | Scaffold: PetDocsKit + app + tests + plan | `swift test` 26/26, `xcodebuild` sim build green |
| **M1** | Auth contract live: point APIClient at the real endpoints (android agent), real e2e UI tests + prod-safety header, remove legacy `ios-app/`, CI repoint + `swift test` job | Sign-in works on device via custom scheme |
| **M2** | Read-only data: pets/docs/reminders read endpoints, Pets + PetDetail real content, avatar loading, Swift 6 language-mode migration | Pet list mirrors web dashboard |
| **M3** | Universal links: paid team, entitlement, AASA on petdocs.seridian.dev, scheme fallback kept | Link in email opens app directly on fresh install |
| **M4** | TestFlight: App Store Connect app, archive/export pipeline, testers group | External tester signs in via TestFlight build |
| **M5** | Builds API (#42): tag-driven CI artifact → Convex storage, Settings panel listing | Latest-IPA listing live (with §6 caveats) |
| **M6** | APNs + beyond: push registration, share reminders; macOS native shell planning | First push received on device |

## 9. macOS story (short)

**Catalyst first, native shell later.** Catalyst gives the read-only pet
companion on Apple silicon Macs for near-zero marginal cost: enable
`supportsMacCatalyst` on the PetDocs target (M6), ship via Mac TestFlight,
reuse PetDocsKit unchanged (URLSession/Keychain/decoders are
platform-neutral; the package already declares `macOS(.v14)` so the kit
itself builds on macOS today — verified by `swift test`).

**What breaks / needs attention under Catalyst:**

- **Deep links**: `petdocs://` must be registered separately for the Mac
  (same CFBundleURLTypes carry over, but default-browser handoff and
  "Open in app" web buttons need a Mac-specific check; universal links
  behave differently — the Mac opens Safari first unless the AASA and app
  install are aligned). The notification-routed verify flow keeps working
  once the URL arrives.
- **Share sheet**: `UIActivityViewController`-based share flows (pet
  passport sharing) diverge on Catalyst — prefer SwiftUI `ShareLink`
  (native on both), avoid UIKit share customization.
- Other known Catalyst friction to budget for: `UIApplication`-isms in
  later push-registration code (`#if targetEnvironment(macCatalyst)`
  guards), keyboard/menu-bar expectations, and window sizing
  (`UIScene` size restrictions).

**Native shell later** (post-M6): SwiftUI `App` lifecycle with
`MenuBarExtra`/`WindowGroup`, unifies with the same PetDocsKit; only the
app shell and share/print integrations differ. Decide after Catalyst usage
data exists.

---

## 10. Toolchain check (this machine)

- `xcodebuild -version` → **Xcode 26.6 (17F113)** — present ✅
- `swift --version` → Apple Swift **6.3.3** (swift-tools 5.9, v5 language mode) ✅
- `xcodegen` → present (`/opt/homebrew/bin/xcodegen`) ✅
- Verified in this PR: `swift test` 26/26; `xcodebuild build` +
  `build-for-testing` on iPhone 17 Pro simulator, `CODE_SIGNING_ALLOWED=NO`.

## 11. Risks / open questions

1. **Contract drift**: field names in §2 finalize with the android agent;
   decoders are tolerant but the contract file in `packages/shared` must
   land before M1 e2e tests.
2. **AASA hosting**: Netlify must serve
   `/.well-known/apple-app-site-association` as `application/json` with no
   redirect — verify when the paid team exists (M3).
3. **CI Xcode drift**: `macos-15` images rotate Xcode versions; the
   workflow already picks the latest installed Xcode (portal pattern).
4. **Swift 6 migration** (M2): strict concurrency will flag the
   notification-based routing; plan is `@MainActor` confinement + one
   `AsyncStream` for `.signinTokenReceived` if needed.
