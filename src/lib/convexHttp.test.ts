import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConvexHttpError,
  convexAction,
  convexMutation,
  convexQuery,
  getConvexUrl,
} from "./convexHttp";

const TEST_URL = "https://happy-animal-123.convex.cloud";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("convexHttp", () => {
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

  it("getConvexUrl returns null when env is missing", () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    expect(getConvexUrl()).toBeNull();
  });

  it("getConvexUrl returns null for non http values and url for valid values", () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "not-a-url";
    expect(getConvexUrl()).toBeNull();
    process.env.NEXT_PUBLIC_CONVEX_URL = TEST_URL;
    expect(getConvexUrl()).toBe(TEST_URL);
  });

  it("convexQuery posts to /api/query with path args and format json and unwraps value", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ value: [{ name: "Mochi" }] }),
    );
    const result = await convexQuery("pets:listByOwner", { ownerId: "owner1" });
    expect(result).toEqual([{ name: "Mochi" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${TEST_URL}/api/query`);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({
      path: "pets:listByOwner",
      args: { ownerId: "owner1" },
      format: "json",
    });
  });

  it("convexMutation posts to /api/mutation with path args and format json and unwraps value", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ value: "doc_123" }));
    const result = await convexMutation("documents:create", { petId: "p1" });
    expect(result).toBe("doc_123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${TEST_URL}/api/mutation`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      path: "documents:create",
      args: { petId: "p1" },
      format: "json",
    });
  });

  it("convexAction posts to /api/action and unwraps value", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ value: { ok: true } }));
    const result = await convexAction("magicLink:requestMagicLink", {
      email: "a@b.c",
    });
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${TEST_URL}/api/action`);
    expect(JSON.parse(init.body as string)).toEqual({
      path: "magicLink:requestMagicLink",
      args: { email: "a@b.c" },
      format: "json",
    });
  });

  it("throws ConvexHttpError with backend message on error envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "CONVEX_ERROR", errorMessage: "Pet not found" }),
    );
    const err = await convexQuery("pets:get", {}).catch((e) => e);
    expect(err).toBeInstanceOf(ConvexHttpError);
    expect((err as Error).message).toBe("Pet not found");
  });

  it("falls back to error code when errorMessage is missing", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Something broke" }));
    await expect(convexQuery("pets:get", {})).rejects.toThrow(
      "Something broke",
    );
  });

  it("throws on non-ok status", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 500));
    const err = await convexQuery("pets:get", {}).catch((e) => e);
    expect(err).toBeInstanceOf(ConvexHttpError);
    expect((err as Error).message).toContain("500");
  });

  it("throws Could not reach on network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(convexQuery("pets:get", {})).rejects.toThrow(
      "Could not reach",
    );
  });

  it("throws when Convex URL is not configured", async () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    await expect(convexQuery("pets:get", {})).rejects.toThrow(
      "Convex is not configured",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
