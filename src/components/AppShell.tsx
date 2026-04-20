"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated" && pathname !== "/login") {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [status, pathname, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex items-baseline gap-0">
          <span
            className="text-white text-2xl animate-pulse"
            style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
          >
            Vyral
          </span>
          <span className="text-white text-2xl font-black ml-1.5 animate-pulse">labs</span>
          <span className="w-2 h-2 bg-blue-600 rounded-sm ml-0.5 mb-0.5 inline-block animate-pulse" />
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 min-h-screen bg-slate-50">
        {children}
      </main>
    </div>
  );
}
