/**
 * Storage byte-fetching seam.
 *
 * Isolated in its own module so tests can vi.mock it: convex-test simulates
 * file storage with fake URLs, so real tests must not hit the network.
 */

export async function fetchSourceBytes(
  url: string,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!url) throw new Error("Stored file has no URL (it may have been deleted)");
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Storage fetch failed: HTTP ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    throw new Error("Stored file exceeds the allowed size");
  }
  return new Uint8Array(buf);
}
