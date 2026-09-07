# 07 — Feature parity: web ↔ Android ↔ backend

Single source of truth for what exists where. Web + Convex are scaffolded;
`android-app/` is planned (screens + files below are targets, not built yet).
Status values: `scaffolded` = route/function/file exists in this repo ·
`planned` = specced, not yet built · `post-MVP` = v0.2/v1.0 per `docs/06-roadmap.md`.

## Market stats box

- US pet spend **$158B (2024)**, **~$165B projected 2026** (APPA); **94M** pet households.
- Vet care **$41B**; services **$14B+**.
- Growth slowing (**~4% thru 2030**, Morgan Stanley) → spending shifts to
  essentials/healthcare — **records + proof + reminders win**.

## Model recap (for Agnela)

- **Free** — 2 pets, unlimited docs, vax link, core reminders.
- **Plus $6.99/mo or $69/yr** — unlimited pets, apartment/travel packets, family sharing.
- **Family $9.99/mo**.
- **B2B2C** — Clinic Starter **$99/mo**, Groomer/Boarder **$49/mo**,
  Landlord **$0 + $9/verified packet**.
- **Add-ons** — $9 apartment PDF / $19 vet retrieval / $4.99 travel.
- **Wedge** — free utility + B2B2C distribution + repeat (reminders).
  Pure B2C records alone never sustained paid subs (Pawprint→free).
- **Competitor proof** — PetDesk/VitusVet clinics pay $99–399/mo; Rover takes ~28%;
  insurance $30–60/mo; Chewy Autoship 83% of $12.6B (own the repeat).

## End-to-end flow table

| Flow | Pain killed | Web (route + files) | Android (screen + files, `android-app/` planned) | Backend (convex fns) | MVP status |
|------|-------------|---------------------|--------------------------------------------------|----------------------|------------|
| Onboarding <3min | switching vets = records limbo (cold start) | `/onboarding` — `src/app/onboarding/page.tsx` | `OnboardingScreen` — `android-app/app/src/main/java/.../onboarding/OnboardingScreen.kt` (planned) | `magicLink.verifyMagicLink` (`convex/magicLink.ts`), `pets.create` (`convex/pets.ts`) | scaffolded |
| Add pet | switching vets = records limbo | `/dashboard/pets`, `/dashboard/pets/[petId]` — `src/app/dashboard/pets/page.tsx`, `src/app/dashboard/pets/[petId]/page.tsx` | `PetListScreen` + `PetDetailScreen` — `android-app/.../pets/` (planned) | `pets.listByOwner/get/create/update/archive` (`convex/pets.ts`) | scaffolded |
| Snap doc | ER midnight with zero history; boarding check-in scramble | `/dashboard/docs` — `src/app/dashboard/docs/page.tsx` (+ `DocUploader`/`DocList` per §05/§06) | `ScannerScreen` (CameraX) — `android-app/.../docs/ScannerScreen.kt` (planned) | `documents.generateUploadUrl/create/listByPet/getUrl/rename` (`convex/documents.ts`, `convex/files.ts` pattern) | scaffolded |
| Vax / meds + reminders | forgotten flea/tick + boosters (46% dog / 51% cat missed a dose) | `/dashboard/reminders`, pet profile — `src/app/dashboard/reminders/page.tsx`, `src/app/dashboard/pets/[petId]/page.tsx` | `VaxMedScreen` + `ReminderListScreen` — `android-app/.../reminders/` (planned) | `vaccinations.listByPet/dueSoon/create/markAdministered` (`convex/vaccinations.ts`); `medications.listByPet/create/setStatus` (`convex/medications.ts`); `reminders.listByOwner/listByPet/create/setStatus` (`convex/reminders.ts`) | scaffolded |
| Vet visit log | surprise vet bills $300–$10k (no history to compare); switching vets = limbo | `/dashboard/pets/[petId]` timeline — `src/app/dashboard/pets/[petId]/page.tsx` | `VisitLogScreen` — `android-app/.../visits/` (planned) | `vetVisits.listByPet/create/attachDocument` (`convex/vetVisits.ts`) | scaffolded |
| ER midnight passport | ER midnight with zero history (fax 24–48h, useless at 2am) | `/p/[shareToken]` (public, QR, expiry) — `src/app/p/[shareToken]/page.tsx` | `PassportScreen` (offline-cached link + QR) — `android-app/.../share/` (planned) | `shareLinks.createToken/resolve/recordView` (`convex/shareLinks.ts`) | scaffolded |
| Boarding / groomer check-in | boarding/groomer scramble (rabies cert +24h wait) | `/p/[shareToken]` + `/dashboard/share` — `src/app/p/[shareToken]/page.tsx`, `src/app/dashboard/share/page.tsx` | `CheckInScreen` (QR present) — `android-app/.../share/` (planned) | `shareLinks.createToken/resolve/recordView` (`convex/shareLinks.ts`); `documents.getUrl` (`convex/documents.ts`) | scaffolded |
| Apartment packet | rental blocked by pet fees $25–75/mo + breed/weight bans (72% renters struggle) | `/dashboard/share` (packet assembly, Plus-gated) — `src/app/dashboard/share/page.tsx` | `PacketScreen` (apartment) — `android-app/.../packets/` (planned) | `shareLinks.createToken/listByPet` (`convex/shareLinks.ts`); `pets.get`, `vaccinations.listByPet`, `documents.listByPet` | planned |
| Travel packet | flight/USDA paperwork $400–600 | `/dashboard/share` (packet assembly, Plus-gated) — `src/app/dashboard/share/page.tsx` | `PacketScreen` (travel) — `android-app/.../packets/` (planned) | `shareLinks.createToken` (`convex/shareLinks.ts`); `pets.get`, `vaccinations.listByPet`, `documents.listByPet` | planned |
| Insurance packet | insurance denials for missing history | `/dashboard/share` (packet assembly) — `src/app/dashboard/share/page.tsx` | `PacketScreen` (insurance) — `android-app/.../packets/` (planned) | `shareLinks.createToken` (`convex/shareLinks.ts`); `vetVisits.listByPet`, `vaccinations.listByPet`, `documents.listByPet` | planned |
| Sitter auth | sitter can't authorize care | `/dashboard/share` (scoped share, Plus family sharing) — `src/app/dashboard/share/page.tsx` | `SitterAuthScreen` (scoped share + instructions) — `android-app/.../share/` (planned) | `shareLinks.createToken/revoke/recordView` (`convex/shareLinks.ts`) | planned |
| Lost-pet kit | lost pet + unregistered chip (40.9%) | `/p/[shareToken]` public profile + QR collar tag (v0.2) — `src/app/p/[shareToken]/page.tsx` | `LostPetScreen` (QR collar tag, one-tap call) — `android-app/.../lost/` (planned) | `shareLinks.resolve/recordView` (`convex/shareLinks.ts`); `pets.get` (`convex/pets.ts`) | post-MVP |
| Manage / revoke shares | ER/boarding/sitter shares left open | `/dashboard/share` — `src/app/dashboard/share/page.tsx` | `ManageSharesScreen` — `android-app/.../share/` (planned) | `shareLinks.listByPet/revoke` (`convex/shareLinks.ts`) | scaffolded |
| Settings / trash | accidental deletes; account hygiene | `/dashboard/settings`, `/dashboard/docs` (trash/restore) — `src/app/dashboard/settings/page.tsx`, `src/app/dashboard/docs/page.tsx` | `SettingsScreen` — `android-app/.../settings/` (planned) | `documents.trash/restore/empty` (`convex/documents.ts`); `owners` row via `magicLink.verifyMagicLink` (`convex/schema.ts`, `convex/magicLink.ts`) | scaffolded |

