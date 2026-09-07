# 15 - Trust, KYC, AI disclosure, retention

How PetDocs proves ownership, handles AI honestly, keeps data minimal, and responds when things go wrong.

## KYC and ownership claims

- Chip auto-match: a pet with a microchip number matches instantly when the digits match a vault record.
- Vet-record manual review: when chips are missing or conflict, support asks for a vet record or photo and reviews by hand before linking.
- Transfer codes: the current owner creates a one-time code, the new owner redeems it, and the old share links stop working at transfer.
- Locked seed rows stay locked so demos cannot rewrite someone else's proof.

## AI disclosure

- Deterministic first: `src/lib/parsers.ts` plus schedule tables parse text you paste or upload. No model call for L0 and L1.
- On-device camera OCR on Android: ML Kit plus CameraX reads the label in the app. Photos never leave the device until you save to the vault.
- No training on pet data: vault text and photos are never used to train models.
- Human confirms everything: every prefill shows source text plus parsed fields plus confidence. The user taps Confirm or edits. Low confidence asks for manual entry.

## Retention

- Trash 30d purge: `documents.moveToTrash` sets `isTrash`, `emptyTrash` deletes rows plus storage blobs. A scheduled purge clears trash older than 30 days.
- Magic tokens 15min plus single-use: `magicTokens` stores only SHA-256 hashes, expires in 15 minutes, and marks `usedAt` on first verify.
- Share expiry: links carry optional `expiresAt` plus `maxViews` plus manual revoke. Revoked links resolve to null and keep no cached copy.

## Audit

- `adminAudit` on every admin action: `setRole`, `revokeAnyLink`, `lockPet` each write actor, action, target, and time.
- Support reads safe projections only. Raw share tokens never appear in admin views or logs.

## Minors

- No accounts under 13. Sign-in email must belong to an adult owner.
- Pets only with guardian: a minor can appear as a pet caretaker note, never as the account holder.

## Vet-advice disclaimer

- PetDocs is a records tool, not diagnosis. Reminders and schedules organize care, they do not replace a vet.
- If a record looks wrong, ask your clinic. Do not change dose or timing from app text alone.

## Incident note

- Revoke links first: on suspected leak, revoke active `shareLinks` for the affected pet before anything else.
- Rotate keys: rotate Resend plus Stripe plus Convex deploy keys, then force new magic links.
- Notify affected owners at support@petdocs.app with what leaked, what was revoked, and what to check.
