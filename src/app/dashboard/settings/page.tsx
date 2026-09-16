"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  CreditCard,
  Download,
  Lock,
  Mail,
  Phone,
  Shield,
  Smartphone,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { clearSession, getOwnerId, getSessionEmail } from "@/lib/api";
import {
  convexMutation,
  convexQuery,
  getConvexUrl,
} from "@/lib/convexHttp";
import {
  COUNTRY_CODES,
  formatFullPhone,
  formatNationalPhone,
  parseStoredPhone,
  ProfileFormSchema,
} from "@/lib/phoneValidation";
import { ROUTES } from "@/lib/routes";

interface OwnerProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  createdAt: number;
}

interface MobileBuild {
  platform: "android" | "ios";
  version: string;
  sha256: string;
  notes?: string;
  createdAt: number;
}

interface LatestMobileBuilds {
  android: MobileBuild | null;
  ios: MobileBuild | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const ownerId = getOwnerId();
  const sessionEmail = getSessionEmail() || "";

  const [nameInput, setNameInput] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [nationalNumber, setNationalNumber] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Notification toggles
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(true);
  const [inAppNotifs, setInAppNotifs] = useState(true);

  // Export / Data
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Mobile app builds (#42): latest published packages per platform.
  const [mobileBuilds, setMobileBuilds] = useState<LatestMobileBuilds | null>(
    null,
  );
  const [mobileBuildsFailed, setMobileBuildsFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    convexQuery<LatestMobileBuilds>("apkBuilds:latest", {})
      .then((data) => {
        if (!cancelled) setMobileBuilds(data);
      })
      .catch(() => {
        if (!cancelled) setMobileBuildsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ownerId) return;
    convexQuery<OwnerProfile | null>("ownership:getOwner", { ownerId })
      .then((data) => {
        if (data) {
          setNameInput(data.name || "");
          const parsed = parseStoredPhone(data.phone);
          setCountryCode(parsed.countryCode);
          setNationalNumber(
            formatNationalPhone(parsed.countryCode, parsed.nationalNumber),
          );
        }
      })
      .catch(() => {
        /* noop */
      });
  }, [ownerId]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerId || savingProfile) return;

    setPhoneError(null);
    setNameError(null);

    // Zod validation
    const validation = ProfileFormSchema.safeParse({
      name: nameInput,
      phone: {
        countryCode,
        nationalNumber,
      },
    });

    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;
      if (fieldErrors.name?.[0]) setNameError(fieldErrors.name[0]);
      if (validation.error.format().phone?.nationalNumber?._errors?.[0]) {
        setPhoneError(
          validation.error.format().phone?.nationalNumber?._errors[0] ||
            "Invalid phone format",
        );
      }
      return;
    }

    const formattedPhone = formatFullPhone(countryCode, nationalNumber);