Notes:

- Dog parks / hotels need no dedicated feature — same passport link (`/p/[shareToken]`) covers them.
- Packets (apartment / travel / insurance) all assemble from the same primitives
  (`pets.get` + `vaccinations.listByPet` + `documents.listByPet` + `shareLinks.createToken`);
  the Plus gate + PDF layout is what is still `planned`.
- Sitter auth is `planned` because scoped roles / multi-owner are explicitly out of
  MVP (see root `README.md`); generic share link covers the interim.
- Lost-pet kit is `post-MVP` (QR collar tag is v0.2 per `docs/06-roadmap.md`;
  lost-pet mode explicitly out of MVP).

## Pain → killer mapping

| # | Pain (severity×frequency) | Killer in PetDocs | Where |
|---|---------------------------|-------------------|-------|
| 1 | Surprise vet bills $300–$10k | Visit log + full history before saying yes | Vet visit log flow; `convex/vetVisits.ts` |
| 2 | Rental blocked: fees $25–75/mo + breed/weight bans (72% renters struggle, Michelson 2025) | Apartment packet: vax proof + records, verified link | Apartment packet flow (Plus) |
| 3 | Forgotten flea/tick + boosters (46% dog / 51% cat missed a dose, Merck 2025) | Vax/meds records + due-date reminders | Vax/meds + reminders flow; `convex/reminders.ts`, `convex/vaccinations.ts` |
| 4 | ER midnight with zero history (fax 24–48h, useless at 2am) | Passport link/QR, <30s proof | ER passport flow; `/p/[shareToken]` |
| 5 | Switching vets = records limbo | Owned vault + onboarding <3min, portable history | Onboarding, add pet, snap doc flows |
| 6 | Boarding/groomer check-in scramble (rabies cert +24h wait) | Check-in link with rabies cert, no wait | Boarding/groomer flow; `shareLinks.resolve` |
| 7 | Insurance denials for missing history | Insurance packet: complete visit + vax history | Insurance packet flow |
| 8 | Flight/USDA paperwork $400–600 | Travel packet assembly | Travel packet flow (Plus) |
| 9 | Sitter can't authorize care | Scoped sitter share + instructions | Sitter auth flow (planned roles) |
| 10 | Lost pet + unregistered chip (40.9%) | Lost-pet kit: public profile + QR collar tag | Lost-pet kit flow (post-MVP) |

## Steal-list recap (from `adventurers/`)

Patterns reused, never domain code. Status: `stolen` = in this repo ·
`planned` = scheduled for `android-app/` or v0.2/v1.0.

| Pattern | Source | Status |
|---------|--------|--------|
| Kotlin Convex client | `ConvexApi.kt` (adventurers Android) | planned |
| CameraX scanner screen | `ScannerScreen.kt` (adventurers Android) | planned |
| Storage round-trip (`generateUploadUrl → POST → create`) | `files.ts` (adventurers portal) | stolen |
| Vault UI (upload + file manager) | `FileUpload` + `FileManager` (adventurers portal) | stolen |
| Passwordless auth + guards | `magicLink` (vaylo clean version) + `LoginScreen` + `DashboardGuard` (adventurers portal) | stolen |
| Share-token contracts + sign route | contracts share-token + `/sign/[token]` (adventurers portal) | stolen |
| Push + polling | `notifications` + FCM + `MessagePollWorker` (adventurers) | planned |
| Stripe webhook billing | `billing.ts` (vaylo, adventurers) | planned |
| Cron scheduling (lease/backoff) | `crons.ts` + scheduling (adventurers portal) | planned |
| Shell + routes + UI kit + CSP + CI | `DashboardLayout` + `routes` + `ui-kit` + CSP + `pr.yml` (adventurers portal) | stolen |
