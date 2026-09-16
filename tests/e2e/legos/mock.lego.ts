import type { Page, Route } from "@playwright/test";

export interface MockPet {
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

export interface MockDoc {
  _id: string;
  ownerId: string;
  petId: string;
  name: string;
  mime: string;
  size: number;
  category?: string;
  createdAt: number;
  isTrash?: boolean;
}

export interface MockVaccine {
  _id: string;
  ownerId: string;
  petId: string;
  vaccineName: string;
  status: "due" | "administered" | "overdue" | "waived";
  dueAt?: number;
  administeredAt?: number;
  provider?: string;
}

export interface MockReminder {
  _id: string;
  ownerId: string;
  petId: string;
  kind: string;
  title: string;
  dueAt: number;
  status: "scheduled" | "done" | "dismissed";
}

export interface MockShareLink {
  _id: string;
  ownerId: string;
  petId: string;
  token: string;
  scope: string;
  label?: string;
  expiresAt?: number;
  viewCount: number;
  isActive: boolean;
}

export interface MockState {
  ownerId: string;
  email: string;
  pets: MockPet[];
  documents: MockDoc[];
  vaccinations: MockVaccine[];
  medications: Array<{
    _id: string;
    ownerId: string;
    petId: string;
    name: string;
    dosage: string;
    frequency: string;
    status: "active" | "completed" | "paused";
  }>;
  visits: Array<{
    _id: string;
    ownerId: string;
    petId: string;
    visitedAt: number;
    clinicName?: string;
    vetName?: string;
    reason: string;
    diagnosis?: string;
  }>;
  reminders: MockReminder[];
  shareLinks: MockShareLink[];
}

type MockStaffRole = "owner" | "manager" | "support" | "auditor" | "superadmin";

const DEMO_STAFF_ROLES: Record<string, MockStaffRole> = {
  "auditor@demo.pet": "auditor",
  "support@demo.pet": "support",
  "manager@demo.pet": "manager",
  "owner@demo.pet": "owner",
  "superadmin@demo.pet": "superadmin",
};

function mockStaffRole(email: unknown): MockStaffRole | null {
  if (typeof email !== "string") return null;
  return DEMO_STAFF_ROLES[email.trim().toLowerCase()] ?? null;
}

function mockAdminMe(email: string, role: MockStaffRole) {
  return {
    _id: `owner-${email.replace(/[^a-z0-9]+/gi, "-")}`,
    email,
    name: email.split("@")[0],
    // The legacy owner role is only used for the old owner/admin controls;
    // the staff role below remains the source of truth for the demo matrix.
    role: role === "superadmin" ? "superadmin" : role === "owner" ? "owner" : "support",
    createdAt: Date.now(),
  };
}

function mockError(message = "Not authorized") {
  return { error: "App Error", errorMessage: message };
}

const DEMO_IMAGE_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='240'%3E%3Crect width='320' height='240' fill='%230d9488'/%3E%3Ccircle cx='160' cy='108' r='54' fill='%23fef3c7'/%3E%3C/svg%3E";

export function createDefaultMockState(ownerId = "owner-e2e-123", email = "test@petdocs.test"): MockState {
  return {
    ownerId,
    email,
    pets: [
      {
        _id: "pet-miso",
        ownerId,
        name: "Miso",
        species: "cat",
        breed: "Calico",
        birthdate: Date.now() - 365 * 24 * 60 * 60 * 1000 * 2,
        weightKg: 4.2,
        microchipId: "985141001234567",
        status: "active",
      },
    ],
    documents: [
      {
        _id: "doc-rabies-1",
        ownerId,
        petId: "pet-miso",
        name: "Rabies-Certificate-2026.pdf",
        mime: "application/pdf",
        size: 142000,
        category: "vaccine_record",
        createdAt: Date.now() - 86400000 * 10,
        isTrash: false,
      },
      {
        _id: "doc-miso-photo-1",
        ownerId,
        petId: "pet-miso",
        name: "Miso-portrait.svg",
        mime: "image/svg+xml",
        size: 42000,
        category: "photo",
        createdAt: Date.now() - 86400000 * 4,
        isTrash: false,
      },
    ],
    vaccinations: [
      {
        _id: "vax-1",
        ownerId,
        petId: "pet-miso",
        vaccineName: "Rabies Core",
        status: "administered",
        administeredAt: Date.now() - 86400000 * 30,
        dueAt: Date.now() + 86400000 * 335,
        provider: "Riverside Vet",
      },
      {
        _id: "vax-2",
        ownerId,
        petId: "pet-miso",
        vaccineName: "FVRCP Core",
        status: "due",
        dueAt: Date.now() + 86400000 * 14,
      },
    ],
    medications: [
      {
        _id: "med-1",
        ownerId,
        petId: "pet-miso",
        name: "Revolution Plus (Flea/Tick)",
        dosage: "0.5ml",
        frequency: "Monthly",
        status: "active",
      },
    ],
    visits: [
      {
        _id: "visit-1",
        ownerId,
        petId: "pet-miso",
        visitedAt: Date.now() - 86400000 * 60,
        clinicName: "Riverside Animal Clinic",
        vetName: "Dr. Chen",
        reason: "Annual Wellness Exam",
        diagnosis: "Healthy & active",
      },
    ],
    reminders: [
      {
        _id: "rem-1",
        ownerId,
        petId: "pet-miso",
        kind: "custom",
        title: "FVRCP Booster Check",
        dueAt: Date.now() + 86400000 * 3,
        status: "scheduled",
      },
    ],
    shareLinks: [
      {
        _id: "link-1",
        ownerId,
        petId: "pet-miso",
        token: "tok-miso-passport-demo",
        scope: "passport",
        label: "Landlord Verification",
        expiresAt: Date.now() + 86400000 * 7,
        viewCount: 2,
        isActive: true,
      },
    ],
  };
}

/**
 * Intercepts Convex HTTP query, mutation, and action API calls to provide
 * fully deterministic, fast, offline-capable test environments.
 */
export async function setupConvexMock(page: Page, initialState?: Partial<MockState>): Promise<MockState> {
  const state: MockState = {
    ...createDefaultMockState(),
    ...(initialState ?? {}),
  };

  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.id = "hide-nextjs-portal";
    style.textContent = "nextjs-portal, [data-nextjs-dev-overlay] { display: none !important; }";
    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.addEventListener("DOMContentLoaded", () => document.head?.appendChild(style));
    }
  });

  await page.route("**/api/query", async (route: Route) => {
    try {
      const request = route.request();
      const body = request.postDataJSON() as { path: string; args: Record<string, any> };
      const { path, args } = body;

      const requestedEmail = args.email ?? args.adminEmail;
      const role = mockStaffRole(requestedEmail);

      if (path === "admin:getMe") {
        await route.fulfill({
          json: {
            value: role ? mockAdminMe(String(args.email), role) : null,
          },
        });
        return;
      }

      if (path === "staff:myStaffRole") {
        await route.fulfill({
          json: { value: role ? { role, active: true } : null },
        });
        return;
      }

      if (path === "admin:stats") {
        await route.fulfill({
          json: role ? {
            value: {
              owners: 3,
              pets: state.pets.length,
              documents: state.documents.length,
              activeLinks: state.shareLinks.filter((link) => link.isActive).length,
              remindersScheduled: state.reminders.filter((reminder) => reminder.status === "scheduled").length,
            },
          } : mockError(),
        });
        return;
      }

      if (path === "admin:auditLog") {
        await route.fulfill({
          json: {
            value: role
              ? [
                  {
                    _id: "audit-demo-1",
                    actorOwnerId: "owner-demo",
                    actorEmail: String(requestedEmail),
                    action: "demo access check",
                    target: "seed",
                    createdAt: Date.now(),
                  },
                ]
              : mockError(),
          },
        });
        return;
      }

      if (path === "resend:status") {
        await route.fulfill({
          json: {
            value: {
              keySet: true,
              fromSet: true,
              from: "no-reply@demo.pet",
            },
          },
        });
        return;
      }

      if (path === "admin:recentOwners") {
        const canRead = role === "support" || role === "manager" || role === "owner" || role === "superadmin";
        await route.fulfill({
          json: canRead
            ? {
                value: [
                  {
                    _id: "owner-maya",
                    email: "maya@demo.pet",
                    name: "Maya Chen",
                    role: "owner",
                    createdAt: Date.now(),
                  },
                ],
              }
            : mockError(),
        });
        return;
      }

      if (path === "admin:listLinks") {
        const canRead = role === "support" || role === "manager" || role === "owner" || role === "superadmin";
        await route.fulfill({
          json: canRead
            ? {
                value: state.shareLinks.slice(0, 3).map((link) => ({
                  _id: link._id,
                  petId: link.petId,
                  ownerId: link.ownerId,
                  scope: link.scope,
                  label: link.label,
                  isActive: link.isActive,
                  viewCount: link.viewCount,
                  createdAt: Date.now(),
                  expiresAt: link.expiresAt,
                  ownerEmail: "maya@demo.pet",
                  petName: state.pets.find((pet) => pet._id === link.petId)?.name ?? null,
                })),
              }
            : mockError(),
        });
        return;
      }

      if (path === "staff:listStaff") {
        const canRead = role === "manager" || role === "owner" || role === "superadmin";
        await route.fulfill({
          json: canRead
            ? {
                value: Object.entries(DEMO_STAFF_ROLES).map(([email, staffRole]) => ({
                  email,
                  name: email.split("@")[0],
                  role: staffRole,
                  active: true,
                  createdAt: Date.now(),
                })),
              }
            : mockError(),
        });
        return;
      }

      if (path === "integrations:status") {
        await route.fulfill({
          json: role === "superadmin"
            ? {
                value: {
                  resend: { keySet: true, fromSet: true, from: "no-reply@demo.pet" },
                  email: { keySet: true, fromSet: true, from: "no-reply@demo.pet" },
                  polar: {
                    accessTokenSet: false,
                    webhookSecretSet: false,
                    orgIdSet: false,
                    productPlusSet: false,
                    productFamilySet: false,
                  },
                  site: {
                    siteUrl: "http://localhost:3000",
                    convexDeployment: "mock-e2e",
                  },
                },
              }
            : mockError(),
        });
        return;
      }

      if (path === "pets:listByOwner") {
        const result = state.pets.filter((p) => p.ownerId === args.ownerId);
        await route.fulfill({ json: { value: result } });
        return;
      }

      if (path === "pets:get") {
        const pet = state.pets.find((p) => p._id === args.petId);
        await route.fulfill({ json: { value: pet ?? null } });
        return;
      }

      if (path === "documents:listByPet") {
        const docs = state.documents.filter(
          (d) => d.petId === args.petId && !d.isTrash && (!args.category || d.category === args.category),
        );
        await route.fulfill({ json: { value: docs } });
        return;
      }

      if (path === "documents:getUrl") {
        const doc = state.documents.find((d) => d._id === args.documentId);
        await route.fulfill({
          json: {
            value: doc?.mime.startsWith("image/") ? DEMO_IMAGE_URL : null,
          },
        });
        return;
      }

      if (path === "vaccinations:listByPet") {
        const vax = state.vaccinations.filter((v) => v.petId === args.petId);
        await route.fulfill({ json: { value: vax } });
        return;
      }

      if (path === "medications:listByPet") {
        const meds = state.medications.filter((m) => m.petId === args.petId);
        await route.fulfill({ json: { value: meds } });
        return;
      }

      if (path === "vetVisits:listByPet") {
        const visits = state.visits.filter((v) => v.petId === args.petId);
        await route.fulfill({ json: { value: visits } });
        return;
      }

      if (path === "reminders:listByOwner") {
        const rems = state.reminders.filter(
          (r) => r.ownerId === args.ownerId && (!args.upcomingOnly || r.status === "scheduled"),
        );
        await route.fulfill({ json: { value: rems } });
        return;
      }

      if (path === "reminders:listByPet") {
        const rems = state.reminders.filter(
          (r) => r.ownerId === args.ownerId && r.petId === args.petId,
        );
        await route.fulfill({ json: { value: rems } });
        return;
      }

      if (path === "shareLinks:listByPet") {
        const links = state.shareLinks.filter((l) => l.petId === args.petId && l.isActive);
        await route.fulfill({ json: { value: links } });
        return;
      }

      if (path === "shareLinks:resolve") {
        const link = state.shareLinks.find((l) => l.token === args.token && l.isActive);
        if (!link) {
          await route.fulfill({ json: { value: null } });
          return;
        }
        const pet = state.pets.find((p) => p._id === link.petId);
        if (!pet) {
          await route.fulfill({ json: { value: null } });
          return;
        }
        const vax = state.vaccinations.filter((v) => v.petId === pet._id);
        const docs = state.documents.filter((d) => d.petId === pet._id && !d.isTrash);
        await route.fulfill({
          json: {
            value: {
              scope: link.scope,
              pet: {
                name: pet.name,
                species: pet.species,
                breed: pet.breed,
                birthdate: pet.birthdate,
              },
              vaccinations: vax.map((v) => ({
                vaccineName: v.vaccineName,
                status: v.status,
                administeredAt: v.administeredAt,
                dueAt: v.dueAt,
              })),
              documents: docs.map((d) => ({
                id: d._id,
                name: d.name,
                category: d.category,
                url: null,
              })),
            },
          },
        });
        return;
      }

      await route.fulfill({ json: { value: [] } });
    } catch {
      await route.fallback();
    }
  });

  await page.route("**/api/action", async (route: Route) => {
    try {
      const request = route.request();
      const body = request.postDataJSON() as { path: string; args: Record<string, any> };
      const { path, args } = body;

      if (path === "magicLink:requestMagicLink" || path === "auth:requestMagicLink") {
        // This stays entirely inside Playwright's route mock. No Resend call,
        // Convex action, or email resource is used by mocked E2E flows.
        const appOrigin = new URL(request.url()).origin;
        const directUrl = new URL("/sign-in", appOrigin);
        directUrl.searchParams.set("email", args.email);
        directUrl.searchParams.set("token", "mock-magic-token-xyz");
        await route.fulfill({
          json: { value: { ok: true, previewUrl: directUrl.toString() } },
        });
        return;
      }
      await route.fulfill({ json: { value: { ok: true } } });
    } catch {
      await route.fallback();
    }
  });

  await page.route("**/api/mock-upload", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      json: { storageId: "mock-storage-id-123" },
    });
  });

  await page.route("**/api/mutation", async (route: Route) => {
    try {
      const request = route.request();
      const body = request.postDataJSON() as { path: string; args: Record<string, any> };
      const { path, args } = body;

      if (path === "magicLink:directSignIn") {
        await route.fulfill({
          json: { value: { ok: true, ownerId: state.ownerId, isNew: false } },
        });
        return;
      }

      if (path === "magicLink:verifyMagicLink" || path === "auth:verifyMagicLink") {
        await route.fulfill({
          json: { value: { ok: true, ownerId: state.ownerId } },
        });
        return;
      }

      if (path === "pets:create") {
        const newId = `pet-new-${Date.now()}`;
        state.pets.push({
          _id: newId,
          ownerId: args.ownerId,
          name: args.name,
          species: args.species,
          breed: args.breed,
          birthdate: args.birthdate,
          weightKg: args.weightKg,
          microchipId: args.microchipId,
          status: "active",
        });
        await route.fulfill({ json: { value: newId } });
        return;
      }

      if (path === "pets:update") {
        const pet = state.pets.find((p) => p._id === args.petId);
        if (pet) {
          if (args.name !== undefined) pet.name = args.name;
          if (args.breed !== undefined) pet.breed = args.breed;
          if (args.weightKg !== undefined) pet.weightKg = args.weightKg;
          if (args.microchipId !== undefined) pet.microchipId = args.microchipId;
        }
        await route.fulfill({ json: { value: args.petId } });
        return;
      }

      if (path === "documents:generateUploadUrl") {
        // Origin-relative: uploadDoc fetches it from the page, so it resolves
        // against whatever PORT the suite runs on. An absolute
        // http://localhost:3000 URL made this PUT cross-origin on other
        // ports, and the preflight failed (no CORS headers on fulfill).
        await route.fulfill({ json: { value: "/api/mock-upload" } });
        return;
      }

      if (path === "documents:create") {
        const newDocId = `doc-${Date.now()}`;
        state.documents.push({
          _id: newDocId,
          ownerId: args.ownerId,
          petId: args.petId,
          name: args.name,
          mime: args.mime,
          size: args.size,
          category: args.category ?? "other",
          createdAt: Date.now(),
          isTrash: false,
        });
        await route.fulfill({ json: { value: newDocId } });
        return;
      }

      if (path === "documents:moveToTrash") {
        const doc = state.documents.find((d) => d._id === args.documentId);
        if (doc) doc.isTrash = true;
        await route.fulfill({ json: { value: args.documentId } });
        return;
      }

      if (path === "reminders:create") {
        const newRemId = `rem-${Date.now()}`;
        state.reminders.push({
          _id: newRemId,
          ownerId: args.ownerId,
          petId: args.petId,
          kind: args.kind || "custom",
          title: args.title,
          dueAt: args.dueAt,
          status: "scheduled",
        });
        await route.fulfill({ json: { value: newRemId } });
        return;
      }

      if (path === "reminders:setStatus") {
        const rem = state.reminders.find((r) => r._id === args.reminderId);
        if (rem) rem.status = args.status;
        await route.fulfill({ json: { value: args.reminderId } });
        return;
      }

      if (path === "shareLinks:createToken") {
        const token = `tok-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const linkId = `share-${Date.now()}`;
        state.shareLinks.push({
          _id: linkId,
          ownerId: args.ownerId,
          petId: args.petId,
          token,
          scope: args.scope || "passport",
          label: args.label,
          expiresAt: args.expiresAt,
          viewCount: 0,
          isActive: true,
        });
        await route.fulfill({ json: { value: { linkId, token } } });
        return;
      }

      if (path === "shareLinks:revoke") {
        const link = state.shareLinks.find((l) => l._id === args.linkId);
        if (link) link.isActive = false;
        await route.fulfill({ json: { value: args.linkId } });
        return;
      }

      if (path === "shareLinks:recordView") {
        const link = state.shareLinks.find((l) => l.token === args.token);
        if (link) link.viewCount += 1;
        await route.fulfill({ json: { value: link?.viewCount ?? 1 } });
        return;
      }

      await route.fulfill({ json: { value: true } });
    } catch {
      await route.fallback();
    }
  });

  return state;
}
