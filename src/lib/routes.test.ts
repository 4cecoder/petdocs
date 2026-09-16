import { describe, expect, it } from "vitest";
import {
  PET_SUBROUTES,
  allRouteHrefs,
  hasRouteGroupLeak,
  isPetSubroutePath,
  petHref,
  petSubrouteHref,
} from "./routes";

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

  it("builds pet sub-route hrefs under the pet hub", () => {
    for (const sub of PET_SUBROUTES) {
      expect(petSubrouteHref("p123", sub)).toBe(`/dashboard/pets/p123/${sub}`);
    }
  });

  it("classifies pet sub-route paths", () => {
    expect(isPetSubroutePath("/dashboard/pets")).toBeNull();
    expect(isPetSubroutePath(petHref("p1"))).toBeNull();
    expect(isPetSubroutePath("/dashboard/pets/p1/documents")).toEqual({
      petId: "p1",
      subroute: "documents",
    });
    expect(isPetSubroutePath("/dashboard/pets/p1/bogus")).toBeNull();
  });
});
