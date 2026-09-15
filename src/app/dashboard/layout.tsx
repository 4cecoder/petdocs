import { ConvexClientProvider } from "../ConvexClientProvider";
import { QueryProvider } from "../QueryProvider";
import {
  DashboardAuthProvider,
  DashboardGuard,
} from "@/components/dashboard/DashboardGuard";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MobileBottomNav } from "@/components/nav/MobileBottomNav";
import { PetAssistantFab } from "@/components/assistant/PetAssistantFab";

/**
 * Shared shell for every `/dashboard/**` route. Auth is enforced here via
 * DashboardGuard so new pages cannot bypass login by omitting a local guard.
 */
export default function DashboardRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <QueryProvider>
      <ConvexClientProvider>
        <DashboardAuthProvider>
          <DashboardGuard>
            <DashboardLayout>{children}</DashboardLayout>
            <MobileBottomNav />
            <PetAssistantFab />
          </DashboardGuard>
        </DashboardAuthProvider>
      </ConvexClientProvider>
    </QueryProvider>
  );
}
