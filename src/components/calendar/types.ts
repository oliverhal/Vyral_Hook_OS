export interface CalendarClient {
  id: string;
  name: string;
  contractStart: string;
  contractEnd: string | null;
  firstPostDate: string | null;
  monthlyValue: number | null;
  notes: string | null;
  contractLink: string | null;
  color: string;
  source: string;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ClientColor = "violet" | "blue" | "emerald" | "orange" | "pink" | "yellow" | "teal" | "slate";

export const COLOR_OPTIONS: ClientColor[] = ["violet", "blue", "emerald", "orange", "pink", "yellow", "teal", "slate"];

export const COLOR_MAP: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  violet: { bg: "bg-violet-500/20", border: "border-violet-500/40", text: "text-violet-300", dot: "bg-violet-500" },
  blue: { bg: "bg-blue-500/20", border: "border-blue-500/40", text: "text-blue-300", dot: "bg-blue-500" },
  emerald: { bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-300", dot: "bg-emerald-500" },
  orange: { bg: "bg-orange-500/20", border: "border-orange-500/40", text: "text-orange-300", dot: "bg-orange-500" },
  pink: { bg: "bg-pink-500/20", border: "border-pink-500/40", text: "text-pink-300", dot: "bg-pink-500" },
  yellow: { bg: "bg-yellow-500/20", border: "border-yellow-500/40", text: "text-yellow-300", dot: "bg-yellow-500" },
  teal: { bg: "bg-teal-500/20", border: "border-teal-500/40", text: "text-teal-300", dot: "bg-teal-500" },
  slate: { bg: "bg-slate-500/20", border: "border-slate-500/40", text: "text-slate-300", dot: "bg-slate-500" },
};

export const COLOR_BAR: Record<string, string> = {
  violet: "bg-violet-500",
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  yellow: "bg-yellow-500",
  teal: "bg-teal-500",
  slate: "bg-slate-500",
};

export type ContractStatus = "active" | "ending_soon" | "ended" | "starting_soon";

export function getContractStatus(client: CalendarClient): ContractStatus {
  const now = new Date();
  const start = new Date(client.contractStart);
  const end = client.contractEnd ? new Date(client.contractEnd) : null;

  if (start > now) return "starting_soon";
  if (end && end < now) return "ended";
  if (end) {
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 30) return "ending_soon";
  }
  return "active";
}

export const STATUS_STYLES: Record<ContractStatus, { pill: string; bar: string }> = {
  active: { pill: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30", bar: "" },
  ending_soon: { pill: "bg-amber-500/20 text-amber-400 border border-amber-500/30", bar: "" },
  ended: { pill: "bg-slate-600/40 text-slate-400 border border-slate-600/30", bar: "" },
  starting_soon: { pill: "bg-blue-500/20 text-blue-400 border border-blue-500/30", bar: "" },
};

export const STATUS_BAR_OVERRIDE: Record<ContractStatus, string | null> = {
  active: null,
  ending_soon: "bg-amber-500",
  ended: "bg-slate-600",
  starting_soon: "bg-blue-500",
};
