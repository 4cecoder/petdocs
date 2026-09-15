/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import {
  FIXTURE_LOW_SIGNAL_TEXT,
  FIXTURE_VACCINE_TEXT,
  makeMinimalPdf,
} from "./pipeline/fixtures";

// convex-test simulates file storage with fake URLs, so the action's byte
// fetch must not hit the network. fetchSourceBytes is seam-mocked to hand
// back the bytes the test "stored". The REAL extractDocumentText still runs
// (unpdf parses the fixture PDF under this runtime).
const storedBlobs = vi.hoisted(() => new Map<string, Uint8Array>());

vi.mock("./pipeline/fetchSource", () => ({
  fetchSourceBytes: async (url: string) => {
    const bytes = storedBlobs.get(url);
    if (!bytes) {
      throw new Error("Stored file has no URL (it may have been deleted)");
    }
    return bytes;
  },
}));

const modules = import.meta.glob("./**/*.ts");

const VACCINE_PDF_BYTES = makeMinimalPdf(FIXTURE_VACCINE_TEXT.split("\n"));

describe("doc pipeline (issue #23)", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
    storedBlobs.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function setup() {
    const ownerId = await t.run(async (ctx) =>
      ctx.db.insert("owners", {
        externalId: `ext-${Date.now()}-${Math.random()}`,
        name: "Owner",
        email: `o-${Date.now()}-${Math.random()}@example.com`,
        createdAt: Date.now(),
      }),
    );
    const petId = await t.mutation(api.pets.create, {
      ownerId,
      name: "Maple",
      species: "dog",
    });
    return { ownerId, petId };
  }

  async function createDoc(
    s: Awaited<ReturnType<typeof setup>>,
    opts?: { mime?: string; category?: "photo" | "other"; name?: string },
  ) {
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(
        new Blob([VACCINE_PDF_BYTES as BlobPart], { type: "application/pdf" }),
      ),
    );
    const url = await t.run(async (ctx) => ctx.storage.getUrl(storageId));
    if (url) storedBlobs.set(url, VACCINE_PDF_BYTES);
    const documentId = await t.mutation(api.documents.create, {
      ownerId: s.ownerId,
      petId: s.petId,
      name: opts?.name ?? "rabies-cert.pdf",
      storageId,
      mime: opts?.mime ?? "application/pdf",
      size: VACCINE_PDF_BYTES.length,
      category: opts?.category,
      uploadedBy: "owner",
    });
    return documentId;
  }

  async function getDoc(documentId: Id<"documents">) {
    return t.run(async (ctx) => ctx.db.get(documentId));
  }

  test("status machine: uploaded -> processing -> ready with metadata", async () => {
    const s = await setup();
    const documentId = await createDoc(s);
    expect((await getDoc(documentId))?.status).toBe("uploaded");

    await t.action(internal.docPipeline.processDocument, { documentId });

    const doc = await getDoc(documentId);
    expect(doc?.status).toBe("ready");
    expect(doc?.metadata?.type).toBe("vaccination");
    expect(doc?.metadata?.needsReview).toBe(false);
    expect(doc?.extractedText).toContain("Rabies Vaccination Certificate");
    const labels = (doc?.metadata?.fields ?? []).map((f: { label: string }) => f.label);
    expect(labels).toContain("Vaccine");
    expect(labels).toContain("Pet name");
    expect(labels).toContain("Date");
  });

  test("scheduled from documents.create and runs to completion", async () => {
    vi.useFakeTimers();
    const s = await setup();
    const documentId = await createDoc(s);
    expect((await getDoc(documentId))?.status).toBe("uploaded");

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const doc = await getDoc(documentId);
    expect(doc?.status).toBe("ready");
    expect(doc?.metadata?.type).toBe("vaccination");
  });

  test("low-confidence text lands in needsReview", async () => {
    const s = await setup();
    const documentId = await createDoc(s, { name: "receipt.pdf" });
    await t.action(internal.docPipeline.processDocument, {
      documentId,
      textOverride: FIXTURE_LOW_SIGNAL_TEXT,
    });
    const doc = await getDoc(documentId);
    expect(doc?.status).toBe("needsReview");
    expect(doc?.metadata?.needsReview).toBe(true);
    expect(doc?.metadata?.type).toBe("other");
  });

  test("no text layer + no OCR provider => needsOcr (graceful)", async () => {
    const s = await setup();
    const documentId = await createDoc(s, { mime: "image/jpeg" });
    await t.action(internal.docPipeline.processDocument, {
      documentId,
      textOverride: "   ",
    });
    const doc = await getDoc(documentId);
    expect(doc?.status).toBe("needsOcr");
    expect(doc?.metadata?.needsReview).toBe(true);
    expect(doc?.metadata?.confidence).toBe(0);
  });

  test("photo category skips extraction and marks ready", async () => {
    const s = await setup();
    const documentId = await createDoc(s, {
      mime: "image/png",
      category: "photo",
    });
    await t.action(internal.docPipeline.processDocument, { documentId });
    const doc = await getDoc(documentId);
    expect(doc?.status).toBe("ready");
    expect(doc?.metadata?.type).toBe("other");
    expect(doc?.metadata?.needsReview).toBe(false);
    expect(doc?.extractedText).toBeUndefined();
  });

  test("fetch failure marks failed; retryFailed re-arms the batch", async () => {
    const s = await setup();
    const documentId = await createDoc(s);
    storedBlobs.clear(); // simulate inaccessible storage

    await t.action(internal.docPipeline.processDocument, { documentId });
    let doc = await getDoc(documentId);
    expect(doc?.status).toBe("failed");
    expect(doc?.statusError).toBeTruthy();

    const { scheduled } = await t.mutation(internal.docPipeline.retryFailed, {
      limit: 10,
    });
    expect(scheduled).toBe(1);
    doc = await getDoc(documentId);
    expect(doc?.status).toBe("uploaded");
    expect(doc?.statusError).toBeUndefined();
  });

  test("owner reprocess re-runs the pipeline and guards ownership", async () => {
    const s = await setup();
    const documentId = await createDoc(s);
    await t.action(internal.docPipeline.processDocument, {
      documentId,
      textOverride: FIXTURE_LOW_SIGNAL_TEXT,
    });
    expect((await getDoc(documentId))?.status).toBe("needsReview");

    await t.mutation(api.documents.reprocess, {
      ownerId: s.ownerId,
      documentId,
    });
    expect((await getDoc(documentId))?.status).toBe("uploaded");

    const other = await setup();
    await expect(
      t.mutation(api.documents.reprocess, {
        ownerId: other.ownerId,
        documentId,
      }),
    ).rejects.toThrow(/Document not found/);
  });

  test("reprocess refuses docs already uploaded/processing", async () => {
    const s = await setup();
    const documentId = await createDoc(s);
    await expect(
      t.mutation(api.documents.reprocess, {
        ownerId: s.ownerId,
        documentId,
      }),
    ).rejects.toThrow(/already being processed/);
  });

  test("reviewSubmit stores confirmed fields and marks ready", async () => {
    const s = await setup();
    const documentId = await createDoc(s, { name: "receipt.pdf" });
    await t.action(internal.docPipeline.processDocument, {
      documentId,
      textOverride: FIXTURE_LOW_SIGNAL_TEXT,
    });
    expect((await getDoc(documentId))?.status).toBe("needsReview");

    await t.mutation(api.documents.reviewSubmit, {
      ownerId: s.ownerId,
      documentId,
      type: "medication",
      fields: [
        { label: "Medication", value: "Apoquel" },
        { label: "Dosage", value: "5.4 mg" },
      ],
    });

    const doc = await getDoc(documentId);
    expect(doc?.status).toBe("ready");
    expect(doc?.metadata?.needsReview).toBe(false);
    expect(doc?.metadata?.confidence).toBe(1);
    expect(doc?.metadata?.type).toBe("medication");
    expect(doc?.metadata?.fields).toEqual([
      { label: "Medication", value: "Apoquel" },
      { label: "Dosage", value: "5.4 mg" },
    ]);
  });

  test("getStatus returns status for the owning owner only", async () => {
    const s = await setup();
    const documentId = await createDoc(s);
    const status = await t.query(api.documents.getStatus, {
      ownerId: s.ownerId,
      documentId,
    });
    expect(status?.status).toBe("uploaded");
    const other = await setup();
    expect(
      await t.query(api.documents.getStatus, {
        ownerId: other.ownerId,
        documentId,
      }),
    ).toBeNull();
  });

  test("admin reprocess arms the doc and writes an audit row", async () => {
    const s = await setup();
    const documentId = await createDoc(s);
    await t.action(internal.docPipeline.processDocument, {
      documentId,
      textOverride: FIXTURE_LOW_SIGNAL_TEXT,
    });
    expect((await getDoc(documentId))?.status).toBe("needsReview");

    // Grant superadmin on the owners row (admin.ts RBAC), then reprocess.
    const ownerEmail = await t.run(async (ctx) => {
      const owner = await ctx.db.get(s.ownerId);
      if (!owner) throw new Error("owner missing");
      await ctx.db.patch(s.ownerId, { role: "superadmin" });
      return owner.email;
    });

    await t.mutation(api.docPipelineAdmin.adminReprocessDocument, {
      adminEmail: ownerEmail,
      documentId,
    });
    expect((await getDoc(documentId))?.status).toBe("uploaded");

    const audits = await t.run(async (ctx) =>
      (await ctx.db.query("adminAudit").collect()).filter(
        (a: { actorOwnerId: string }) => a.actorOwnerId === s.ownerId,
      ),
    );
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe("doc_pipeline.reprocess");

    // Unknown admin email is rejected.
    await expect(
      t.mutation(api.docPipelineAdmin.adminReprocessDocument, {
        adminEmail: "not-a-user@example.com",
        documentId,
      }),
    ).rejects.toThrow(/Not authorized/);
  });

  test("processing only ever leaves 'uploaded' (idempotency guard)", async () => {
    const s = await setup();
    const documentId = await createDoc(s);
    await t.action(internal.docPipeline.processDocument, { documentId });
    expect((await getDoc(documentId))?.status).toBe("ready");

    // Re-running the action must not clobber the terminal state.
    await t.action(internal.docPipeline.processDocument, {
      documentId,
      textOverride: FIXTURE_LOW_SIGNAL_TEXT,
    });
    const doc = await getDoc(documentId);
    expect(doc?.status).toBe("ready");
    expect(doc?.metadata?.type).toBe("vaccination");
  });
});
