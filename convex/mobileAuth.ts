/**
 * Mobile app API surface (#24) — the backend half of the Android beta.
 *
 * Endpoints (wired in convex/http.ts):
 *   POST /api/auth/request { email }
 *     → { ok, attempted, delivered, quotaExceeded, retryAfterUtc? }
 *     Mirrors magicLink.requestMagicLink (same 15-min single-use hashed
 *     magicTokens, same 60s per-email cooldown, same branded email via
 *     buildMagicLinkEmail) but ALWAYS builds the petdocs://signin deep link
 *     so the email opens the Android app. Unlike the web flow it returns an
 *     HONEST quota state: when Resend reports a 429/quota error the client
 *     learns `quotaExceeded: true` plus the next UTC-midnight reset time,
 *     so the app can say "retry after UTC midnight" instead of a generic
 *     "check your inbox". Anti-enumeration is preserved for the quiet
 *     paths: invalid emails and cooldown hits return the exact same shape
 *     as each other ({ attempted: false }), and no token/URL is ever
 *     returned over HTTP or logged.
 *   POST /api/auth/verify { email, token }
 *     → { ok: true, sessionToken, ownerId, expiresAt } | 401 { ok, error }
 *     Reuses the hashed-magic-token verification pattern (hash lookup
 *     scoped by email, single-use consume, find-or-create owner, superadmin
 *     allowlist persist) and then mints a long-lived mobile session: a
 *     32-byte random token whose SHA-256 is the ONLY stored form
 *     (mobileSessions table, 30-day expiry).
 *   GET  /api/me              (Bearer sessionToken) → { ownerId, email, pets[] }
 *   GET  /api/pets/{petId}    (Bearer sessionToken) → read-only vitals +
 *     recent records summary (ownership enforced; strangers get a 404).
 *   GET  /api/builds/latest?platform=android (#42, see convex/apkBuilds.ts).
 *
 * Server-only — never import from src/.
 */
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { APP_LINK_SCHEME, buildMagicLinkEmail } from "./magicLink";
import { isSuperadminAllowlisted } from "./admin";

