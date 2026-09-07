"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      console.error(
        "[ConvexClientProvider] NEXT_PUBLIC_CONVEX_URL is not set — rendering without a Convex client. Run `bunx convex dev` to provision a deployment, then restart the dev server.",
      );
      return null;
    }
    return new ConvexReactClient(url);
  }, []);

  if (!client) return <>{children}</>;

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
