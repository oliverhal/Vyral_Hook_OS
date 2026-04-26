"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ValidatedLibrary from "./ValidatedLibrary";
import type { Campaign } from "@/types";

export default function ValidatedLibraryPage({ campaign }: { campaign: Campaign }) {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        All Campaigns
      </Link>
      <ValidatedLibrary campaign={campaign} isAdmin={isAdmin} />
    </div>
  );
}
