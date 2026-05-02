"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone, PlusCircle, Users, Archive, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/archive", label: "Archive", icon: Archive },
  { href: "/admin/team", label: "Team", icon: Users },
  { href: "/help", label: "How it works", icon: BookOpen },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-[#0a0a0a] flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-baseline gap-0">
          <span
            className="text-white text-xl leading-none"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontWeight: 400 }}
          >
            Vyral
          </span>
          <span
            className="text-white text-xl leading-none font-black ml-1.5"
            style={{ fontFamily: "Inter, system-ui, sans-serif" }}
          >
            labs
          </span>
          <span className="w-2 h-2 bg-blue-600 rounded-sm ml-0.5 mb-0.5 inline-block" />
        </div>
        <div className="text-white/30 text-xs mt-1 font-medium tracking-widest uppercase">Hook OS</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150",
                active
                  ? "bg-blue-600 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-white/10">
        <Link
          href="/campaigns/new"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/10 transition-colors duration-150"
        >
          <PlusCircle className="w-4 h-4 flex-shrink-0" />
          New Campaign
        </Link>
        <div className="mt-4 px-3">
          <div className="text-xs text-white/20">
            Weekly deadline:{" "}
            <span className="text-white/40 font-medium">Mon 6pm</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
