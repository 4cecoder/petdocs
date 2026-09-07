import { describe, expect, it } from "vitest";
import { validateDocUpload, validatePetName } from "./validators";

describe("validators", () => {
  it("accepts PDF and photos under 10MB", () => {
    expect(
      validateDocUpload({ mime: "application/pdf", size: 1024 }),
    ).toBeNull();
    expect(validateDocUpload({ mime: "image/jpeg", size: 5_000_000 })).toBeNull();
  });

  it("rejects executables, empty, and oversized files", () => {
    expect(
      validateDocUpload({ mime: "application/x-sh", size: 10 }),
    ).not.toBeNull();
    expect(validateDocUpload({ mime: "image/png", size: 0 })).not.toBeNull();
    expect(
      validateDocUpload({ mime: "image/png", size: 11 * 1024 * 1024 }),
    ).not.toBeNull();
  });

  it("requires a pet name", () => {
    expect(validatePetName("  ")).not.toBeNull();
    expect(validatePetName("Mochi")).toBeNull();
  });
});
