# 16 - Team access playbook

Angela's guide to who can touch what. Owners own vaults. Staff help safely.

## Two populations

- Pet owners: `owners` table. Each row owns its vault (`pets`, `documents`, links by `ownerId`).
- Staff: Angela's employees in the separate `staff` table (`email`, `name`, `role`, `active`). Powers come from the staff row, never from `owners.role`.
- Why separate tables: least privilege (staff see only support tools), clean offboarding (deactivate the staff row, vault and audit history stay), audit clarity (every staff action ties to `adminAudit.actorOwnerId`).

## Roles matrix

Code enforces `auditor < support < manager < owner` in `convex/admin.ts` via `requireRole` (staff row first, then legacy `owners.role`, then `ADMIN_EMAILS` bootstrap).

| Function | Owner (Angela) | Manager | Support | Auditor |
|---|---|---|---|---|
| `stats` view totals | yes | yes | yes | yes |
| `recentOwners` safe list | yes | yes | yes | no |
| `listLinks` metadata, no token | yes | yes | yes | no |
| `revokeAnyLink` | yes | yes | yes | no |
| `reviewClaim` approve or reject | yes | yes | yes | no |
| `setRole` on owners | yes | yes | no | no |
| `staff:invite/set/deactivate` | yes | no | no | no |
| `staff:listStaff` | yes | yes | no | no |
| `lockPet` lock or unlock | yes | no | no | no |
| `auditLog` read | yes | yes | yes | yes |

Manager: all support powers plus owner role edits plus claim reviews. No staff changes. No lock.
Auditor: stats plus audit read only. No owner lists. No revokes. No reviews.

## Invite flow

1. Set `ADMIN_EMAILS` in Convex env to Angela's email, comma separated if more than one.
2. Angela signs in with magic link like any owner (this creates her `owners` row).
3. Open `/dashboard/admin` Team access. Invite herself as `owner` once (bootstrap passes), then invite employees by email, name, and role.
4. Employee signs in with magic link. Staff powers activate automatically. Never trust client role. `requireRole` checks server side.
5. Invites work before first sign in. Re-inviting reactivates a deactivated row.

## Offboarding

- Deactivate in one tap in Team access. Row stays for audit history. Vault stays.
- Rotate shared secrets checklist: Resend key, Stripe keys, Convex deploy key, then force new magic links. See `15-trust.md` incident note.

## Rules

- Never share logins. One email per person.
- Support never sees magic tokens. `magicTokens` stores only SHA-256 `tokenHash`, 15 min expiry, single use with `usedAt`.
- Share token strings never appear in admin views or logs. `listLinks` returns metadata only.
- Every staff action is audited: `setRole`, `revokeAnyLink`, `lockPet`, `reviewClaim` write `adminAudit`.
- Quarterly access review: Angela exports Recent owners, confirms each `support` or `admin`, demotes the rest.

## B2C2B note

- Clinic and groomer staff are not PetDocs staff. They use share links (`passport`, `vaccines_only`, `full_vault`).
- If a partner later needs dashboard access, invite as auditor first. Promote only with a reason in the audit target.

## Code map

- `convex/staff.ts`: `myStaffRole`, `inviteStaff`, `setStaffRole`, `deactivateStaff`, `listStaff`.
- `convex/admin.ts`: `requireRole` (staff first, then legacy owners role, then bootstrap), `getMe`, `stats`, `recentOwners`, `listLinks`, `setRole`, `revokeAnyLink`, `lockPet`, `auditLog`.
- `convex/ownership.ts`: `reviewClaim` needs `support` or above (legacy helper, staff-aware upgrade pending).
- `convex/schema.ts`: `staff`, `owners.role` (legacy), `adminAudit`, `magicTokens.tokenHash`.
