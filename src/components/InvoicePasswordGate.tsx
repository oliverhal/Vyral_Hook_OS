"use client";

import { useSession } from "next-auth/react";
import { Lock } from "lucide-react";

const ALLOWED = ["Ethan Dichoso", "Oliver Barnes"];

export default function InvoicePasswordGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  const name = (session?.user as { name?: string })?.name ?? "";
  if (ALLOWED.includes(name)) return <>{children}</>;

  return (
    <div className="flex-1 min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="card p-8 w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
            <Lock className="w-5 h-5 text-red-500" />
          </div>
        </div>
        <h1 className="text-lg font-bold text-slate-900 mb-1">Access restricted</h1>
        <p className="text-sm text-slate-400">This section is only available to authorised Vyral team members.</p>
      </div>
    </div>
  );
}
