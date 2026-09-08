# 20 — Android parity: web route → Android destination

Audit of every web route against the Android app (`android-app/`).
Status values: `exists` = screen + nav route + backend binding live ·
`new` = added in this pass · `partial` = screen exists with a documented gap ·
`skipped` = intentionally not on mobile (with reason).

Web source of truth for the feature list: `src/lib/dashboardNav.ts`
(`DASHBOARD_NAV`: Home / Pets / Docs / Reminders / Share / Settings),
`src/lib/routes.ts` (`ROUTES`), and `docs/07-feature-parity.md`.

## Parity table

| Web route | Web source | Android destination | Status |
|-----------|------------|---------------------|--------|
| `/dashboard` | `src/app/dashboard/page.tsx` | `home` → `HomeScreen` | exists |
| `/dashboard/pets` | `src/app/dashboard/pets/page.tsx` | `pets` → `PetsScreen` | exists |
| `/dashboard/pets/[petId]` | `src/app/dashboard/pets/[petId]/page.tsx` | `petDetail/{petId}` → `PetDetailScreen` | exists |
| `/dashboard/docs` | `src/app/dashboard/docs/page.tsx` | `docs` → `DocsScreen` (+ `scanner?petId=` → `ScannerScreen`, native CameraX extra) | exists |
| `/dashboard/reminders` | `src/app/dashboard/reminders/page.tsx` | `reminders` → `RemindersScreen` | exists |
| `/dashboard/share` | `src/app/dashboard/share/page.tsx` | `share` → `ShareScreen` | exists |
| `/dashboard/settings` | `src/app/dashboard/settings/page.tsx` | `settings` → `SettingsScreen` | partial — sign-out is a no-op in nav (no `onSignedOut` passed); trash restore/empty stays web-only (`documents:trash/restore/empty` has no mobile binding) |
| `/dashboard/notifications` | `src/app/dashboard/notifications/page.tsx` | `notifications` → `NotificationsScreen` | new — reminders-as-notifications (honest scope, §1) |
| `/dashboard/admin` (+ `/admin/mail`, `/admin/integrations`) | `src/app/dashboard/admin/page.tsx` (+ `mail/`, `integrations/`) | `admin` → `AdminScreen` | new — view-only staff hub (honest scope, §2) |
| `/onboarding` | `src/app/onboarding/page.tsx` | `onboarding` → `OnboardingScreen` | new — 3-step wizard (§3) |
| `/sign-in` | `src/app/sign-in/page.tsx` | `login` → `LoginScreen` | partial — scaffold session only; `TODO(magic-link verify)` + `TODO(deep-link)` still open |
| `/p/[shareToken]` | `src/app/p/[shareToken]/page.tsx` | `passport/{token}` → `PassportScreen` | exists (no-auth projection, never leaks vault) |
| `/legal/terms`, `/legal/privacy`, `/legal/refunds` | `src/app/(marketing)/legal/*` | — (link out to site) | skipped (§4) |
| Pricing / Stripe billing | `(marketing)/pricing`, `convex/*billing*` | — (web-first) | skipped (§4) |

Bottom-bar mapping stays: **Home / Pets / Docs + More sheet**.
The More sheet now lists (in order): Reminders, Share, Scanner,
Notifications, Get started (onboarding), Admin, Settings. Passport stays out
(needs a share token). Start destination is unchanged:
`login → (authed ? home : login)`.

## 1. NotificationsScreen — honest scope

Web reads the server-side `notifications` table (`notifications:list` /
`markRead` / `markAllRead`: passport views, reminder_sent, claims, mail,
transfers). `PetdocsApi` has **no** `notifications:*` bindings, so the mobile
screen surfaces what the app CAN see and act on:

- **Due soon** — `vaccinations:dueSoon` (sorted, with `vaccineStatusFor`
  display status). Read-only: no mobile `markAdministered` binding exists, so
  each card points at the pet profile instead of mutating.
- **Reminders** — `reminders:listByOwner(upcomingOnly)` via the shared
  `ReminderRow` kit, with Done (`setStatus: done`) and Snooze (dismissed —
  same documented stub as `RemindersScreen`/`AppViewModel`, backend has no
  snooze mutation).
