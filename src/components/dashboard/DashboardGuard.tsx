"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  clearSession,
  getOwnerId,
  getSessionEmail,
} from "@/lib/api";
import { ROUTES } from "@/lib/routes";

interface DashboardAuth {
  /** Owner id from the verified magic-link session. Null while signed out. */
  ownerId: string | null;
  loading: boolean;
  signOut: () => void;
}

const DashboardAuthContext = createContext<DashboardAuth>({
  ownerId: null,
  loading: true,
  signOut: () => {},
});

export function useDashboardAuth(): DashboardAuth {
  return useContext(DashboardAuthContext);
}

/**
 * Authenticated only when BOTH the session email and the owner id are
 * present. Legacy email-only entries (pre-magic-link demo scaffold) do not
 * count: they redirect to sign-in instead of leaking into the dashboard.
 */
function readOwnerId(): string | null {
  try {
    if (typeof window === "undefined") return null;
    if (!getSessionEmail()) return null;
    return getOwnerId();
  } catch {
    return null;
  }
}

export function DashboardAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ownerId, setOwnerId] = useState<string | null>(() => readOwnerId());
  const [loading, setLoading] = useState<boolean>(false);

  // Sync the stored session once on mount. No self-heal (#17): the old
  // directSignIn fallback let an email-only localStorage session regenerate
  // an ownerId without ever proving mailbox ownership. A session email
  // without a verified ownerId is signed out — it redirects to sign-in.
  useEffect(() => {
    setOwnerId(readOwnerId());
    setLoading(false);
  }, []);

  function signOut() {
    clearSession();
    setOwnerId(null);
    if (typeof window !== "undefined") {
      window.location.href = ROUTES.home;
    } else {
      router.replace(ROUTES.home);
    }
  }

  return (
    <DashboardAuthContext.Provider value={{ ownerId, loading, signOut }}>
      {children}
    </DashboardAuthContext.Provider>
  );
}

/**
 * Enforced in `dashboard/layout.tsx` so new pages cannot bypass login
 * by omitting a local guard.
 */
export function DashboardGuard({ children }: { children: ReactNode }) {
  const { ownerId, loading } = useDashboardAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !ownerId) {
      router.replace(`${ROUTES.signIn}?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, ownerId, router, pathname]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6">
        <p aria-live="polite" className="text-ink-soft">
          Checking your session…
        </p>
      </main>
    );
  }

  if (!ownerId) return null;
  return <>{children}</>;
}
