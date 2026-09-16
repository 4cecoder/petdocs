export type DemoAccount = {
  email: string;
  label: string;
  description: string;
  next: string;
};

/**
 * These accounts are created by convex/seed.ts. They are intentionally
 * presented only as local development shortcuts; the button still uses the
 * normal magic-link request and verification flow.
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "maya@demo.pet",
    label: "Maya · pet parent",
    description: "Mochi + Udon vault",
    next: "/dashboard/pets",
  },
  {
    email: "sam@demo.pet",
    label: "Sam · pet parent",
    description: "Pickle vault",
    next: "/dashboard/pets",
  },
  {
    email: "auditor@demo.pet",
    label: "Auditor",
    description: "Read-only operations view",
    next: "/dashboard/admin",
  },
  {
    email: "support@demo.pet",
    label: "Support",
    description: "Inbox, owners + link support",
    next: "/dashboard/admin",
  },
  {
    email: "manager@demo.pet",
    label: "Manager",
    description: "Owner role + claim review",
    next: "/dashboard/admin",
  },
  {
    email: "owner@demo.pet",
    label: "Team owner",
    description: "Staff access management",
    next: "/dashboard/admin",
  },
  {
    email: "superadmin@demo.pet",
    label: "Superadmin",
    description: "Integrations + all controls",
    next: "/dashboard/admin/integrations",
  },
];

export function isLocalDemoHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}