- Empty state mirrors web copy ("All caught up. Passport views, reminders,
  claims, mail, and transfers will show up here.") via `ArtEmptyState(CLOCK)`.
- A footer card states the split: server-side alerts live in the web feed;
  background delivery comes from `ReminderPollWorker` (15-min WorkManager,
  no FCM in MVP).
- Deliberately **no** "Mark all read": mass-mutating reminders to fake
  read-state would destroy user data. True mark-read arrives with a
  `notifications:*` mobile binding.

## 2. AdminScreen — honest scope

Web gates on `admin:getMe` + `staff:myStaffRole` and calls `admin:stats` /
`recentOwners` / `listLinks` / `auditLog` plus destructive `admin:setRole` /
`revokeAnyLink` / `lockPet`. `PetdocsApi` has **no** `admin:*` / `staff:*`
bindings, so the role cannot be verified on-device and global data is
unreachable. The mobile hub is therefore:

- **Display-only gate**: blank session email → same "Internal only" gate as
  web (`ArtEmptyState(SIREN)`). With an email, the screen states plainly that
  gating is display-only until `staff:myStaffRole` is bound.
- **Owner-scoped stats** from live queries: pets (`pets:listByOwner`), docs
  (sum of `documents:listByPet`), active links (sum of
  `shareLinks:listByPet` filtered `isActive`), reminders
  (`reminders:listByOwner` upcoming). Global totals stay unavailable — labeled
  as such, not faked.
- **Web-first ops card** with reasons: roles/team access (server-side RBAC +
  audit, never grant from a device), revoke-any-link / pet lock (destructive
  + audit-logged), audit log / team inbox / integrations (browser-only,
  secrets involved) — with their web paths
  (`/dashboard/admin`, `/dashboard/admin/mail`,
  `/dashboard/admin/integrations`) for the deep-link TODO.

## 3. OnboardingScreen — web copy mirror

Mirrors `src/app/onboarding/page.tsx` step for step (`Your pet` / `First doc`
/ `All set` via the shared `Stepper`, moods HAPPY / CAMERA / ROCKET):

1. **Add your first pet** ("Takes less than 3 minutes.") — name field with
   live `validatePetName` gating (same validator as `Models.kt`/web),
   species dropdown mirroring web `PET_SPECIES`, "Photo comes later" note.
   Continue calls `pets:create` when signed in, advances locally otherwise
   (same TODO shape as web).
2. **Snap your first doc** ("A rabies certificate is perfect.") — Upload
   (stub → advance, like web's TODO) + Skip for now + "Skippable. Pick up
   where you left off." + Back.
3. **You're set!** ("`{name}` has a vault…") — "Go to dashboard" → `onDone`
   ("Add a reminder later from the dashboard.").

Entry: More sheet → "Get started" today. `LoginScreen`'s `onSignedIn`
signature is frozen, so fresh-account `login → onboarding` first-run routing
is a TODO at the call site (noted in `PetdocsNav`). The wizard hides the
bottom bar like `login`/`passport`.

## 4. Intentionally skipped on mobile

- **Legal pages** (`/legal/terms`, `/legal/privacy`, `/legal/refunds`) —
  no native screens. Link out to the site instead: legal copy must stay
  single-sourced with the web, and duplicating it risks divergence.
- **Stripe / billing** — web-first. Payment sheets, webhook secrets, and
  price-table copy live in the browser; mobile gets entitlement checks only
  (future: Plus gate on packets/share, same as web).
- **Admin destructive ops** (roles, revoke-any-link, pet lock, audit writes,
  mail/integrations secrets) — web-first per §2. Devices hold no staff
  credentials and cannot verify `staff:*` roles; audit-logged destructive
  actions stay behind the server-gated web admin.

## 5. New routes (this pass)

Nav (`ui/nav/PetdocsNav.kt`), all existing routes/signatures untouched:

- `onboarding` → `OnboardingScreen(onDone → home, api, ownerId)` —
  bottom bar hidden; `More.selected` includes it.
- `notifications` → `NotificationsScreen(api, ownerId)` — bottom bar shown,
  `More` hub selected.
- `admin` → `AdminScreen(api, ownerId, ownerEmail)` — bottom bar shown,
  `More` hub selected.

Catalog (`ui/nav/FeatureCatalog.kt`): new `onboarding` (RocketLaunch),
`notifications` (CircleNotifications), `admin` (AdminPanelSettings) dests;
`all()` extended; `moreDests()` = reminders, share, scanner, notifications,
onboarding, admin, settings.

## 6. Remaining gaps (not this pass)

- `LoginScreen`: real `requestMagicLink` + app-link verify (TODOs in file).
- `SettingsScreen`: wire `onSignedOut` (clear `SessionStore` + cancel poll +
  nav to login); trash restore/empty binding.
- `AdminScreen`/`NotificationsScreen`: add `staff:myStaffRole`,
  `notifications:list/markRead/markAllRead`, `admin:*` read bindings to
  `PetdocsApi` when the backend surface is approved for mobile; then replace
  the honest-scope stubs and wire Custom-Tab deep links to the web admin.
- First-run: route fresh accounts `login → onboarding` once the verify flow
  knows "new owner" (needs `LoginScreen` signature change — deferred
  deliberately).
