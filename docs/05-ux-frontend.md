# 05 — UX + Frontend IA

Mobile-first, non-technical owners. Warm/trustworthy — the opposite of enterprise density.

## Routes
Marketing `(marketing)` (not in URL):
- `/` — warm photo-first hero, trust badges, 3 steps → CTA
- `/how-it-works` — add pet → snap docs → share passport
- `/pricing` — Free / Plus / Family + FAQ

App:
- `/sign-in` — magic-link only, deep-link resume
- `/onboarding` — signup → add pet → first doc (skippable, resumable, <3min)
- `/dashboard` — home: pet cards + due-soon (≤3) + big Upload
- `/dashboard/pets` — grid + `+ Add pet`
- `/dashboard/pets/[petId]` — profile header + tabs (Timeline | Docs | Reminders) + Share
- `/dashboard/docs` — global filterable list (by pet / type / expiry)
- `/dashboard/reminders` — Overdue / This week / Later + FAB `+ Reminder`
- `/dashboard/share/[token]` — owner manages links (revoke)
- `/p/[shareToken]` — **public, no chrome**: photo, contact, vax table w/ status dots, Download PDF, expiry notice

`src/lib/routes.ts`: `ROUTES` const + `petHref(id)` + `passportHref(token)` + `hasRouteGroupLeak` test.
Never put `(marketing)` in hrefs.

## Screens (6)
1. **Dashboard home:** greeting + `+ Add pet` / `📷 Upload doc` (≥48px) + horizontal pet cards (photo, name, VaccineBadge) + Due-soon rows.
2. **Pet profile:** large photo, name/species/age, Edit, prominent ShareButton; tabs; empty states with illustration + `Add first doc` (never blank tables).
3. **Upload flow:** pick pet → camera (`accept="image/*" capture`) or files → preview + type picker (Vaccine/Lab/Rx) + date → toast + timeline insert. Offline-tolerant queue + "will sync".
4. **Reminders:** grouped list, 56px rows (icon, avatar, due, Reschedule), checkbox Done; presets (booster, flea, checkup).
5. **Public passport:** no nav, no edits, no other pets leaked.
6. **Onboarding:** sign-in (30s) → add pet (45s, photo optional) → first doc (60s, type presets Vaccine) → Done (passport preview + Share + Reminder nudges).

## Components
- `PetCard({pet, dueCount, onOpen})` — rounded-2xl, photo top
- `DocUploader({petId, onComplete})` — wraps `generateUploadUrl` pattern, camera-first + progress
- `DocList({docs, filter, onSelect})` — thumbnail, type chip, expiry
- `VaccineBadge({status: valid|expiring|expired, label})` — dot + text (never color-only)
- `ReminderRow({reminder, pet, onDone, onSnooze})`
- `ShareButton({petId})` — create token, copy `/p/[token]`, expiry select
- `PetTimeline({events})` — vertical rail, icons per kind

## Design language
- Cream `#FFFBF5`, teal-600 `#0D9488` primary, amber-500 `#F59E0B` accent, ink `#1C1917`.
- Tailwind v4 `@theme`: `--color-brand-*`, rounded display font (e.g. Nunito), `rounded-2xl` cards, soft shadows, plain language ("Vet visit" not "Encounter").
- MVP: light-only + ThemeToggle stub; dark later.
- Base font 17px+, `min-h-[48px]` targets, always-visible labels, `aria-live` upload status, AA contrast, focus rings, keyboard-safe dialogs.

## Reuse vs skip (portal)
REUSE: dashboard guard shell, typed routes + leak test, sidebar + `activeFor`, providers, CSP/headers, upload pattern, MobileNav/ThemeToggle, ui primitives.
SKIP: telephony/IVR, arena/AI, kanban/issues, finance, deployments/devops, reseller, mail/campaigns, WebGL hero, number-key shortcuts, RoleGate complexity (owner-only MVP).
