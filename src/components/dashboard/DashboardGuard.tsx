"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ROUTES } from "@/lib/routes";

interface DashboardAuth {
  /** Owner identifier once Convex auth lands (magic link). Null while unknown. */
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

export function DashboardAuthProvider({ children }: { children: ReactNode }) {
  // TODO(convex): replace with Convex auth (useConvexAuth / owners.getMe).
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("petdocs-owner");
      setOwnerId(stored);
    } catch {
      setOwnerId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  function signOut() {
    try {
      window.localStorage.removeItem("petdocs-owner");
    } catch {
      /* noop */
    }
    setOwnerId(null);
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