const TOKEN_TTL_MS = 15 * 60 * 1000; // magic token: 15 minutes (web parity)
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 request per email per minute (web parity)
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // mobile session: 30 days
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Fixed deep link origin for mobile-requested emails (#24). */
export const APP_SIGNIN_ORIGIN = `${APP_LINK_SCHEME}//signin`;

const RESEND_QUOTA_RE = /\b429\b|rate.?limit|quota|too many requests/i;

/**
 * Maps a resend.ts error string to quota state. Exported for tests; the
 * 429/until-UTC-midnight wording comes from the shared Resend sender.
 */
export function classifySendError(
  error?: string,
): { quotaExceeded: boolean } {
  return { quotaExceeded: !!error && RESEND_QUOTA_RE.test(error) };
}

/** ISO timestamp of the next 00:00 UTC (Resend quota reset). */
export function nextUtcMidnightIso(now: Date = new Date()): string {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return new Date(next).toISOString();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** 32 random bytes as 64 lowercase hex chars — shared with clients once. */
function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hash of the presented token — the ONLY form persisted in the DB. */
async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Bearer token from an Authorization header, or null. Never logged. */
export function bearerTokenOf(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

/**
 * POST /api/auth/request body → mobileAuth.requestAuthCode (internal action).
 * Honest delivery state for the app; identical quiet shape for invalid
 * emails and cooldown hits.
 */
export const requestAuthResult = v.object({
  ok: v.boolean(),
  attempted: v.boolean(),
  delivered: v.boolean(),
  quotaExceeded: v.boolean(),
  retryAfterUtc: v.optional(v.string()),
});

export type RequestAuthResult = {
  ok: boolean;
  attempted: boolean;
  delivered: boolean;
  quotaExceeded: boolean;
  retryAfterUtc?: string;
};

export const requestAuthCode = internalAction({
  args: { email: v.string() },
  returns: requestAuthResult,
  handler: async (ctx, args): Promise<RequestAuthResult> => {
    const email = normalizeEmail(args.email);
    // Quiet shape shared by invalid emails + cooldown hits (#enumeration).
    const quiet: RequestAuthResult = {
      ok: true,
      attempted: false,
      delivered: false,
      quotaExceeded: false,
    };

    if (!EMAIL_RE.test(email)) return quiet;

    const latest = await ctx.runQuery(
      internal.magicLink.latestTokenForEmail,
      { email },
    );
    if (latest && Date.now() - latest.createdAt < RESEND_COOLDOWN_MS) {
      return quiet;
    }

    // Same hashed magicTokens store as the web flow: a token requested from
    // the app can also be used on the web sign-in page and vice versa.
    const token = randomToken();
    await ctx.runMutation(internal.magicLink.storeToken, {
      email,
      tokenHash: await hashToken(token),
      expiresAt: Date.now() + TOKEN_TTL_MS,
    });

    const loginUrl = `${APP_SIGNIN_ORIGIN}?token=${token}&email=${encodeURIComponent(email)}`;
    const { subject, text, html, headers } = buildMagicLinkEmail(loginUrl);

    const result: { ok: boolean; error?: string } = await ctx.runAction(
      internal.resend.sendEmail,
      { to: email, subject, html, text, headers },
    );

    if (result.ok) {
      return {
        ok: true,
        attempted: true,
        delivered: true,
        quotaExceeded: false,
      };
    }

    const { quotaExceeded } = classifySendError(result.error);
    // Short reason only — never the token, the URL, or the recipient.
    console.warn(
      `mobile auth email not sent (quotaExceeded=${quotaExceeded})`,
    );
    return {
      ok: true,
      attempted: true,
      delivered: false,
      quotaExceeded,
      ...(quotaExceeded ? { retryAfterUtc: nextUtcMidnightIso() } : {}),
    };
  },
});

const verifyOk = v.object({
  ok: v.literal(true),
  sessionToken: v.string(),
  ownerId: v.id("owners"),
  expiresAt: v.number(),
});
const verifyErr = v.object({ ok: v.literal(false), error: v.string() });

/**
 * POST /api/auth/verify — consumes the magic token (single-use, same
 * messages as the web verifyMagicLink) and mints a hashed mobile session.
 */
export const verifyAndCreateSession = internalMutation({
  args: { email: v.string(), token: v.string() },
  returns: v.union(verifyOk, verifyErr),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!EMAIL_RE.test(email) || !args.token) {
      return {
        ok: false as const,
        error: "This sign-in link is invalid.",
      };
    }

    const tokenHash = await hashToken(args.token);
    const rows = await ctx.db
      .query("magicTokens")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    const row = rows.find((r) => r.tokenHash === tokenHash) ?? null;

    if (!row) {
      return { ok: false as const, error: "This sign-in link is invalid." };
    }
    if (row.usedAt !== undefined) {
      return {
        ok: false as const,
        error: "This sign-in link has already been used.",
      };
    }
    if (row.expiresAt < Date.now()) {
      return {
        ok: false as const,
        error: "This sign-in link has expired.",
      };
    }

    // Single-use: consume the token exactly once inside this transaction.
    await ctx.db.patch(row._id, { usedAt: Date.now() });

    const existing = await ctx.db
      .query("owners")
      .withIndex("by_externalId", (q) => q.eq("externalId", email))
      .first();

    let ownerId: Id<"owners">;
    if (existing) {
      ownerId = existing._id;
    } else {
      const prefix = email.split("@")[0]?.trim();
      const name = prefix ? prefix : email;
      ownerId = await ctx.db.insert("owners", {
        externalId: email,
        email,
        name,
        createdAt: Date.now(),
      });
    }

    // Server-side superadmin allowlist, same as the web verify path.
    if (existing?.role !== "superadmin" && isSuperadminAllowlisted(email)) {
      await ctx.db.patch(ownerId, { role: "superadmin" });
    }

    const sessionToken = randomToken();
    const expiresAt = Date.now() + SESSION_TTL_MS;
    await ctx.db.insert("mobileSessions", {
      ownerId,
      tokenHash: await hashToken(sessionToken),
      expiresAt,
      createdAt: Date.now(),
    });

    return { ok: true as const, sessionToken, ownerId, expiresAt };
  },
});

/** Live, unrevoked, unexpired session doc for a presented token hash. */
async function liveSession(ctx: QueryCtx, tokenHash: string) {
  const session = await ctx.db
    .query("mobileSessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .first();
  if (!session) return null;
  if (session.revokedAt !== undefined) return null;
  if (session.expiresAt < Date.now()) return null;
  return session;
}

export const petValidator = v.object({
  _id: v.id("pets"),
  name: v.string(),
  species: v.string(),
  breed: v.optional(v.string()),
  sex: v.optional(v.string()),
  birthdate: v.optional(v.number()),
  weightKg: v.optional(v.number()),
  microchipId: v.optional(v.string()),
  color: v.optional(v.string()),
  status: v.string(),
});

export const meResult = v.object({
  ownerId: v.id("owners"),
  email: v.string(),
  pets: v.array(petValidator),
});

function projectPet(pet: {
  _id: Id<"pets">;
  name: string;
  species: string;
  breed?: string;
  sex?: string;
  birthdate?: number;
  weightKg?: number;
  microchipId?: string;
  color?: string;
  status: string;
}) {
  return {
    _id: pet._id,
    name: pet.name,
    species: pet.species,
    ...(pet.breed ? { breed: pet.breed } : {}),
    ...(pet.sex ? { sex: pet.sex } : {}),
    ...(pet.birthdate !== undefined ? { birthdate: pet.birthdate } : {}),
    ...(pet.weightKg !== undefined ? { weightKg: pet.weightKg } : {}),
    ...(pet.microchipId ? { microchipId: pet.microchipId } : {}),
    ...(pet.color ? { color: pet.color } : {}),
    status: pet.status,
  };
}

/** GET /api/me — session → owner + pets. Null when the session is dead. */
export const me = internalQuery({
  args: { tokenHash: v.string() },
  returns: v.union(meResult, v.null()),
  handler: async (ctx, args) => {
    const session = await liveSession(ctx, args.tokenHash);
    if (!session) return null;
    const owner = await ctx.db.get(session.ownerId);
    if (!owner) return null;
    const pets = await ctx.db
      .query("pets")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", owner._id))
      .take(100);
    return {
      ownerId: owner._id,
      email: owner.email,
      pets: pets.map(projectPet),
    };
  },
});

/**
 * GET /api/pets/{petId} — read-only vitals + recent records for one of the
 * session owner's pets. Null (→ 404) for dead sessions or foreign pets, so
 * pet ids of other owners are not distinguishable from unknown ids.
 */
export const petSummary = internalQuery({
  args: { tokenHash: v.string(), petId: v.id("pets") },
  returns: v.union(
    v.object({
      pet: petValidator,
      vaccinations: v.array(
        v.object({
          _id: v.id("vaccinations"),
          vaccineName: v.string(),
          status: v.string(),
          administeredAt: v.optional(v.number()),
          dueAt: v.optional(v.number()),
          provider: v.optional(v.string()),
        }),
      ),
      visits: v.array(
        v.object({
          _id: v.id("vetVisits"),
          visitedAt: v.number(),
          reason: v.string(),
          clinicName: v.optional(v.string()),
          vetName: v.optional(v.string()),
          diagnosis: v.optional(v.string()),
        }),
      ),
      documents: v.array(
        v.object({
          _id: v.id("documents"),
          name: v.string(),
          category: v.optional(v.string()),
          mime: v.string(),
          size: v.number(),
          createdAt: v.number(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const session = await liveSession(ctx, args.tokenHash);
    if (!session) return null;

    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== session.ownerId) return null;

    const vaccinations = await ctx.db
      .query("vaccinations")
      .withIndex("by_petId", (q) => q.eq("petId", args.petId))
      .order("desc")
      .take(10);
    const visits = await ctx.db
      .query("vetVisits")
      .withIndex("by_petId", (q) => q.eq("petId", args.petId))
      .order("desc")
      .take(10);
    const documents = (
      await ctx.db
        .query("documents")
        .withIndex("by_petId", (q) => q.eq("petId", args.petId))
        .order("desc")
        .take(20)
    )
      .filter((d) => !d.isTrash)
      .slice(0, 10);

    return {
      pet: projectPet(pet),
      vaccinations: vaccinations.map((vac) => ({
        _id: vac._id,
        vaccineName: vac.vaccineName,
        status: vac.status,
        ...(vac.administeredAt !== undefined
          ? { administeredAt: vac.administeredAt }
          : {}),
        ...(vac.dueAt !== undefined ? { dueAt: vac.dueAt } : {}),
        ...(vac.provider ? { provider: vac.provider } : {}),
      })),
      visits: visits.map((visit) => ({
        _id: visit._id,
        visitedAt: visit.visitedAt,
        reason: visit.reason,
        ...(visit.clinicName ? { clinicName: visit.clinicName } : {}),
        ...(visit.vetName ? { vetName: visit.vetName } : {}),
        ...(visit.diagnosis ? { diagnosis: visit.diagnosis } : {}),
      })),
      documents: documents.map((d) => ({
        _id: d._id,
        name: d.name,
        ...(d.category ? { category: d.category } : {}),
        mime: d.mime,
        size: d.size,
        createdAt: d.createdAt,
      })),
    };
  },
});

/** SHA-256 hex of a presented bearer token (used by the HTTP layer). */
export function tokenHashOf(token: string): Promise<string> {
  return hashToken(token);
}
