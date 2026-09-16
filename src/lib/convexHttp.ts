/**
 * Codegen-free Convex HTTP client.
 *
 * Talks to the Convex HTTP API directly (POST {convexUrl}/api/query|mutation
 * with {path, args, format:"json"}) so src/ never imports convex/_generated —
 * which doesn't exist until `bunx convex dev` runs codegen. Once codegen
 * exists this module can be swapped for convex/react without touching callers
 * (same `api.*` shapes live in src/lib/api.ts).
 */

export class ConvexHttpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConvexHttpError";
  }
}

const PROD_FALLBACK_URL = "https://hallowed-falcon-806.convex.cloud";
const PROD_FALLBACK_SITE_URL = "https://hallowed-falcon-806.convex.site";

function normalizeHttpUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("http")) return null;
  return url.replace(/\/+$/, "");
}

/** Deployment URL or null when unconfigured (renders demo/empty states). */
export function getConvexUrl(): string | null {
  const isBrowser = typeof window !== "undefined";
  const url =
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    (isBrowser && window.location.hostname.includes("seridian.dev")
      ? PROD_FALLBACK_URL
      : null);
  return normalizeHttpUrl(url);
}

/** Convex custom HTTP endpoints, including storage redirects, use .site. */
export function getConvexSiteUrl(): string | null {
  const isBrowser = typeof window !== "undefined";
  const configured =
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
    (isBrowser && window.location.hostname.includes("seridian.dev")
      ? PROD_FALLBACK_SITE_URL
      : null);
  const siteUrl = normalizeHttpUrl(configured);
  if (siteUrl) return siteUrl;

  const cloudUrl = getConvexUrl();
  if (!cloudUrl) return null;
  return cloudUrl.replace(/\.convex\.cloud(?=\/|$)/, ".convex.site");
}

async function callConvex<T>(
  kind: "query" | "mutation" | "action",
  path: string,
  args: Record<string, unknown>,
): Promise<T> {
  const base = getConvexUrl();
  if (!base) throw new ConvexHttpError("Service is not available right now");
  let res: Response;
  try {
    res = await fetch(`${base}/api/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, args, format: "json" }),
    });
  } catch {
    throw new ConvexHttpError("Could not reach the backend");
  }
  if (!res.ok) throw new ConvexHttpError(`Backend error (${res.status})`);
  const body = (await res.json()) as
    | { value: T }
    | { error: string; errorMessage?: string };
  if ("error" in body) {
    throw new ConvexHttpError(body.errorMessage ?? body.error);
  }
  return body.value;
}

export function convexQuery<T>(
  path: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  return callConvex<T>("query", path, args);
}

export function convexMutation<T>(
  path: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  return callConvex<T>("mutation", path, args);
}

export function convexAction<T>(
  path: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  return callConvex<T>("action", path, args);
}
