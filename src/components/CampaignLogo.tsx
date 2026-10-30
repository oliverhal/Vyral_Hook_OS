"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface CampaignLogoProps {
  logoUrl?: string | null;
  emoji: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { wrapper: "w-8 h-8", text: "text-sm", img: 32 },
  md: { wrapper: "w-10 h-10", text: "text-lg", img: 40 },
  lg: { wrapper: "w-14 h-14", text: "text-2xl", img: 56 },
};

export default function CampaignLogo({ logoUrl, emoji, name, size = "md", className }: CampaignLogoProps) {
  const s = sizes[size];
  if (logoUrl) {
    return (
      <div className={cn(s.wrapper, "rounded-xl overflow-hidden flex-shrink-0 bg-white border border-slate-100", className)}>
        <Image
          src={logoUrl}
          alt={name}
          width={s.img}
          height={s.img}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }
  return <span className={cn(s.text, "flex-shrink-0", className)}>{emoji}</span>;
}
