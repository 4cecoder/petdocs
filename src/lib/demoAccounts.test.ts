import { describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS, isLocalDemoHost } from "./demoAccounts";

describe("demo accounts", () => {
  it("covers the seeded pet and staff roles", () => {
    expect(DEMO_ACCOUNTS.map((account) => account.email)).toEqual([
      "maya@demo.pet",
      "sam@demo.pet",
      "auditor@demo.pet",
      "support@demo.pet",
      "manager@demo.pet",
      "owner@demo.pet",
      "superadmin@demo.pet",
    ]);
  });

  it("only enables the local shortcut hostnames", () => {
    expect(isLocalDemoHost("localhost")).toBe(true);
    expect(isLocalDemoHost("127.0.0.1")).toBe(true);
    expect(isLocalDemoHost("demo.petdocs.seridian.dev")).toBe(false);
  });
});
