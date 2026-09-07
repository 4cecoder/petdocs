# 11 - AI and OCR use-case catalog

Philosophy: deterministic first, human confirms everything, confidence-gated, AI upgrades later.
Rules: no auto-write to vault. Every extract shows source text, parsed fields, and confidence. User taps Confirm or edits. Low confidence blocks prefill and asks for manual entry.

Status values: `shipped-assist` = paste-text plus regex helper exists, camera OCR planned. `planned` = specced for MVP or v0.2. `post-MVP` = v1.0 or later.

## Catalog UC-1 to UC-10

| UC | Input | Deterministic method NOW | AI upgrade LATER | Confirm UX | Status |
|----|-------|--------------------------|------------------|------------|--------|
| UC-1 | Rabies cert photo or pasted text | ML Kit text on Android. Web paste assist via `parseCertText` in `src/lib/parsers.ts` (dates, clinic, lot, due) | LLM vision for messy handwriting and stamps | Prefilled editable vax fields plus confidence note plus source snippet | shipped-assist / planned-camera |
| UC-2 | DHPP and Bordetella dates plus species and age | Vaccine schedule table with species and age rules, computes due window | Vet-protocol personalization from visit history | One-tap reminder create, user edits date first | planned |
| UC-3 | Med label photo or pasted text | `parseMedLabel` in `src/lib/parsers.ts` for BID, SID, QD, mg, mL, duration | Schedule builder from sig variations | Med form prefill plus dose frequency picker | shipped-assist |
| UC-4 | Microchip slip photo or pasted number | 9, 10, 15 digit extract with checksum length check | Registry lookup link-out to AAHA, no scraping | Chip field prefill plus verify registration nudge | shipped-assist |
| UC-5 | Vet invoice PDF or photo | Totals plus line items regex for date, clinic, amount, reason | Visit prefill with reason and cost split | Draft visit card, user confirms before save | planned |
| UC-6 | Apartment packet request | Profile plus vax aggregation from `pets.get` plus `vaccinations.listByPet` plus `documents.listByPet` | Landlord-requirement matcher for breed, weight, vax proof | One-tap packet share link, Plus-gated | shipped (packet) / post-MVP (matcher) |
| UC-7 | Travel destination plus date | Destination rules table for USDA, CDC, EU windows and health cert timing | Deadline reminders from departure date | Checklist UI with due dates, manual checkoff | planned |
| UC-8 | Insurance claim request | History assembler from `vetVisits.listByPet` plus vax plus docs | Denial-risk flags for gaps in history | Export PDF preview, user confirms pages | planned |
| UC-9 | Lost-pet report | Profile plus photo plus chip assembly into poster layout | Print-optimized poster variant | Preview sheet, user confirms contact number | planned |
| UC-10 | Sitter handoff request | Meds plus vet plus contact assembly into instruction sheet | Shareable scoped sheet with expiry | Preview sheet, user confirms share scope | planned |

## Determinism ladder

| Level | Method | Gate |
|-------|--------|------|
| L0 | Deterministic chat and help (`HelpWidget`, FAQ matching, no model) | Always allowed, never writes data |
| L1 | Template and regex (`src/lib/parsers.ts`, schedule tables, digit rules) | Prefill only if all required fields match, else manual entry |
| L2 | On-device ML (ML Kit text, CameraX scanner on Android) | Prefill only with bounding boxes plus confidence score shown |
| L3 | Server OCR (PDF and image pipeline, post-MVP) | Stores `extractedText` on document only, fields need human confirm |
| L4 | LLM vision (messy handwriting, stamps, invoices) | Last resort, flagged as low confidence, full source shown |

Every level up requires explicit user confirm. No silent promotion from L1 to L4.

## Privacy

- On-device first: L1 and L2 never leave the device. Photos stay in the vault under existing share scopes.
- Prototyped PII (chip numbers, addresses, vet names) stays in `documents` plus `pets` tables. No training use, no third-party OCR by default.
- Server OCR and LLM vision are opt-in per document when they ship. Show provider name and retention before upload.
- Share scopes from `docs/07-feature-parity.md` apply: passport, packet, and sitter links expose only selected fields.

## Parity

| Surface | NOW | LATER |
|---------|-----|-------|
| Web | Paste-text assist (`parseCertText`, `parseMedLabel`), manual confirm | File picker OCR after server L3 ships |
| Android | ML Kit text plus CameraX scanner target (`ScannerScreen`), manual confirm | On-device schedule builder |
| Server (Convex) | No `extractedText` field in `convex/documents.ts` today, categories from `src/lib/validators.ts` `DOC_CATEGORIES` | Add `extractedText` plus confidence plus source spans, post-MVP |

## Code pointers

- `src/lib/parsers.ts`: `parseCertText`, `parseMedLabel`, chip digit extract. Pure functions, unit tested.
- `ExtractFields` component: renders parsed fields plus confidence note plus source snippet plus Confirm and Edit actions.
- `HelpWidget`: L0 support AI. Deterministic matching only, counts as support AI without model calls.
- `convex/documents.ts`: vault storage. `extractedText` planned, not yet in schema.
- `src/lib/validators.ts`: `DOC_CATEGORIES` (`vaccine_record`, `lab_result`, `prescription`, `insurance`, `microchip`, `travel_certificate`, `photo`, `other`).
