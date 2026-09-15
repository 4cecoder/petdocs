# Research Teardown: Petlia (`petlia.lovable.app` / `petlia.app`)

- **Target Product:** Petlia (also referred to informally as Petlita)
- **Primary URLs:** [https://petlia.lovable.app](https://petlia.lovable.app) (Lovable deployment), [https://petlia.app](https://petlia.app) (custom canonical domain)
- **Category:** Digital Pet Health Passport & Medical Records Organizer
- **Status:** Pre-launch waitlist prototype (~1,240 waitlist entries recorded); active Lovable preview
- **Related Notes:** [petlia.md](petlia.md) (live in-app authenticated audit), [product-direction.md](product-direction.md) (owner strategy notes)

---

## 1. Executive Summary & Value Proposition

Petlia positions itself as **"The Health Passport for the Modern Pet Parent"**. Its marketing centers on eliminating scattered paper files, email threads, and fragmented vet portals:

> *"Keep vaccinations, medications, vet visits, and care instructions organized in one secure place. Share your pet's health profile with sitters, boarders, or vets in seconds."*

Key marketing headlines and hooks:
- *"Your pet's health records, ready when it matters most."*
- *"From a pile of paperwork to instant answers."*
- Emergency-first emotional CTA: *"The next emergency won't wait. Neither should your pet's health records."*
- Early adopter hook: *"First 50 pet parents get Petlia free for life."*
- Social proof: *"Join 1,240 pet parents already on the waitlist"* (signals pre-launch validation phase rather than broad commercial production).
- Multi-pet focus: Dogs, cats, and rabbits.

---

## 2. Technical Stack Teardown

Inspection of the client bundle (`index-CcokmSrR.js`, DOM elements, and network endpoints) reveals the underlying Lovable scaffold:

| Component | Petlia Implementation | PetDocs Equivalent / Advantage |
|---|---|---|
| **Platform Builder** | [Lovable.dev](https://lovable.dev) (`lovable.app`) | Custom-engineered architecture on Next.js 16 App Router |
| **Frontend Framework** | React (Vite SPA bundler) | React 19 + Next.js App Router + Server Components |
| **UI Components** | Radix UI primitives (`@radix-ui/*`) + Lucide icons | Tailored accessible component library + PetArt tokens |
| **Styling** | Tailwind CSS + Inter font (`petlia-theme` light/dark) | Tailwind CSS v4 + strict token system |
| **Mobile Navigation** | `MobileBottomNav` (web-only responsive bar) | Full **Native Android Companion** (`android-app/`) with Jetpack Compose |
| **Backend & Database** | Supabase (`zjzohtdooavdvcrfggsi.supabase.co`) | **ConvexDB** (all-TypeScript, reactive queries, ACID transactions) |
| **File Storage** | Supabase Storage (unstructured file buckets) | Convex File Storage + structured metadata vault |
| **Authentication** | Supabase Auth via Google OAuth (`oauth.lovable.app`) | **Passwordless Magic Links** via Resend from `no-reply@seridian.dev` |
| **AI Assistant** | **"Pawla"** (`PetAssistant`) | Planned server-side vision parsers ([docs/11-ai-ocr.md](../docs/11-ai-ocr.md)) |
| **Calendar Integration** | `ics-utils` (client-side `.ics` generator) | Resend hourly email crons + mobile notification workers |
| **Analytics & Telemetry** | Microsoft Clarity (`wm7ccsfdw7`) + Flock Analytics | Privacy-first operational logs + Convex audit trail |

---

## 3. Product Surface & In-App Reality Check

An authenticated session audit of the live application (logged in as an active user with 1 pet) revealed several critical realities behind the marketing claims:

1. **Auth Limitations:** Authentication is strictly Google OAuth routed through `oauth.lovable.app`. There is no direct email sign-in or magic-link flow for users who prefer privacy or lack Google accounts.
2. **Records Vault Maturity:** The records screen is currently a **raw file uploader** ("Upload record", "0 files", "No records yet"). There are no structured categorizations for vaccination vs. lab vs. prescription, no vaccine expiration dates, and no clinician attribution.
3. **Reminders Maturity:** The reminders section displays a static empty state ("vaccinations, medications, or appointments are due"). The actual notification delivery mechanics are unproven in production.
4. **Broken Links & Polish Gaps:** The `/profile` link in the main navigation routes to a 404 in production.
5. **Lack of Vet/Clinic Surface:** Petlia has no clinic portal, no vet role, no API ingestion, and no shareable public passport links with expiration or revocation.

---

## 4. Head-to-Head Comparison: PetDocs vs. Petlia

| Dimension | PetDocs | Petlia (`petlia.lovable.app` / `petlia.app`) |
|---|---|---|
| **Production Deployment** | **Live on [https://petdocs.seridian.dev](https://petdocs.seridian.dev)** | Pre-launch waitlist at `petlia.app` / `petlia.lovable.app` |
| **Transactional Email** | Verified domain `seridian.dev` (`PetDocs <no-reply@seridian.dev>`) | Standard third-party auth emails |
| **Authentication** | Passwordless magic links (works for any inbox, no password) | Google OAuth only via Lovable callback |
| **Vault Architecture** | Strongly-typed categories: `vaccine_record`, `lab_result`, `prescription`, `insurance`, `microchip`, `travel_certificate` | Uncategorized raw PDF/image file attachments |
| **Public Sharing** | Cryptographically hashed `/p/[shareToken]` with expiry & revoking | None (no sharing links or QR codes implemented) |
| **Vet / Enterprise Strategy**| Dedicated staff RBAC (`convex/staff.ts`), shared team mailboxes (`17-company-email.md`), planned clinic inbound API | Consumer-only; no clinical or institutional surface |
| **Mobile Experience** | Native Android app (`android-app/`) with background sync | Mobile web browser shell only |
| **Data Integrity** | Transactional mutations, tamper-evident hash links | Client-side Supabase calls |

---

## 5. Strategic Opportunities & Takeaways for PetDocs

1. **Borrow the Emotional & Emergency Framing:**
   - Petlia's landing copy (*"Your pet's health records, ready when it matters most"* and *"The next emergency won't wait"*) creates immediate urgency. PetDocs' marketing can emphasize how our `/p/[shareToken]` public passport is specifically engineered for sudden vet emergency admissions and kennel drop-offs.
2. **Implement `.ics` Calendar Export:**
   - Incorporating Petlia's `.ics` utility will let PetDocs owners download vaccine booster dates directly into Apple Calendar or Google Calendar alongside our automated Resend email reminders.
3. **Capitalize on the Two-Sided Market (Owners + Clinics):**
   - As outlined in [product-direction.md](product-direction.md), while Petlia remains a consumer-facing file locker, PetDocs' true moat lies in the two-sided platform: allowing partner veterinarians to verify records, enter signed entries, and push records via an inbound API.
4. **Leverage Native Android Parity:**
   - Mobile web fails in spotty clinic reception areas. PetDocs' native Kotlin Compose companion app provides guaranteed offline access to vaccine certificates and pet passports.
