import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  clearSession,
  getOwnerId,
  getSessionEmail,
  setSession,
  uploadDoc,
} from "./api";

const TEST_URL = "https://happy-animal-123.convex.cloud";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

function makeFile(
  name = "shot.png",
  type = "image/png",
  bytes = "bytes",
): File {
  return new File([bytes], name, { type });
}

describe("api", () => {
  let savedUrl: string | undefined;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    savedUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    process.env.NEXT_PUBLIC_CONVEX_URL = TEST_URL;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    if (savedUrl === undefined) {
      delete process.env.NEXT_PUBLIC_CONVEX_URL;
    } else {
      process.env.NEXT_PUBLIC_CONVEX_URL = savedUrl;
    }
    vi.unstubAllGlobals();
  });

  it("uploadDoc rejects bad mime before any fetch", async () => {
    const file = makeFile("evil.exe", "application/x-sh");
    await expect(
      uploadDoc({ ownerId: "o1", petId: "p1", file, uploadedBy: "o1" }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploadDoc rejects empty files before any fetch", async () => {
    const file = new File([], "empty.png", { type: "image/png" });
    await expect(
      uploadDoc({ ownerId: "o1", petId: "p1", file, uploadedBy: "o1" }),
    ).rejects.toThrow("File is empty");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploadDoc runs generateUploadUrl then PUT then create with category", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ value: "https://uploads.test/abc" }),
      )
      .mockResolvedValueOnce(jsonResponse({ storageId: "storage123" }))
      .mockResolvedValueOnce(jsonResponse({ value: "doc_123" }));

    const file = makeFile("shot.png", "image/png");
    const id = await uploadDoc({
      ownerId: "o1",
      petId: "p1",
      file,
      category: "photo",
      uploadedBy: "o1",
    });

    expect(id).toBe("doc_123");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [genUrl, genInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(genUrl).toBe(`${TEST_URL}/api/mutation`);
    expect(JSON.parse(genInit.body as string)).toEqual({
      path: "documents:generateUploadUrl",
      args: {},
      format: "json",
    });

    const [putUrl, putInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(putUrl).toBe("https://uploads.test/abc");
    expect(putInit.method).toBe("POST");

    const [, createInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    const createBody = JSON.parse(createInit.body as string) as {
      path: string;
      args: Record<string, unknown>;
    };
    expect(createBody.path).toBe("documents:create");
    expect(createBody.args).toMatchObject({
      ownerId: "o1",
      petId: "p1",
      name: "shot.png",
      storageId: "storage123",
      mime: "image/png",
      category: "photo",
      uploadedBy: "o1",
    });
  });

  it("uploadDoc defaults category to other when omitted", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ value: "https://uploads.test/abc" }),
      )
      .mockResolvedValueOnce(jsonResponse({ storageId: "storage999" }))
      .mockResolvedValueOnce(jsonResponse({ value: "doc_999" }));

    const file = makeFile("lab.pdf", "application/pdf");
    const id = await uploadDoc({
      ownerId: "o1",
      petId: "p1",
      file,
      uploadedBy: "o1",
    });

    expect(id).toBe("doc_999");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, createInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    const createBody = JSON.parse(createInit.body as string) as {
      path: string;
      args: Record<string, unknown>;
    };
    expect(createBody.args).toMatchObject({ category: "other" });
  });

  it("uploadDoc throws when PUT upload fails", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ value: "https://uploads.test/abc" }),
      )
      .mockResolvedValueOnce(jsonResponse({}, false, 500));

    const file = makeFile("shot.png", "image/png");
    await expect(
      uploadDoc({ ownerId: "o1", petId: "p1", file, uploadedBy: "o1" }),
    ).rejects.toThrow("Upload failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("share.resolve passes token only", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ value: null }));
    const result = await api.share.resolve("tok_abc");
    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${TEST_URL}/api/query`);
    const body = JSON.parse(init.body as string) as {
      path: string;
      args: Record<string, unknown>;
    };
    expect(body.path).toBe("shareLinks:resolve");
    expect(body.args).toEqual({ token: "tok_abc" });
  });

  it("session helpers do not throw and return null when storage is missing", () => {
    expect(typeof window).toBe("undefined");
    expect(() => setSession("a@b.c", "owner1")).not.toThrow();
    expect(() => clearSession()).not.toThrow();
    expect(getSessionEmail()).toBeNull();
    expect(getOwnerId()).toBeNull();
  });
});
