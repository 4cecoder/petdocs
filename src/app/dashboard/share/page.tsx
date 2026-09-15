"use client";

import { useEffect, useState } from "react";
import { PetArt } from "@/components/art/PetArt";
import { ApartmentPacket } from "@/components/share/ApartmentPacket";
import {
  api,
  getOwnerId,
  type EmailPassportResult,
  type Pet,
  type ShareEmail,
  type ShareLink,
} from "@/lib/api";
import { passportHref } from "@/lib/routes";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatExpiry(expiresAt?: number): string {
  if (expiresAt == null) return "No expiry";
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return "No expiry";
  return `Expires ${d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })}`;
}

function formatSentAt(createdAt: number): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Owner manages active share links (grouped per pet), emails a pet
 * passport (#39), and reviews the send history. Apartment packet below.
 */
export default function SharePage() {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [linksByPet, setLinksByPet] = useState<Record<string, ShareLink[]>>({});
  const [emails, setEmails] = useState<ShareEmail[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Email-passport form state (#39).
  const [emailPetId, setEmailPetId] = useState<string>("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<EmailPassportResult | null>(null);

  useEffect(() => {
    const id = getOwnerId();
    setOwnerId(id);
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const owned = await api.pets.list(id);
        if (cancelled) return;
        setPets(owned);
        if (owned.length > 0) setEmailPetId((cur) => cur || owned[0]._id);
        const entries = await Promise.all(
          owned.map(async (pet) => {
            try {
              const links = await api.share.listByPet(id, pet._id);
              return [pet._id, links.filter((l) => l.isActive)] as const;
            } catch {
              return [pet._id, []] as const;
            }
          }),
        );
        if (cancelled) return;
        setLinksByPet(Object.fromEntries(entries));
        try {
          const history = await api.share.listEmails(id);
          if (!cancelled) setEmails(history);
        } catch {
          if (!cancelled) setEmails([]);
        }
      } catch {
        if (!cancelled) {
          setLinksByPet({});
          setEmails([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshLinks() {
    if (!ownerId) return;
    try {
      const entries = await Promise.all(
        pets.map(async (pet) => {
          try {
            const links = await api.share.listByPet(ownerId, pet._id);
            return [pet._id, links.filter((l) => l.isActive)] as const;
          } catch {
            return [pet._id, []] as const;
          }
        }),
      );
      setLinksByPet(Object.fromEntries(entries));
    } catch {
      /* keep current view */
    }
  }

  async function refreshEmails() {
    if (!ownerId) return;
    try {
      setEmails(await api.share.listEmails(ownerId));
    } catch {
      /* keep current view */
    }
  }

  async function handleRevoke(linkId: string, petId: string) {
    if (!ownerId || revokingId) return;
    setRevokingId(linkId);
    try {
      await api.share.revoke(ownerId, linkId);
      setLinksByPet((prev) => ({
        ...prev,
        [petId]: (prev[petId] ?? []).filter((l) => l._id !== linkId),
      }));
    } catch {
      /* keep the link visible when revoke fails */
    } finally {
      setRevokingId(null);
    }
  }

  async function handleEmailPassport(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerId || sending || !emailPetId) return;
    setSendError(null);
    setSendResult(null);
    const email = recipientEmail.trim();
    if (!EMAIL_RE.test(email)) {
      setSendError("Enter a valid email address.");
      return;
    }
    setSending(true);
    try {
      const result = await api.share.emailPassport({
        ownerId,
        petId: emailPetId,
        recipientEmail: email,
        ...(note.trim() ? { note: note.trim() } : {}),
        origin: window.location.origin,
      });
      setSendResult(result);
      if (!result.ok) return;
      setRecipientEmail("");
      setNote("");
      await Promise.all([refreshEmails(), refreshLinks()]);
    } catch {
      setSendError("Couldn't send the email. Try again.");
    } finally {
      setSending(false);
    }
  }

  const petsWithLinks = pets.filter((p) => (linksByPet[p._id] ?? []).length > 0);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-4">
        <PetArt name="link" size={72} />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-2xl font-bold">Shared links</h1>
          <p className="text-sm font-semibold text-brand-700">
            Share the love, safely.
          </p>
          <p className="text-sm text-ink-soft">
            One link per recipient. Revoke one without breaking others.
          </p>
        </div>
      </header>

      <section
        aria-label="Email a passport"
        className="rounded-2xl border border-ink/10 bg-white p-4"
      >
        <h2 className="font-display text-xl font-bold">Email a passport</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Send a read-only passport link with a QR code straight to a vet,
          groomer, or landlord.
        </p>
        {pets.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">
            Add a pet first — then email their passport from here.
          </p>
        ) : (
          <form onSubmit={handleEmailPassport} className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="email-pet" className="text-sm font-medium">
                Pet
              </label>
              <select
                id="email-pet"
                value={emailPetId}
                onChange={(e) => setEmailPetId(e.target.value)}
                className="min-h-[48px] rounded-xl border border-ink/15 bg-cream px-3 text-sm"
              >
                {pets.map((pet) => (
                  <option key={pet._id} value={pet._id}>
                    {pet.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="email-recipient" className="text-sm font-medium">
                Recipient email
              </label>
              <input
                id="email-recipient"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="vet@clinic.example"
                autoComplete="email"
                className="min-h-[48px] w-full rounded-xl border border-ink/15 bg-cream px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="email-note" className="text-sm font-medium">
                Note (optional)
              </label>
              <textarea
                id="email-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="For Maple&#39;s grooming visit on Friday"
                className="rounded-xl border border-ink/15 bg-cream px-3 py-2.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send passport email"}
            </button>
            {sendError ? (
              <p role="alert" className="text-sm font-medium text-red-700">
                {sendError}
              </p>
            ) : null}
            {sendResult && sendResult.ok ? (
              <div role="status" aria-live="polite" className="flex flex-col gap-1">
                {sendResult.delivered ? (
                  <p className="text-sm font-bold text-brand-700">
                    Sent! {sendResult.reused ? "Reused" : "Created"} a passport
                    link for this pet.
                  </p>
                ) : (
                  <p className="text-sm font-medium text-red-700">
                    Link ready, but the email didn&apos;t go out:{" "}
                    {sendResult.deliveryError ?? "sending failed."}
                  </p>
                )}
                <p className="truncate text-xs text-ink-soft">
                  Passport link:{" "}
                  <a
                    href={passportHref(sendResult.token)}
                    className="font-medium text-brand-700 underline"
                  >
                    /p/{sendResult.token.slice(0, 8)}…
                  </a>
                </p>
              </div>
            ) : null}
          </form>
        )}
      </section>

      <section
        aria-label="Email history"
        className="rounded-2xl border border-ink/10 bg-white p-4"
      >
        <h2 className="font-display text-xl font-bold">Email history</h2>
        {emails === null ? (
          <p aria-live="polite" className="mt-2 text-sm text-ink-soft">
            Loading history…
          </p>
        ) : emails.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No passport emails yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {emails.map((row) => (
              <li
                key={row._id}
                className="flex items-start justify-between gap-3 rounded-xl bg-cream px-3 py-2.5"
              >
                <div className="min-w-0 text-sm">
                  <p className="truncate font-semibold">{row.recipientEmail}</p>
                  <p className="truncate text-xs text-ink-soft">
                    {row.petName} · {formatSentAt(row.createdAt)}
                    {row.note ? ` · “${row.note}”` : ""}
                  </p>
                  {row.status === "failed" && row.error ? (
                    <p className="mt-0.5 truncate text-xs font-medium text-red-700">
                      {row.error}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      row.status === "sent"
                        ? "bg-brand-600/10 text-brand-700"
                        : "bg-red-600/10 text-red-700"
                    }`}
                  >
                    {row.status === "sent" ? "Sent" : "Failed"}
                  </span>
                  <span className="text-xs text-ink-soft">
                    Link {row.linkActive ? "active" : "revoked"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label="Active share links"
        className="rounded-2xl border border-ink/10 bg-white p-4"
      >
      {loading ? (
        <p aria-live="polite" className="text-sm text-ink-soft">
          Loading links…
        </p>
      ) : petsWithLinks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-8 text-center text-sm text-ink-soft">
          <PetArt name="sleepy" size={120} className="mx-auto" />
          <p className="mt-3">
            No active links yet. Email a passport above or create one from a
            pet&apos;s profile.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {petsWithLinks.map((pet) => (
            <section
              key={pet._id}
              aria-label={`${pet.name}'s links`}
              className="rounded-2xl border border-ink/10 bg-white p-4"
            >
              <h2 className="font-display font-bold">{pet.name}</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {(linksByPet[pet._id] ?? []).map((link) => (
                  <li
                    key={link._id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2.5"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-semibold">
                        {link.label || "Passport link"}
                      </p>
                      <p className="truncate text-xs text-ink-soft">
                        <a
                          href={passportHref(link.token)}
                          className="font-medium text-brand-700 underline"
                        >
                          /p/{link.token.slice(0, 8)}…
                        </a>{" "}
                        · {formatExpiry(link.expiresAt)} · {link.viewCount}{" "}
                        {link.viewCount === 1 ? "view" : "views"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevoke(link._id, pet._id)}
                      disabled={revokingId === link._id}
                      className="min-h-[48px] shrink-0 rounded-xl border border-ink/15 bg-white px-4 text-sm font-semibold hover:bg-cream-dark disabled:opacity-60"
                    >
                      {revokingId === link._id ? "Revoking…" : "Revoke"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      </section>

      <section aria-label="Apartment packet" className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-bold">Apartment packet</h2>
        <p className="text-sm text-ink-soft">
          A printable pet resume for rental applications.
        </p>
        {/* TODO(convex): wire pets.get + vaccinations.listByPet, replace DEMO props below. */}
        <ApartmentPacket
          petName="Mochi"
          species="dog"
          breed="Shiba Inu"
          birthdate="2021-04-12"
          weightKg={9}
          microchipLast4="1234"
          spayNeuter={true}
          vaccines={[
            { name: "Rabies", status: "valid", administeredAt: "2025-06-01" },
            { name: "DHPP", status: "valid", administeredAt: "2025-06-01" },
            { name: "Bordetella", status: "expiring" },
          ]}
        />
      </section>
    </div>
  );
}
