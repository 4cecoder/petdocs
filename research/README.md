# PetDocs Research & Competitive Intelligence

This directory contains competitive teardowns, product benchmarks, authenticated session observations, and strategic product direction notes for **petdocs**.

## Directory Index

| Document | Topic | Description | Status |
|---|---|---|---|
| [petlita-lovable.md](petlita-lovable.md) | **Petlia Teardown (`petlia.lovable.app` / `petlia.app`)** | Deep-dive product teardown, technical stack analysis (Lovable + Vite + Supabase + Pawla AI), head-to-head feature matrix, and architectural comparison with PetDocs. | Complete |
| [petlia.md](petlia.md) | **Petlia Live In-App Session Notes** | Live authenticated user session audit (pre-launch waitlist, raw file upload limitations, Google-only auth, broken profile nav). | Complete |
| [product-direction.md](product-direction.md) | **Product Direction & Strategic Roadmap** | Owner notes from 2026-09-15: Two-sided clinic platform, structured signed documents, enterprise inbound API, and relationship-led pilots. | Active |
| [screenshots/](screenshots/) | **Competitor UI Screenshots & Extracts** | In-app screen captures (dashboard, records, reminders, settings, pet profile) and scraped DOM text from live competitor audits. | Archive |

## Strategic Objectives for PetDocs

1. **Market Positioning & Value Proposition:**
   - Position PetDocs as the permanent, structured digital pet vault and passport that owners and veterinarians trust.
   - Contrast our structured data model against raw file dumps (the current model of early prototypes like Petlia).

2. **Frictionless Onboarding & Verification:**
   - Passwordless magic link onboarding sent from **`PetDocs <no-reply@seridian.dev>`** on our verified domain `seridian.dev`.
   - Zero requirement for third-party Google/Apple tracking accounts.

3. **Two-Sided Clinic & Owner Integration:**
   - Dedicated clinic and veterinary staff access built on our Convex RBAC (`convex/staff.ts`).
   - Enterprise inbound API for automated post-visit document delivery directly into pet vaults.

4. **Multi-Platform Parity:**
   - Live production web application at [https://petdocs.seridian.dev](https://petdocs.seridian.dev).
   - Companion native Android app ([android-app/](../android-app/)) with offline capabilities and local reminder alarms.
