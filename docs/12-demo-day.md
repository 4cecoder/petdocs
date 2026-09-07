# 12 - Demo Day: Sell the MVP to Angela

Goal: greenlight pricing and wedge. Talk, click, ask. Keep it live, no slides.

Setup: run `seedDemo` with `{reset:true}`, login as `maya@demo.pet`. Second phone logged out for passport view.

## 1. The 5 minute script

| Time | Say (talk track) | Click | Route + seed |
|------|------------------|-------|--------------|
| 0:00 | "2am ER. Dog vomiting. Vet asks for history. You have nothing. Fax takes 24 to 48 hours. That is the product." | Open `/` then `/how-it-works` | Marketing, sets stakes |
| 0:30 | "Maya signs in with one magic link. No password. Adds Mochi in under 3 minutes." | `/onboarding` to `/dashboard/pets`, open Mochi profile | Maya Chen + Mochi, Shiba Inu, chip `985141012345678` |
| 1:30 | "Snap the rabies cert at the counter. It lands on the right pet with lot, date, provider." | `/dashboard/docs`, DocUploader snap, link to vax record | Mochi Rabies 2025-03-10, `/dashboard/pets/[petId]` timeline |
| 2:30 | "Boarder needs proof. No login for them. QR, expiry, revoke." | `/dashboard/share`, Create passport, scan QR on second phone | `/p/[shareToken]`, Mochi Groomer passport link, viewCount 0 |
| 3:30 | "DHPP booster due in 20 days. Reminder fires. Apartment packet prints with vax plus vet visit." | `/dashboard/reminders`, open Mochi DHPP booster, `/dashboard/share` print packet | Maple St Vet visit 2026-03-01, Apoquel 16mg daily, Sam/Pickle airline link as second example |
| 4:30 | "Clinics pay for this distribution. Owners get peace of mind. Ask: do we ship $69/yr hero?" | Open `/pricing`, show Free vs Plus vs B2B2C dashboard | Plus $69/yr, Clinic Starter/Pro per docs/02 |

Backup pets: Udon the cat (FVRCP done, shows multi pet), Pickle the Corgi (Bordetella plus pre flight check, shows travel angle).

## 2. Pain receipts (quote these)

1. 72% of renters struggle with pet fees, bans, paperwork. Packet unblocks the lease.
2. 46% of dog owners missed a flea, tick, or booster dose. Reminders are the retention hook.
3. ER vet history by fax takes 24 to 48h. Passport proves vax in under 30s.
4. US pet spend $158B in 2024, about $165B projected 2026. Records ride the health spend shift.
5. Clinics already pay PetDesk and VitusVet $99 to $399/mo. Our recall plus intake earns a cut.

## 3. Objection handling

| Objection | Answer | Proof |
|-----------|--------|-------|
| PetDesk does this | Clinic tool, not owner vault. No passport, no apartment packet, owner cannot take records when switching vets | Parity doc §07: owner vault plus `/p/[shareToken]` has no PetDesk equal |
| Google Drive is free | Drive has no reminders, no vax due dates, no verify view, no revoke with expiry | Live revoke in `/dashboard/share`, reminder list in `/dashboard/reminders` |
| Who pays | Free wedge for owners, clinics and boarders pay for distribution and recall | Free 1 pet plus 25 docs, Plus $69/yr hero, B2B2C per docs/02 |
| OCR liability | Human confirms everything. OCR only prefills, owner taps save, original image stays attached | Roadmap v0.2: `extractedText` plus search, never auto commit dates |
| Privacy | Scoped links with label, expiry, max views, instant revoke. Chip and address hidden by default | `shareLinks.createToken`, `revoke`, `recordView` in `convex/shareLinks.ts` |
| Why you win | B2C2B loop. Every passport share is an ad. Clinics buy the network owners already use | KPI: 25% create a link, 40% opened by third party, per docs/01 |

## 4. The ask (decisions needed)

Top 5 from docs/02, answer in order:

1. Who pays first: owner sub or clinic subsidize? Target $/yr per owner?
2. Pricing sign off: Plus $69/yr hero, Family $9.99/mo, overage $2/mo per extra pet?
3. Privacy defaults: which fields are NEVER public (address, chip, phone)?
4. Wedge you own: vets, groomers and boarders, insurers, or SEO and travel?
5. Moat check: is share plus reminders plus passport a 10x over PetDesk and Drive?

Validation experiments (#7, #8, #9): activation (1 pet plus 3 docs in 7d), sharing (1 passport opened by third party), reminder open rate. Status: seeded demo ready, real user runs start after Angela signs wedge and privacy defaults.

Pricing sign off needed today: $69/yr hero anchors against $30 to $60/mo insurance. Without it, Plus gate in `/dashboard/share` stays stubbed.

## 5. Leave behind checklist

- [ ] Seed loaded: Maya, Mochi, Udon plus Sam, Pickle verified in `/dashboard/pets`
- [ ] Passport links open logged out, QR scans on phone, revoke tested
- [ ] Printed apartment packet: Mochi rabies plus DHPP plus Maple St Vet visit
- [ ] Pricing one pager: Free, Plus $69/yr, Family, B2B2C Starter and Pro
- [ ] Room for notes below, Angela initials on top 5 answers

Notes:

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________
