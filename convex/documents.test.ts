/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("documents", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest({ schema, modules });
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
    const petId = await t.mutation(api.pets.create, { ownerId, name: "Fido", species: "dog" });
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["hello"], { type: "application/pdf" })),
    );
    return { ownerId, petId, storageId };
  }

  test("create rejects bad mime and oversized files", async () => {
    const { ownerId, petId, storageId } = await setup();
    await expect(
      t.mutation(api.documents.create, {
        ownerId, petId, name: "evil.sh", storageId, mime: "application/x-sh", size: 100, uploadedBy: "owner",
      }),
    ).rejects.toThrow(/Unsupported file type/);
    await expect(
      t.mutation(api.documents.create, {
        ownerId, petId, name: "big.pdf", storageId, mime: "application/pdf", size: 11 * 1024 * 1024, uploadedBy: "owner",
      }),
    ).rejects.toThrow(/under 10MB/);
  });

  test("listByPet filters trashed docs", async () => {
    const { ownerId, petId, storageId } = await setup();
    const base = { ownerId, petId, storageId, mime: "application/pdf", size: 10, uploadedBy: "owner" };
    const keep = await t.mutation(api.documents.create, { ...base, name: "keep.pdf" });
    const trash = await t.mutation(api.documents.create, { ...base, name: "trash.pdf" });
    await t.mutation(api.documents.moveToTrash, { ownerId, documentId: trash });

    const listed = await t.query(api.documents.listByPet, { ownerId, petId });
    expect(listed.map((d) => d._id)).toEqual([keep]);
  });

  test("moveToTrash then restoreFromTrash round-trip", async () => {
    const { ownerId, petId, storageId } = await setup();
    const docId = await t.mutation(api.documents.create, {
      ownerId, petId, name: "shot.pdf", storageId, mime: "application/pdf", size: 10, uploadedBy: "owner",
    });
    await t.mutation(api.documents.moveToTrash, { ownerId, documentId: docId });
    expect(await t.query(api.documents.listByPet, { ownerId, petId })).toHaveLength(0);

    await t.mutation(api.documents.restoreFromTrash, { ownerId, documentId: docId });
    expect(await t.query(api.documents.listByPet, { ownerId, petId })).toHaveLength(1);
  });

  test("emptyTrash deletes only caller's rows", async () => {
    const a = await setup();
    const b = await setup();
    const mk = (s: typeof a, name: string) =>
      t.mutation(api.documents.create, {
        ownerId: s.ownerId, petId: s.petId, name, storageId: s.storageId,
        mime: "application/pdf", size: 10, uploadedBy: "owner",
      });
    const trashedA = await mk(a, "a.pdf");
    const trashedB = await mk(b, "b.pdf");
    await t.mutation(api.documents.moveToTrash, { ownerId: a.ownerId, documentId: trashedA });
    await t.mutation(api.documents.moveToTrash, { ownerId: b.ownerId, documentId: trashedB });

    expect(await t.mutation(api.documents.emptyTrash, { ownerId: a.ownerId })).toBe(1);
    const stillThere = await t.run(async (ctx) => ctx.db.get(trashedB));
    expect(stillThere).not.toBeNull();
    const gone = await t.run(async (ctx) => ctx.db.get(trashedA));
    expect(gone).toBeNull();
  });
});
