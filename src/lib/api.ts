/**
 * Typed wrappers over the Convex backend via src/lib/convexHttp.ts.
 * Convex IDs are plain strings over HTTP. All functions throw
 * ConvexHttpError when unconfigured or on backend errors — callers render
 * empty/demo states in that case.
 */
import {
  convexAction,
  convexMutation,
  convexQuery,
  getConvexUrl,
} from "./convexHttp";
import { validateDocUpload } from "./validators";

export const isBackendConfigured =
  typeof process !== "undefined" &&
  !!process.env.NEXT_PUBLIC_CONVEX_URL;

// ---------------------------------------------------------------------------
// Session (demo shape until magic-link verify lands: email + ownerId)
// ---------------------------------------------------------------------------
const EMAIL_KEY = "petdocs-owner";
const ID_KEY = "petdocs-owner-id";

export function getSessionEmail(): string | null {
  try {
    return window.localStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}

export function getOwnerId(): string | null {
  try {
    return window.localStorage.getItem(ID_KEY);
  } catch {
    return null;
  }
}

export function setSession(email: string, ownerId?: string): void {
  try {
    window.localStorage.setItem(EMAIL_KEY, email);
    if (ownerId) window.localStorage.setItem(ID_KEY, ownerId);
    else window.localStorage.removeItem(ID_KEY);
  } catch {
    /* noop */
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(EMAIL_KEY);
    window.localStorage.removeItem(ID_KEY);
  } catch {
    /* noop */
  }
}

// ---------------------------------------------------------------------------
// Types (mirror convex/schema.ts)
// ---------------------------------------------------------------------------
export interface Pet {
  _id: string;
  ownerId: string;
  name: string;
  species: string;
  breed?: string;
  birthdate?: number;
  weightKg?: number;
  microchipId?: string;
  status: string;
}

export interface VaultDoc {
  _id: string;
  name: string;
  mime: string;
  size: number;
  category?: string;
  createdAt: number;
}

export interface Vaccination {
  _id: string;
  vaccineName: string;
  status: "due" | "administered" | "overdue" | "waived";
  dueAt?: number;
  administeredAt?: number;
  provider?: string;
}

export interface Medication {
  _id: string;
  name: string;
  dosage: string;
  frequency: string;
  status: "active" | "completed" | "paused";
}

export interface VetVisit {
  _id: string;
  visitedAt: number;
  reason: string;
  clinicName?: string;
  vetName?: string;
  diagnosis?: string;
}

export interface Reminder {
  _id: string;
  petId: string;
  kind: string;
  title: string;
  dueAt: number;
  status: string;
}

export interface ShareLink {
  _id: string;
  petId: string;
  token: string;
  scope: string;
  label?: string;
  expiresAt?: number;
  maxViews?: number;
  viewCount: number;
  isActive: boolean;
}

export interface Passport {
  scope: string;
  pet: { name: string; species: string; breed?: string; birthdate?: number };
  vaccinations: Array<{
    vaccineName: string;
    status: string;
    administeredAt?: number;
    dueAt?: number;
  }>;
  documents: Array<{
    id: string;
    name: string;
    category?: string;
    url: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Domain API
// ---------------------------------------------------------------------------
export const api = {
  auth: {
    requestMagicLink: (email: string) =>
      convexAction<{ ok: true }>("magicLink:requestMagicLink", { email }),
    verifyMagicLink: (email: string, token: string) =>
      convexMutation<{ ok: true; ownerId: string } | { ok: false; error: string }>(
        "magicLink:verifyMagicLink",
        { email, token },
      ),
  },

  pets: {
    list: (ownerId: string) =>
      convexQuery<Pet[]>("pets:listByOwner", { ownerId }),
    get: (ownerId: string, petId: string) =>
      convexQuery<Pet | null>("pets:get", { ownerId, petId }),
    create: (input: {
      ownerId: string;
      name: string;
      species: "dog" | "cat" | "bird" | "rabbit" | "reptile" | "other";
      breed?: string;
      birthdate?: number;
      weightKg?: number;
      microchipId?: string;
    }) => convexMutation<string>("pets:create", input),
    archive: (ownerId: string, petId: string) =>
      convexMutation<string>("pets:archive", { ownerId, petId }),
  },

  documents: {
    list: (ownerId: string, petId: string, category?: string) =>
      convexQuery<VaultDoc[]>("documents:listByPet", {
        ownerId,
        petId,
        ...(category ? { category } : {}),
      }),
    getUrl: (ownerId: string, documentId: string) =>
      convexQuery<string | null>("documents:getUrl", { ownerId, documentId }),
    moveToTrash: (ownerId: string, documentId: string) =>
      convexMutation<string>("documents:moveToTrash", { ownerId, documentId }),
  },

  vaccinations: {
    list: (ownerId: string, petId: string) =>
      convexQuery<Vaccination[]>("vaccinations:listByPet", { ownerId, petId }),
    dueSoon: (ownerId: string, daysAhead = 30) =>
      convexQuery<Vaccination[]>("vaccinations:dueSoon", { ownerId, daysAhead }),
  },

  medications: {
    list: (ownerId: string, petId: string) =>
      convexQuery<Medication[]>("medications:listByPet", { ownerId, petId }),
  },

  visits: {
    list: (ownerId: string, petId: string) =>
      convexQuery<VetVisit[]>("vetVisits:listByPet", { ownerId, petId }),
  },

  reminders: {
    list: (ownerId: string, upcomingOnly = true) =>
      convexQuery<Reminder[]>("reminders:listByOwner", { ownerId, upcomingOnly }),
    listByPet: (ownerId: string, petId: string) =>
      convexQuery<Reminder[]>("reminders:listByPet", { ownerId, petId }),
    setStatus: (ownerId: string, reminderId: string, status: "done" | "dismissed") =>
      convexMutation<string>("reminders:setStatus", { ownerId, reminderId, status }),
  },

  share: {
    createToken: (input: {
      ownerId: string;
      petId: string;
      scope: "passport" | "vaccines_only" | "full_vault";
      label?: string;
      expiresAt?: number;
      maxViews?: number;
    }) => convexMutation<{ linkId: string; token: string }>("shareLinks:createToken", input),
    listByPet: (ownerId: string, petId: string) =>
      convexQuery<ShareLink[]>("shareLinks:listByPet", { ownerId, petId }),
    revoke: (ownerId: string, linkId: string) =>
      convexMutation<string>("shareLinks:revoke", { ownerId, linkId }),
    resolve: (token: string) =>
      convexQuery<Passport | null>("shareLinks:resolve", { token }),
    recordView: (token: string) =>
      convexMutation<number | null>("shareLinks:recordView", { token }),
  },
};

/** Full camera→vault upload: validate → upload URL → PUT bytes → create row. */
export async function uploadDoc(input: {
  ownerId: string;
  petId: string;
  file: File;
  category?: string;
  uploadedBy: string;
}): Promise<string> {
  const problem = validateDocUpload({ mime: input.file.type, size: input.file.size });
  if (problem) throw new Error(problem);
  const uploadUrl = await convexMutation<string>("documents:generateUploadUrl", {});
  const put = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": input.file.type },
    body: input.file,
  });
  if (!put.ok) throw new Error("Upload failed. Try again.");
  const { storageId } = (await put.json()) as { storageId: string };
  return convexMutation<string>("documents:create", {
    ownerId: input.ownerId,
    petId: input.petId,
    name: input.file.name,
    storageId,
    mime: input.file.type,
    size: input.file.size,
    category: input.category ?? "other",
    uploadedBy: input.uploadedBy,
  });
}

export { getConvexUrl };
export { ConvexHttpError } from "./convexHttp";
