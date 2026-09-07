# 01 — Product Brief

## Problem
Pet records live in shoeboxes, email threads, and 3 different vet portals.
Owners scramble for rabies certs at boarding, groomers, travel, or ER visits.

## Value prop
**Own your pet's docs.** One vault + shareable pet passport: vaccines (rabies, DHPP/FVRCP,
Bordetella, FeLV, lepto), microchip, spay/neuter, labs, insurance, travel health certs —
upload once, share via link/QR.

## Personas
- **Pet owner (primary)** — prove vaccination in <30s; never miss a booster; hand complete history to a new vet/sitter.
- **Vet clinic staff** — intake without re-typing; push visit summary / vax cert into owner vault (post-MVP).
- **Groomer / boarder / daycare** — verify rabies/Bordetella + contact/vet info, no account needed.
- **Insurer** — clean history to underwrite/pay claims (export = post-MVP).
- **Co-owner / sitter / rescue / adopter** — shared caretaker access, rehome transfer (post-MVP).

## MVP scope (v0.1)
Must-have:
1. Pets CRUD (dog/cat first; photo, breed, DOB, weight, microchip #, spay/neuter, sex, color)
2. Document vault (camera + file upload, PDF/JPG/PNG/WebP/HEIC, 10MB/file, 100 files/pet)
3. Vaccine records (product, lot, date given, due, provider, proof doc link)
4. Medications (name, dosage, frequency, start/end, instructions, Rx scan link)
5. Reminders (email/push: boosters, flea/tick, annual exam; overdue / this-week / later)
6. Vet visit log (date, clinic, vet, reason, diagnosis, weight, attached docs)
7. Shareable passport `/p/[token]` (read-only, QR, expiry, max-views, revoke, per-recipient label)

Nice-to-have (later): OCR pre-fill, wallet pass, co-owner invites, groomer-verify view,
visit-summary email ingest, insurance packet export, growth charts, lost-pet mode.

## User stories (MoSCoW)
Must:
- M1: As an owner I want a pet profile with photo/microchip so docs attach to the right animal.
- M2: As an owner I want to upload a rabies/DHPP cert photo/PDF so I can prove vaccination anywhere.
- M3: As an owner I want vaccine due-date reminders so Bordetella/rabies never lapse.
- M4: As an owner I want a shareable passport link/QR so a boarder verifies without my login.
- M5: As an owner I want a vet visit log so ER vets see history.
Should:
- S6: As a co-owner I want shared access so my partner gets reminders too.
- S7: As a groomer I want to verify vax without an account so check-in is fast.
- S8: As an owner I want medication schedules (Apoquel, Heartgard) so doses aren't missed.
Could:
- C9: OCR pre-fill of cert dates. C10: travel checklist (USDA APHIS/airline).
- C11: insurer history-PDF export. C12: rescue one-click transfer to adopter.

## Success metrics (60–90d)
- Activation: ≥50% new owners add 1 pet + 3 docs in 7d
- Retention: D30 ≥35%, reminder open ≥45%
- Sharing: ≥25% create ≥1 passport link; ≥40% of links opened by 3rd party
- Task time: proof-of-vax <30s; onboarding <3min
- Signal: NPS ≥40; ≥5% free→Plus intent; 3+ clinics piloting B2B2C
