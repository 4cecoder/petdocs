"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import SharePanel from "../panels/SharePanel";
import { ROUTES } from "@/lib/routes";
import { usePetWorkspace } from "../workspace";

/**
 * Share tool at /dashboard/pets/[petId]/share.
 * The 3-step passport-link wizard. Link management (views, revoke,
 * email-a-passport) lives on the global /dashboard/share page — this page
 * only creates and copies a fresh link for this pet.
 */
export default function PetSharePage() {
  const ws = usePetWorkspace();

  return (
    <div className="flex flex-col gap-4">
      <SharePanel petId={ws.petId} petName={ws.pet.name} />
      <Link
        href={ROUTES.dashboard.share}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
      >
        <ExternalLink size={14} aria-hidden="true" />
        Manage all share links (views, revoke, email)
      </Link>
    </div>
  );
}
