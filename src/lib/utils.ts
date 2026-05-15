import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isPast } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM yyyy")}`;
}

export function formatDeadline(deadline: Date): string {
  if (isPast(deadline)) return "Deadline passed";
  return `Due ${formatDistanceToNow(deadline, { addSuffix: true })}`;
}

export function isDeadlineSoon(deadline: Date): boolean {
  const hoursUntil = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntil > 0 && hoursUntil < 24;
}

export function isDeadlinePassed(deadline: Date): boolean {
  return isPast(deadline);
}

export const CAMPAIGN_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  violet: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    badge: "bg-violet-100 text-violet-700",
  },
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
  },
  orange: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    badge: "bg-orange-100 text-orange-700",
  },
  pink: {
    bg: "bg-pink-50",
    text: "text-pink-700",
    border: "border-pink-200",
    badge: "bg-pink-100 text-pink-700",
  },
  yellow: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
    badge: "bg-yellow-100 text-yellow-700",
  },
  teal: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    badge: "bg-teal-100 text-teal-700",
  },
  slate: {
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
    badge: "bg-slate-100 text-slate-700",
  },
};

function csvCell(value: string | null | undefined): string {
  const str = (value ?? "").replace(/"/g, '""');
  return `"${str}"`;
}

export interface ExportableHook {
  hookText: string;
  format: string;
  referenceVideo: string | null;
  aiCaption?: string | null;
  caption: string;
  recordingNotes: string | null;
  requiresAppFootage?: boolean;
  appFootageSource?: string | null;
  selectedOrder: number | null;
  source?: "experimental" | "validated";
}

export function generateCSV(
  hooks: ExportableHook[],
  hashtags?: string | null
): string {
  const sorted = [...hooks].sort((a, b) => (a.selectedOrder ?? 99) - (b.selectedOrder ?? 99));

  const rows: string[] = [];

  // Row 1: Hashtags block (matches the sheet's row 2 style)
  if (hashtags) {
    rows.push(csvCell(hashtags));
  }

  // Header row — exactly matching the Google Sheet columns
  rows.push(
    ["Hook (text on screen)", "Format", "Reference Vid:", "Captions (pls add your own hashtags)", "Notes:", "Requires App Footage", "App Footage Source"]
      .map(csvCell)
      .join(",")
  );

  // Data rows
  for (const h of sorted) {
    const caption = h.aiCaption || h.caption;
    rows.push(
      [h.hookText, h.format, h.referenceVideo ?? "", caption, h.recordingNotes ?? "", h.requiresAppFootage ? "Yes" : "", h.appFootageSource ?? ""]
        .map(csvCell)
        .join(",")
    );
  }

  return rows.join("\n");
}

export function generateSlackMessage(
  campaignName: string,
  clientName: string,
  weekStart: Date,
  hooks: ExportableHook[],
  sheetUrl?: string | null
): string {
  const sorted = [...hooks]
    .filter((h) => h.selectedOrder !== null)
    .sort((a, b) => (a.selectedOrder ?? 99) - (b.selectedOrder ?? 99));

  const weekRange = formatWeekRange(weekStart);

  const hookLines = sorted
    .map((h, i) => {
      const caption = h.aiCaption || h.caption;
      const sourceTag = h.source === "validated" ? " 🔥" : "";
      return `*Hook ${i + 1} (${h.format})${sourceTag}:* ${h.hookText}\n${caption}`;
    })
    .join("\n\n");

  const sheetLine = sheetUrl ? `\n📋 *Hook sheet:* ${sheetUrl}\n` : "";

  return `Hey! 👋 Here are your hooks for the week of ${weekRange}

*${clientName} — ${campaignName}*
${sheetLine}
${hookLines}

Let me know if you'd like any adjustments! 🚀`;
}
