"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  CreditCard,
  Database,
  Lock,
  Mail,
  Plug,
  Send,
} from "lucide-react";
import { convexMutation, convexQuery } from "@/lib/convexHttp";
import { getSessionEmail } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

type MeRole = "owner" | "support" | "admin" | "superadmin";

interface Me {
  _id: string;
  email: string;
  name: string;
  role: MeRole;
  createdAt: number;
}

interface ResendStatus {
  keySet: boolean;
  fromSet: boolean;
  from?: string;
}

interface IntegrationsStatus {
  resend: ResendStatus;
  stripe: { keySet: boolean; webhookSecretSet: boolean };
  site: { siteUrl: string; convexDeployment: string };
  email: ResendStatus;
}

const RESEND_PATH = "/resend/inbound";
const STRIPE_PATH = "/stripe/webhook";

function StatusLine({ set, label }: { set: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          set ? "bg-green-600" : "bg-red-400"
        }`}
      />
      <span className="font-semibold">
        {label}: {set ? "Set" : "Missing"}
      </span>
    </span>
  );
}

export default function AdminIntegrationsPage() {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<IntegrationsStatus | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [toInput, setToInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const email = getSessionEmail();
    setAdminEmail(email);
    if (!email) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profile = await convexQuery<Me | null>("admin:getMe", {
          email,
        });
        if (cancelled) return;
        setMe(profile);
        if (profile && profile.role === "superadmin") {
          try {
            const s = await convexQuery<IntegrationsStatus>(
              "integrations:status",
              { adminEmail: email },
            );
            if (cancelled) return;
            setData(s);
          } catch {
            if (!cancelled)
              setDataError("Could not load integration status. Try again.");
          }
        }
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <p aria-live="polite" className="text-sm text-ink-soft">
          Checking access...
        </p>
      </div>
    );
  }

  if (!me || me.role !== "superadmin") {
    return (
      <div className="flex flex-col gap-4">
        <section
          aria-label="Restricted"
          className="mx-auto flex w-full max-w-md flex-col items-center rounded-2xl border border-ink/10 bg-white p-8 text-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream">
            <Lock className="h-5 w-5 text-ink-soft" aria-hidden="true" />
          </span>
          <h1 className="mt-3 font-display text-xl font-bold">
            Superadmin only.
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            This page shows keys and infra status for developers. Your vault is
            safe and sound.
          </p>
          <Link
            href={ROUTES.dashboard.root}
            className="mt-4 min-h-[48px] rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Back to dashboard
          </Link>
        </section>
      </div>
    );
  }

  async function handleCopy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
    } catch {
      setSendStatus("Copy failed. Select the text manually.");
    }
  }

  async function handleSendTest() {
    if (!adminEmail || sending) return;
    const to = toInput.trim();
    if (!to) {
      setSendStatus("Enter a recipient address first.");
      return;
    }
    setSending(true);
    setSendStatus(null);
    try {
      await convexMutation<{ ok: boolean }>("integrations:sendTestEmail", {
        adminEmail,
        to,
      });
      setSendStatus("Test email queued. Check the inbox in a minute.");
    } catch {
      setSendStatus("Could not queue that test. Check the address.");
    } finally {
      setSending(false);
    }
  }

  const resendReady = !!data && data.resend.keySet && data.resend.fromSet;

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-2xl border border-ink/10 bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cream">
            <Plug className="h-5 w-5 text-ink" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold">Integrations</h1>
            <p className="mt-0.5 text-sm text-ink-soft">
              Infra status for developers. Keys stay on the server.
            </p>
          </div>
        </div>
        <div className="mt-3">
          <Link
            href="/dashboard/admin"
            className="inline-flex min-h-[48px] items-center rounded-xl border border-ink/15 bg-white px-4 text-sm font-semibold hover:bg-cream-dark"
          >
            Back to product admin
          </Link>
        </div>
      </header>

      {dataError ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {dataError}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section
          aria-label="Resend"
          className="rounded-2xl border border-ink/10 bg-white p-4"
        >
          <h2 className="flex items-center gap-2 font-display font-bold">
            <Mail className="h-4 w-4 text-ink-soft" aria-hidden="true" />
            Resend
          </h2>
          {data == null ? (
            <p className="mt-1 text-sm text-ink-soft">Loading status...</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5">
              <StatusLine set={data.resend.keySet} label="API key" />
              <StatusLine set={data.resend.fromSet} label="Sender" />
              <p className="text-sm text-ink-soft">
                {resendReady
                  ? `Sending as ${data.resend.from}. Magic links and reminders are live.`
                  : "Add the missing value in Convex env, then reload."}
              </p>
              <a
                href="https://resend.com/emails"
                target="_blank"
                rel="noreferrer"
                className="mt-1 text-sm font-semibold text-brand-700 underline"
              >
                Open Resend dashboard
              </a>
            </div>
          )}
        </section>

        <section
          aria-label="Stripe"
          className="rounded-2xl border border-ink/10 bg-white p-4"
        >
          <h2 className="flex items-center gap-2 font-display font-bold">
            <CreditCard className="h-4 w-4 text-ink-soft" aria-hidden="true" />
            Stripe
          </h2>
          {data == null ? (
            <p className="mt-1 text-sm text-ink-soft">Loading status...</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5">
              <StatusLine set={data.stripe.keySet} label="Secret key" />
              <StatusLine
                set={data.stripe.webhookSecretSet}
                label="Webhook secret"
              />
              <p className="text-sm text-ink-soft">
                Billing is not live yet. Keys are checked so webhook setup can
                proceed.
              </p>
              <a
                href="https://dashboard.stripe.com/"
                target="_blank"
                rel="noreferrer"
                className="mt-1 text-sm font-semibold text-brand-700 underline"
              >
                Open Stripe dashboard
              </a>
            </div>
          )}
        </section>

        <section
          aria-label="Convex"
          className="rounded-2xl border border-ink/10 bg-white p-4"
        >
          <h2 className="flex items-center gap-2 font-display font-bold">
            <Database className="h-4 w-4 text-ink-soft" aria-hidden="true" />
            Convex
          </h2>
          {data == null ? (
            <p className="mt-1 text-sm text-ink-soft">Loading status...</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5">
              <p className="text-sm">
                <span className="font-semibold">Deployment:</span>{" "}
                {data.site.convexDeployment}
              </p>
              <p className="text-sm text-ink-soft">
                Dev serves local work. Prod-like serves the live app.
              </p>
              <a
                href="https://dashboard.convex.dev/"
                target="_blank"
                rel="noreferrer"
                className="mt-1 text-sm font-semibold text-brand-700 underline"
              >
                Open Convex dashboard
              </a>
            </div>
          )}
        </section>

        <section
          aria-label="Site"
          className="rounded-2xl border border-ink/10 bg-white p-4"
        >
          <h2 className="flex items-center gap-2 font-display font-bold">
            <Plug className="h-4 w-4 text-ink-soft" aria-hidden="true" />
            Site
          </h2>
          {data == null ? (
            <p className="mt-1 text-sm text-ink-soft">Loading status...</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5">
              <p className="break-all text-sm">
                <span className="font-semibold">Site URL:</span>{" "}
                {data.site.siteUrl}
              </p>
              <p className="text-sm text-ink-soft">
                Used for magic links and reminder buttons.
              </p>
            </div>
          )}
        </section>
      </div>

      <section
        aria-label="Webhooks"
        className="rounded-2xl border border-ink/10 bg-white p-4"
      >
        <h2 className="font-display font-bold">Webhooks</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Prefix each path with your Convex HTTP Actions URL from the Convex
          dashboard. Copy the path, then paste it after that base URL.
        </p>
        <ul className="mt-2 flex flex-col gap-2">
          {[
            { key: "resend", label: "Resend inbound", path: RESEND_PATH },
            {
              key: "stripe",
              label: "Stripe webhook (planned)",
              path: STRIPE_PATH,
            },
          ].map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="font-semibold">{row.label}</p>
                <p className="truncate font-mono text-xs text-ink-soft">
                  {row.path}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopy(row.path, row.key)}
                className="inline-flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-xl border border-ink/15 bg-white px-4 text-sm font-semibold hover:bg-cream-dark"
              >
                {copied === row.key ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" aria-hidden="true" /> Copy path
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-label="Test email"
        className="rounded-2xl border border-ink/10 bg-white p-4"
      >
        <h2 className="flex items-center gap-2 font-display font-bold">
          <Send className="h-4 w-4 text-ink-soft" aria-hidden="true" />
          Test email
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Sends a small test message through Resend to confirm delivery.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            placeholder="you@yourdomain.com"
            aria-label="Test recipient"
            autoComplete="email"
            className="min-h-[48px] flex-1 rounded-xl border border-ink/15 bg-white px-3 text-sm"
          />
          <button
            type="button"
            onClick={handleSendTest}
            disabled={sending || !toInput.trim()}
            className="min-h-[48px] rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send test"}
          </button>
        </div>
        <p aria-live="polite" className="mt-2 min-h-[20px] text-sm font-medium text-brand-700">
          {sendStatus ?? ""}
        </p>
      </section>
    </div>
  );
}
