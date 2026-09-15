import { describe, expect, it } from "vitest";
import {
  formatFullPhone,
  parseStoredPhone,
  PhoneInputSchema,
  ProfileFormSchema,
} from "./phoneValidation";

describe("phoneValidation", () => {
  it("validates empty national number as optional", () => {
    const res = PhoneInputSchema.safeParse({
      countryCode: "+1",
      nationalNumber: "",
    });
    expect(res.success).toBe(true);
  });

  it("validates valid national number", () => {
    const res = PhoneInputSchema.safeParse({
      countryCode: "+1",
      nationalNumber: "(555) 234-5678",
    });
    expect(res.success).toBe(true);
  });

  it("rejects too short or malformed national number", () => {
    const res = PhoneInputSchema.safeParse({
      countryCode: "+1",
      nationalNumber: "123",
    });
    expect(res.success).toBe(false);
  });

  it("validates profile schema with name and phone", () => {
    const res = ProfileFormSchema.safeParse({
      name: "Jamie Doe",
      phone: {
        countryCode: "+44",
        nationalNumber: "7911 123456",
      },
    });
    expect(res.success).toBe(true);
  });

  it("formats full E.164 phone string", () => {
    expect(formatFullPhone("+1", "(555) 234-5678")).toBe("+15552345678");
    expect(formatFullPhone("+44", " 7911-123456 ")).toBe("+447911123456");
    expect(formatFullPhone("+1", "")).toBe("");
  });

  it("parses stored phone number back to country code and national number", () => {
    expect(parseStoredPhone("+15552345678")).toEqual({
      countryCode: "+1",
      nationalNumber: "5552345678",
    });
    expect(parseStoredPhone("+447911123456")).toEqual({
      countryCode: "+44",
      nationalNumber: "7911123456",
    });
    expect(parseStoredPhone("")).toEqual({
      countryCode: "+1",
      nationalNumber: "",
    });
  });
});
