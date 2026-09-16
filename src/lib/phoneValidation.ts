import { z } from "zod";

export const COUNTRY_CODES = [
  { code: "+1", country: "US/CA", flag: "🇺🇸", label: "+1 (US/Canada)" },
  { code: "+44", country: "GB", flag: "🇬🇧", label: "+44 (UK)" },
  { code: "+61", country: "AU", flag: "🇦🇺", label: "+61 (Australia)" },
  { code: "+64", country: "NZ", flag: "🇳🇿", label: "+64 (New Zealand)" },
  { code: "+49", country: "DE", flag: "🇩🇪", label: "+49 (Germany)" },
  { code: "+33", country: "FR", flag: "🇫🇷", label: "+33 (France)" },
  { code: "+34", country: "ES", flag: "🇪🇸", label: "+34 (Spain)" },
  { code: "+39", country: "IT", flag: "🇮🇹", label: "+39 (Italy)" },
  { code: "+31", country: "NL", flag: "🇳🇱", label: "+31 (Netherlands)" },
  { code: "+353", country: "IE", flag: "🇮🇪", label: "+353 (Ireland)" },
  { code: "+81", country: "JP", flag: "🇯🇵", label: "+81 (Japan)" },
  { code: "+65", country: "SG", flag: "🇸🇬", label: "+65 (Singapore)" },
  { code: "+52", country: "MX", flag: "🇲🇽", label: "+52 (Mexico)" },
  { code: "+55", country: "BR", flag: "🇧🇷", label: "+55 (Brazil)" },
  { code: "+91", country: "IN", flag: "🇮🇳", label: "+91 (India)" },
  { code: "+27", country: "ZA", flag: "🇿🇦", label: "+27 (South Africa)" },
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number]["code"];

/**
 * Zod schema for validating phone numbers with country code.
 * Allows optional/empty values for users not registering a phone number.
 */
export const PhoneInputSchema = z.object({
  countryCode: z.string().regex(/^\+\d{1,4}$/, "Invalid country code"),
  nationalNumber: z
    .string()
    .trim()
    .refine(
      (val) => {
        if (!val) return true; // optional
        // Strip common delimiters
        const digits = val.replace(/[\s().-]/g, "");
        return digits.length >= 6 && digits.length <= 15 && /^\d+$/.test(digits);
      },
      {
        message: "Please enter a valid phone number (6-15 digits)",
      },
    ),
});

export const ProfileFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name must be 80 characters or fewer"),
  phone: PhoneInputSchema,
});

/**
 * Formats the national part of a phone number for the profile input.
 *
 * US/Canada numbers use the familiar `(555) 234-5678` shape. Other country
 * codes use readable three-digit groups without changing the value that is
 * ultimately stored by `formatFullPhone`.
 */
export function formatNationalPhone(
  countryCode: string,
  nationalNumber: string,
): string {
  let digits = nationalNumber.replace(/\D/g, "");
  const countryDigits = countryCode.replace(/\D/g, "");

  // Make pasting a full international number into the national field do the
  // unsurprising thing, while leaving ordinary local input untouched.
  if (nationalNumber.trim().startsWith("+") && digits.startsWith(countryDigits)) {
    digits = digits.slice(countryDigits.length);
  }
  if (countryCode === "+1" && digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  digits = digits.slice(0, 15);
  if (!digits) return "";

  if (countryCode === "+1") {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (countryCode === "+44") {
    return [digits.slice(0, 4), digits.slice(4)].filter(Boolean).join(" ");
  }

  return digits.match(/.{1,3}/g)?.join(" ") ?? "";
}

/**
 * Formats full E.164 phone number from country code + national number.
 */
export function formatFullPhone(countryCode: string, nationalNumber: string): string {
  const digits = nationalNumber.replace(/[\s().-]/g, "");
  if (!digits) return "";
  const code = countryCode.startsWith("+") ? countryCode : `+${countryCode}`;
  return `${code}${digits}`;
}

/**
 * Parses an existing stored E.164 or freeform phone number back into country code and national number.
 */
export function parseStoredPhone(phone?: string): { countryCode: string; nationalNumber: string } {
  if (!phone) return { countryCode: "+1", nationalNumber: "" };
  const trimmed = phone.trim();

  // Match known country code
  for (const item of COUNTRY_CODES) {
    if (trimmed.startsWith(item.code)) {
      return {
        countryCode: item.code,
        nationalNumber: trimmed.slice(item.code.length).trim(),
      };
    }
  }

  // Generic fallback if starts with +
  if (trimmed.startsWith("+")) {
    const match = trimmed.match(/^(\+\d{1,3})(.*)$/);
    if (match) {
      return { countryCode: match[1], nationalNumber: match[2].trim() };
    }
  }

  return { countryCode: "+1", nationalNumber: trimmed };
}
