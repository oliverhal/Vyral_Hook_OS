"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { avatarColor, initials } from "./artieTypes";

// Profile picture with a coloured-initials fallback (no photo, or the image fails to load).
export default function ArtieAvatar({ name, url, size = 40, className }: { name: string; url: string | null; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <Image src={url} alt={name} width={size} height={size} onError={() => setFailed(true)}
        className={cn("rounded-full object-cover flex-shrink-0 bg-slate-100", className)} style={{ width: size, height: size }} />
    );
  }
  return (
    <div className={cn("rounded-full flex items-center justify-center text-white font-bold flex-shrink-0", avatarColor(name), className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>{initials(name)}</div>
  );
}
