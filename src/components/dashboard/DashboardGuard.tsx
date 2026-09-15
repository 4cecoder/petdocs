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
  api,
  clearSession,
  getOwnerId,
  getSessionEmail,
  setSession,
} from "@/lib/api";
import { getSmartDestination, ROUTES } from "@/lib/routes";

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

  useEffect(() => {
    const currentOwner = readOwnerId();
    const email = getSessionEmail();

    if (!currentOwner && email) {
      // Auto-recover session from stored email
      setLoading(true);
      api.auth
        .directSignIn(email)
        .then((res) => {
          if (res.ok) {
            setSession(email, res.ownerId);
            setOwnerId(res.ownerId);
          }
        })
        .catch(() => {
          /* noop */
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setOwnerId(currentOwner);
      setLoading(false);
    }
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
    if (!loading) {
      const redirect = getSmartDestination({
        isAuthenticated: !!ownerId,
        pathname,
      });
      if (redirect) {
        router.replace(redirect);
      }
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