    setSavingProfile(true);
    setProfileSaved(false);
    try {
      await convexMutation("ownership:updateProfile", {
        ownerId,
        name: nameInput.trim(),
        phone: formattedPhone,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch {
      /* noop */
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleExport() {
    if (!ownerId || exporting) return;
    setExporting(true);
    setExportError(null);
    setExportDone(false);
    try {
      const data = await convexQuery<unknown>("privacy:exportData", {
        ownerId,
      });
      const date = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `petdocs-export-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportDone(true);
    } catch (e) {
      setExportError(
        e instanceof Error ? e.message : "Export failed. Try again.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!ownerId || deleting) return;
    const typed = confirmEmail.trim();
    if (!typed) {
      setDeleteError("Type your email to confirm deletion.");
      return;
    }
    if (
      !window.confirm(
        "Delete your account and all pet data? This cannot be undone.",
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        "Final check: delete everything including pets, documents, and share links?",
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await convexMutation("privacy:deleteAccount", {
        ownerId,
        confirmEmail: typed,
      });
      clearSession();
      router.replace(ROUTES.home);
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Delete failed. Try again.",
      );
      setDeleting(false);
    }
  }

  const initials = (nameInput || sessionEmail || "PO")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-6 pb-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Manage your pet parent profile, notifications, and subscription.
        </p>
      </div>

      {/* 1. Profile Section */}
      <section
        aria-label="Profile"
        className="rounded-2xl border border-ink/10 bg-white p-6 shadow-xs"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={18} className="text-brand-600" />
            <h2 className="font-display text-lg font-bold text-ink">Profile</h2>
          </div>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
            Pet Parent
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          Your profile display name and contact details across PetDocs.
        </p>

        <form onSubmit={handleSaveProfile} className="mt-5 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-100 font-display text-lg font-bold text-brand-800">
              {initials}
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-ink-soft">
                Display Name
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your Name"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-ink/15 bg-cream px-3.5 text-sm font-medium focus:border-brand-500 focus:bg-white focus:outline-none"
              />
              {nameError && (
                <p role="alert" className="mt-1 text-xs font-semibold text-red-600">
                  {nameError}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-ink-soft">
                Email Address
              </label>
              <div className="mt-1 flex min-h-[44px] items-center gap-2 rounded-xl border border-ink/10 bg-ink/5 px-3.5 text-sm text-ink-soft">
                <Mail size={16} />
                <span className="truncate">{sessionEmail || "Not signed in"}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-soft">
                Mobile Number (SMS Alerts)
              </label>
              <div className="mt-1 flex min-h-[44px] items-center gap-1.5 rounded-xl border border-ink/15 bg-cream px-2 text-sm focus-within:border-brand-500 focus-within:bg-white">
                <select
                  aria-label="Country Code"
                  value={countryCode}
                  onChange={(e) => {
                    const nextCountryCode = e.target.value;
                    setCountryCode(nextCountryCode);
                    setNationalNumber(
                      formatNationalPhone(nextCountryCode, nationalNumber),
                    );
                  }}
                  className="rounded-lg bg-transparent py-1.5 pl-1.5 pr-1 text-xs font-medium text-ink focus:outline-none cursor-pointer"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code} ({c.country})
                    </option>
                  ))}
                </select>
                <div className="h-5 w-px bg-ink/10" />
                <Phone size={14} className="shrink-0 text-ink-soft ml-1" />
                <input
                  type="tel"
                  value={nationalNumber}
                  onChange={(e) =>
                    setNationalNumber(
                      formatNationalPhone(countryCode, e.target.value),
                    )
                  }
                  placeholder="(555) 000-0000"
                  className="w-full bg-transparent px-1 text-sm focus:outline-none"
                />
              </div>
              {phoneError && (
                <p role="alert" className="mt-1 text-xs font-semibold text-red-600">
                  {phoneError}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={savingProfile || !ownerId}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-xs hover:bg-brand-700 disabled:opacity-60"
            >
              {savingProfile ? "Saving…" : "Save changes"}
            </button>
            {profileSaved && (
              <p className="flex items-center gap-1 text-xs font-semibold text-brand-700">
                <Check size={14} /> Profile updated
              </p>
            )}
          </div>
        </form>
      </section>

      {/* 2. Notifications Section */}
      <section
        aria-label="Notifications"
        className="rounded-2xl border border-ink/10 bg-white p-6 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-brand-600" />
          <h2 className="font-display text-lg font-bold text-ink">
            Notifications
          </h2>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          Choose how you receive preventive care reminders and booster alerts.
        </p>

        <div className="mt-4 flex flex-col divide-y divide-ink/10">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-ink">
                Email Notifications
              </p>
              <p className="text-xs text-ink-soft">
                Vaccine expiration notices & monthly refill alerts
              </p>
            </div>
            <input
              type="checkbox"
              checked={emailNotifs}
              onChange={(e) => setEmailNotifs(e.target.checked)}
              className="h-5 w-5 accent-brand-600"
            />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-ink">
                SMS Text Alerts
              </p>
              <p className="text-xs text-ink-soft">
                Urgent booster warnings & sitter passport view alerts
              </p>
            </div>
            <input
              type="checkbox"
              checked={smsNotifs}
              onChange={(e) => setSmsNotifs(e.target.checked)}
              className="h-5 w-5 accent-brand-600"
            />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-ink">
                In-App Reminders
              </p>
              <p className="text-xs text-ink-soft">
                Health checklist updates & passport activity
              </p>
            </div>
            <input
              type="checkbox"
              checked={inAppNotifs}
              onChange={(e) => setInAppNotifs(e.target.checked)}
              className="h-5 w-5 accent-brand-600"
            />
          </div>
        </div>
      </section>

      {/* 3. Freemium Plan (Polar.sh) */}
      <section
        aria-label="Plan & Subscription"
        className="rounded-2xl border border-brand-200 bg-brand-50/40 p-6 shadow-xs"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-brand-600" />
            <h2 className="font-display text-lg font-bold text-ink">
              Plan & Membership
            </h2>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
            Active · Free 3-Month Trial
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          You are currently on the <strong>Early Adopter Freemium Plan</strong>.
          Every feature is 100% unlocked for free for the first 3 months.
        </p>

        <div className="mt-4 rounded-xl border border-brand-200/80 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-brand-900">PetDocs Plus</p>
              <p className="text-xs text-ink-soft">
                Unlimited pets, vault documents, SMS alerts & family sharing
              </p>
            </div>
            <p className="font-display text-lg font-bold text-brand-700">
              $0<span className="text-xs text-ink-soft"> / 90 days</span>
            </p>
          </div>
        </div>
      </section>

      {/* 4. Family & Sharing */}
      <section
        aria-label="Family Sharing"
        className="rounded-2xl border border-ink/10 bg-white p-6 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <Users size={18} className="text-brand-600" />
          <h2 className="font-display text-lg font-bold text-ink">
            Pet Family & Co-Parenting
          </h2>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          Invite family members, co-owners, or pet sitters to view and manage
          your pet records.
        </p>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-cream p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Family Access</p>
            <p className="text-xs text-ink-soft">
              Sitters get temporary view access; co-owners can edit records
            </p>
          </div>
          <Link
            href={ROUTES.dashboard.share}
            className="rounded-xl border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink hover:bg-ink/5"
          >
            Manage access &rarr;
          </Link>
        </div>
      </section>

      {/* 5. Document Trash & Storage */}
      <section
        aria-label="Storage & Trash"
        className="rounded-2xl border border-ink/10 bg-white p-6 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <Trash2 size={18} className="text-brand-600" />
          <h2 className="font-display text-lg font-bold text-ink">
            Document Trash
          </h2>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          Deleted medical files stay in trash for 30 days before being
          permanently purged.
        </p>
        <div className="mt-3">
          <Link
            href={ROUTES.dashboard.docs}
            className="inline-flex items-center text-xs font-semibold text-brand-700 underline"
          >
            Open Document Vault &rarr;
          </Link>
        </div>
      </section>

      {/* 6. Mobile apps (#42): latest beta builds per platform. */}
      <section
        aria-label="Mobile apps"
        className="rounded-2xl border border-ink/10 bg-white p-6 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <Smartphone size={18} className="text-brand-600" />
          <h2 className="font-display text-lg font-bold text-ink">
            Mobile apps
          </h2>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          Take the pet vault on the road. Install the latest beta build on
          your phone — the download is the newest package published by the
          team.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {/* Android: live beta build */}
          <div className="flex items-center justify-between rounded-xl bg-cream p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                PetDocs for Android
                {mobileBuilds?.android ? (
                  <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800">
                    v{mobileBuilds.android.version}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 truncate text-xs text-ink-soft">
                {mobileBuilds === null && !mobileBuildsFailed
                  ? "Checking for builds…"
                  : mobileBuilds?.android
                    ? `Published ${new Date(
                        mobileBuilds.android.createdAt,
                      ).toLocaleDateString()} · sha256 ${mobileBuilds.android.sha256.slice(0, 12)}…`
                    : mobileBuildsFailed
                      ? "Build info unavailable right now."
                      : "No build published yet."}
              </p>
            </div>
            {mobileBuilds?.android && getConvexUrl() ? (
              <a
                href={`${getConvexUrl()}/api/builds/latest?platform=android`}
                className="ml-3 inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-xs font-semibold text-white shadow-xs hover:bg-brand-700"
                download
              >
                <Download size={14} /> Download APK
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="ml-3 inline-flex min-h-[40px] shrink-0 cursor-not-allowed items-center gap-1.5 rounded-xl border border-ink/15 bg-white px-4 text-xs font-semibold text-ink-soft opacity-60"
              >
                <Download size={14} /> Unavailable
              </button>
            )}
          </div>

          {/* iOS: coming soon */}
          <div className="flex items-center justify-between rounded-xl bg-cream p-4">
            <div>
              <p className="text-sm font-semibold text-ink">
                PetDocs for iPhone &amp; iPad
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">
                Native iOS app is in development.
              </p>
            </div>
            <span className="ml-3 inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-ink/15 bg-white px-4 text-xs font-semibold text-ink-soft opacity-60">
              <Lock size={14} /> Coming soon
            </span>
          </div>
        </div>
      </section>

      {/* 7. Data Export & Privacy */}
      <section
        aria-label="Your Data"
        className="rounded-2xl border border-ink/10 bg-white p-6 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-brand-600" />
          <h2 className="font-display text-lg font-bold text-ink">
            Your Data & Export
          </h2>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          You own your pet data. Download a complete JSON archive of all pets,
          vaccinations, and documents at any time.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={!ownerId || exporting}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm font-semibold hover:bg-white disabled:opacity-60"
          >
            <Download size={16} />
            {exporting ? "Preparing export…" : "Export all my data (JSON)"}
          </button>
          {exportDone && (
            <p role="status" className="text-xs font-semibold text-emerald-700">
              ✓ Archive downloaded successfully.
            </p>
          )}
          {exportError && (
            <p role="alert" className="text-xs font-semibold text-red-600">
              {exportError}
            </p>
          )}
        </div>

        <div className="mt-6 border-t border-ink/10 pt-4">
          <h3 className="text-sm font-bold text-red-700">Delete Account</h3>
          <p className="mt-1 text-xs text-ink-soft">
            Permanently delete your profile and all medical records across all
            pets. This action cannot be reversed.
          </p>
          <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-ink-soft">
            Confirm your email to delete:
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="min-h-[44px] rounded-xl border border-ink/15 bg-cream px-3 text-sm text-ink"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={!ownerId || !confirmEmail.trim() || deleting}
            className="mt-3 min-h-[44px] rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? "Deleting account…" : "Delete my account and all data"}
          </button>
          {deleteError && (
            <p role="alert" className="mt-2 text-xs font-semibold text-red-600">
              {deleteError}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
