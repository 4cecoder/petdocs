# 21 — Feature Roadmap: Pet Operating System (Polar.sh, Telnyx, Family, & Modular Tabs)

## Executive Summary

PetDocs is evolving from a document locker into a comprehensive **Operating System for Your Pet's Life**. Based on competitor teardowns (Petlia) and user testing, PetDocs unifies medical records, preventive care schedules, calendar sync, SMS alerts, and family co-parenting around one singular, delightful experience: **The Complete Pet Passport & Vault**.

---

## 1. Monetization: Polar.sh Freemium Architecture

### Policy
- **100% Free for Everyone for the First 3 Months**: Zero paywalls, zero friction during initial growth and testing.
- **Freemium Tiers Post-Month 3**:
  - **Free Tier (Free Forever)**: 1 Pet, up to 10 stored documents, email reminders, public shareable passport link, basic care checklist.
  - **PetDocs Plus ($4.99/mo or $39/year via Polar.sh)**: Unlimited pets, unlimited document vault with OCR & deterministic lab extraction, Telnyx SMS alerts, family co-parenting roles, priority calendar sync, and exportable vet packet PDF.

### Polar.sh Technical Integration Plan
- Webhook receiver at Convex HTTP endpoint: `POST /api/polar-webhook`.
- Customer billing portal integration via Polar Customer Portal links.
- Database schema expansion in `convex/schema.ts`:
  ```ts
  subscriptions: defineTable({
    ownerId: v.id("owners"),
    polarCustomerId: v.string(),
    polarSubscriptionId: v.optional(v.string()),
    status: v.union(v.literal("trial"), v.literal("active"), v.literal("canceled"), v.literal("past_due")),
    trialEndsAt: v.number(), // 90 days from signup
    currentPeriodEnd: v.optional(v.number()),
  }).index("by_owner", ["ownerId"])
  ```

---

## 2. Communication Subsystem: Telnyx SMS & Reminders

### Use Cases
1. **Urgent Vaccine & Medication Reminders**: 24h before due date, send SMS via Telnyx:
   *"PetDocs: Max is due for his Rabies booster tomorrow at Animal Care Clinic. Reply 1 to mark completed, 2 to snooze 48h."*
2. **Passport Share Alerts**: Real-time SMS notification when a pet sitter or boarding facility opens the pet's shared passport link.
3. **Emergency Sitter Broadcast**: In emergencies, one-click SMS to designated secondary contacts.

### Architecture
- Convex scheduled cron job runs hourly tick (`convex/reminders.ts`).
- Reads `reminders` table where `dueAt <= now + 24h` and `status == "scheduled"`.
- Action `telnyx:sendSms` sends payload via Telnyx Messaging API v2 (`POST https://api.telnyx.com/v2/messages`).
- Webhook at `/api/telnyx-inbound` processes 2-way replies to mark reminders complete or snoozed.

---

## 3. Pet Operating System: Unified Subtabs & Navigation

Under each Pet Profile (`/dashboard/pets/[petId]`), the system provides 8 cohesive tabs:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🐕 Max · French Bulldog · 3 yrs · Male                                 │
│ [Share Passport] [Upload Record] [Log Visit]                           │
├────────────────────────────────────────────────────────────────────────┤
│ [Overview] [Vaccines] [Meds] [Visits] [Vault] [Calendar] [Family] [Log]│
└────────────────────────────────────────────────────────────────────────┘
```

1. **Overview**:
   - **Total Profile Health Score** (e.g. 70% complete progress bar).
   - **Status Summary Cards**: Upcoming Appointments, Vaccine Expirations, Active Refills.
   - **Breed-Tailored Recommended Care**: Annual exam, dental cleaning, heartworm check, flea/tick, breed screenings (e.g. IVDD / Brachycephalic airway for French Bulldogs).
2. **Vaccines**:
   - Status filters: Due, Administered, Overdue, Waived.
   - 1-click photo upload linking certificate to vaccination row.
3. **Medications**:
   - Active, Paused, Completed. Dosage, daily frequency, prescribing clinic.
4. **Vet Visits**:
   - Timeline of visits, clinic names, diagnosis, weight tracker graph over time.
5. **Vault Documents**:
   - Filterable categories: Vaccine Record, Lab Result, Prescription, Microchip, Insurance, Travel Certificate, Photo, Other.
   - Full drag-and-drop uploader with client validation (15MB cap, JPEG/PNG/PDF/WebP).
6. **Calendar & Reminders**:
   - Unified agenda of upcoming healthcare events.
   - **One-Click .ICS Export** ("Add to Apple Calendar" / "Add to Google Calendar").
7. **Pet Family & Co-Parenting**:
   - Invite partners, family members, or dog sitters with scoped permissions:
     - **Owner / Co-Owner**: Full edit and medical management.
     - **Caretaker / Sitter**: View-only passport, feeding/med schedules, emergency clinic contacts.
     - **Vet Staff**: Clinic direct record upload.
8. **Passport & Share**:
   - Scoped shareable links (`passport`, `vaccines_only`, `full_vault`) with custom expiration and view-counter revocations.

---

## 4. Calendar Subsystem (.ICS Generator)

### Client-Side .ICS Export
- Generates RFC 5545 standard `.ics` calendar files directly in the browser.
- Generates recurring events for monthly flea/tick and annual booster shots.
- Direct URI links for webcal / Google Calendar quick addition (`https://calendar.google.com/calendar/render?action=TEMPLATE...`).

---

## 5. Multistep Onboarding & Wizard Flows

1. **Step 1: Pet Basics** (Name, Species, Breed selector, Sex, Neutered status, Birthdate).
2. **Step 2: Care Baseline** (Automatic population of recommended preventive care based on species and age).
3. **Step 3: Document Snap** (Camera capture or PDF upload of existing records with instant OCR categorization).
4. **Step 4: Pack Complete** (Dashboard redirect with calculated Health Score and active reminder agenda).

---

## 6. GitHub Milestones, Issues, & PR Workflow

### Milestone 1: Core Vault & Instant Auth Hardening (Current - v0.2.0)
- [x] **PR #1**: Convex Production Deployment (`hallowed-falcon-806.convex.cloud`) with verified `seridian.dev` domain.
- [x] **PR #2**: Dynamic origin allowlisting & direct sign-in fallback (zero auth blocking).
- [x] **PR #3**: Mobile Bottom Navigation Bar & Responsive App Shell.
- [x] **PR #4**: Reactive Dashboard Cards & Pet Health Score.

### Milestone 2: Care Checklist & Calendar Subsystem (v0.3.0)
- [ ] **Issue #10**: Breed-specific preventive care checklist generator.
- [ ] **Issue #11**: RFC 5545 `.ics` download & Google Calendar template URL generator.
- [ ] **Issue #12**: Multi-step pet onboarding wizard (`/dashboard/pets/new`).

### Milestone 3: Pet Family & Telnyx SMS Reminders (v0.4.0)
- [ ] **Issue #20**: Family sharing table & invitation token generation.
- [ ] **Issue #21**: Telnyx Messaging API action & 2-way SMS reminder reply handler.
- [ ] **Issue #22**: Role-based access control for Sitters and Co-Owners.

### Milestone 4: Polar.sh Freemium Billing (v0.5.0)
- [ ] **Issue #30**: Polar.sh webhook endpoint in Convex HTTP router.
- [ ] **Issue #31**: 90-day trial status tracker & upgrade banner.
- [ ] **Issue #32**: Polar customer portal checkout redirect.
