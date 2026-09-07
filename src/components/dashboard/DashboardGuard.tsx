"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { clearSession, getOwnerId, getSessionEmail } from "@/lib/api";
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
 * count — they redirect to sign-in instead of leaking into the dashboard.
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
  // localStorage is synchronous, so the session resolves during the initial
  // render — no effect-delay flash on the client. `loading` is true only
  // during SSR (window undefined), before hydration can read the session.
  const [ownerId, setOwnerId] = useState<string | null>(() => readOwnerId());
  const [loading, setLoading] = useState<boolean>(
    () => typeof window === "undefined",
  );

  useEffect(() => {
    // Safety re-sync: storage may have changed between render and effect
    // (e.g. sign-in in another tab just before navigation here).
    setOwnerId(readOwnerId());
    setLoading(false);
  }, []);

  function signOut() {
    clearSession();
    setOwnerId(null);
    router.replace(ROUTES.home);
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
          Checking your session… 🐾
        </p>
      </main>
    );
  }

  if (!ownerId) return null;
  return <>{children}</>;
}
