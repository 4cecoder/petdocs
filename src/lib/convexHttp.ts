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

/** Deployment URL or null when unconfigured (renders demo/empty states). */
export function getConvexUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url && url.startsWith("http") ? url : null;
}

async function callConvex<T>(
  kind: "query" | "mutation" | "action",
  path: string,
  args: Record<string, unknown>,
): Promise<T> {
  const base = getConvexUrl();
  if (!base) throw new ConvexHttpError("Convex is not configured");
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
