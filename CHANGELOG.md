# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

### Added

- MVP scaffold: Next.js 16 web shell plus Convex backend plus Kotlin Android plus docs 01 to 07 plus CI smoke
- Wiring: magic-link auth plus pets CRUD plus vault upload plus reminders plus share tokens plus live passport plus Android session gate
- Trust: ownership KYC claims plus deterministic AI plus export and delete plus audit plus docs 15
- Mail: Resend inbound webhook plus exact-match routing plus holding plus team inbox at dashboard admin mail plus docs 17
- Staff: staff table with owner manager support auditor roles plus invite role deactivate with last-owner guards plus Team access UI plus docs 16
- Superadmin: rank above owner for developers, grant guards, integrations surface with status plus test email, docs 18 runbook
- Notifications: passport view plus reminder sent plus claim filed plus inbound mail plus transfer events, bell plus page, 9 tests, demo seed inbox

## [0.7.0] - 2026-09-07

### Added

- Staff RBAC for Angela employees with invite role deactivate plus last-owner guards plus Team access UI plus docs 16
- Mail with mailAccounts Threads Messages plus Resend inbound webhook with Svix verify plus exact-match routing plus unmatched holding
- Team inbox at dashboard admin mail with triage plus docs 17 company email
- Mail regression suite with 9 tests covering routing plus holding plus threading

### Fixed

- ReviewClaim uses shared requireRole plus reactivate via invite upsert

## [0.6.0] - 2026-09-07

### Added

- Ownership KYC with claims chip auto-approve vet-record review plus transfer codes plus handoff moving vault and revoking links
- Deterministic AI with suggestCategory 10 rules plus VACCINE_SCHEDULES plus nextDueVaccine plus smart-fill suggest chip
- Compliance with exportData deleteAccount plus Your data settings plus rights section plus docs 15 trust
- Staff RBAC with staff table owner manager support auditor plus invite role deactivate with last-owner guards plus Team access UI plus docs 16
- Demo-day script plus deploy guide for Netlify Vercel plus Resend setup updates plus parity flow tests

### Fixed

- ReviewClaim now uses shared requireRole for consistent staff authorization

## [0.5.0] - 2026-09-07

### Added

- Parsers lib with parseCertText parseMedLabel parseMicrochip findDates regex-only confidence-gated plus 15 tests
- ExtractFields smart-fill in upload Details step with paste ML Kit text to editable fields with human confirm
- HelpWidget deterministic rule-based lander chat with 12 topics plus quick chips plus ROUTES links plus mailto fallback
- Docs 11 AI OCR catalog UC-1 to UC-10 with determinism ladder L0 to L4

## [0.4.0] - 2026-09-07

### Added

- Icons with lucide-react replacing decorative emoji in chrome while PetArt SVG stays as hand-drawn layer
- Stripe compliance with docs 09 checklist plus Terms Privacy Refunds pages plus footer legal row plus pricing fine print
- Resend hardened sender with branded magic-link plus reminder templates plus docs 10 setup
- Superadmin MVP with owners role plus adminAudit plus convex admin with requireRole plus dashboard admin stats owners kill-switch audit

### Changed

- Voice law with no em dashes in src eslint guarded plus tightened copy plus emoji max 1 per screen plus direction in docs 08

## [0.3.0] - 2026-09-07

### Added

- PetArt kit with 10 hand-drawn kawaii SVG scenes with zero deps
- Wizard kit with useSteps plus Stepper plus StepShell plus FlowNav plus WizardShell
- Error pages for 404 plus global-error plus dashboard error with copy preserved
- Multistep flows for onboarding pet doc done plus DocUploader plus add-pet plus share who expiry copy
- Empty-state art pass on all dashboard pages plus docs 08 design system
- Android PetMoodArt plus Stepper plus ArtEmptyState plus stepped share creator

## [0.2.0] - 2026-09-07

### Added

- Web magic-link sign-in verify plus pets CRUD plus real uploadDoc vault flow plus reminders groups with inline create
- Web share manager with real tokens plus live public passport via Convex HTTP without codegen imports
- Android nav session gate with api plus ownerId plumbed to all 9 screens plus SettingsScreen

### Changed

- Backend sendDue now emails via Resend before markSent plus vaccinations flipOverdue with daily cron
- Repo made public for free Actions minutes with secret audit clean

### Fixed

- Android validator parity with DocCategory OTHER fallback

## [0.1.0] - 2026-09-07

### Added

- MVP blueprints covering product plus architecture plus data plus UX plus roadmap
- Web shell with marketing plus dashboard pets docs reminders share settings plus onboarding plus sign-in plus public passport p shareToken
- Convex 8-table schema for pets documents vaccines meds visits reminders shareLinks plus magic-link auth plus seed plus hourly reminder cron
- Android gradle shell with Ktor Convex client plus nav plus 9 screens plus theme kit plus 22 unit tests
- Docs 01 to 07 covering pain points plus business model v2 plus steal list plus feature parity
- CI with pr plus android workflows plus smoke specs with lint typecheck unit build green

## Release process

- Every PR adds an Unreleased entry under Added Changed or Fixed.
- Release equals tag vX.Y.Z plus move that section to a dated version heading.
