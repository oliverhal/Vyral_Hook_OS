"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const COLOR_BG: Record<string, string> = {
  blue: "bg-blue-500", violet: "bg-violet-500", emerald: "bg-emerald-500",
  orange: "bg-orange-500", pink: "bg-pink-500", teal: "bg-teal-500",
  yellow: "bg-yellow-500", red: "bg-red-500", slate: "bg-slate-500",
};

interface UserAvatarProps {
  name: string;
  color: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  xs: { wrapper: "w-5 h-5", text: "text-[9px]",  img: 20 },
  sm: { wrapper: "w-7 h-7", text: "text-[11px]", img: 28 },
  md: { wrapper: "w-9 h-9", text: "text-sm",     img: 36 },
  lg: { wrapper: "w-12 h-12", text: "text-base", img: 48 },
};

export default function UserAvatar({ name, color, avatarUrl, size = "md", className }: UserAvatarProps) {
  const s = SIZES[size];
  const bg = COLOR_BG[color] ?? "bg-slate-500";

  if (avatarUrl) {
    return (
      <div className={cn(s.wrapper, "rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white", className)}>
        <Image src={avatarUrl} alt={name} width={s.img} height={s.img} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={cn(s.wrapper, "rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-white", bg, className)}>
      <span className={cn("font-bold text-white leading-none", s.text)}>{name.charAt(0).toUpperCase()}</span>
    </div>
  );
}
