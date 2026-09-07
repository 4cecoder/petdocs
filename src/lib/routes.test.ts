import { describe, expect, it } from "vitest";
import { allRouteHrefs, hasRouteGroupLeak } from "./routes";

describe("routes", () => {
  it("exposes no route-group segments in public hrefs", () => {
    for (const href of allRouteHrefs()) {
      expect(hasRouteGroupLeak(href), `leak in ${href}`).toBe(false);
    }
  });

  it("detects route-group leaks", () => {
    // Fixture strings for the detector itself — not real hrefs.
    // eslint-disable-next-line no-restricted-syntax
    expect(hasRouteGroupLeak("/(marketing)/pricing")).toBe(true);
    expect(hasRouteGroupLeak("/dashboard/pets")).toBe(false);
  });
});
