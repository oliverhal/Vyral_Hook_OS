// Shapes returned by /api/artie/overview and /api/artie/creators/[id], shared by the
// dashboard list and its expandable creator cards.

export interface ArtieRow {
  id: string; name: string; avatarUrl: string | null; ratePerVideo: number | null; rateSource: string | null;
  estBase: number | null; estTotal: number | null; leavingAfter: string | null;
  startDate: string | null;
  pace: { expected: number; actual: number; delta: number; days: number; status: "ahead" | "on_track" | "behind" | "just_started" | "not_started"; startedThisCycle: boolean;
    fullTarget: number; remaining: number; daysLeft: number; neededPerDay: number; perDay: number };
  handles: { instagram: string | null; tiktok: string | null; facebook: string | null };
  counted: number; perPlatform: Record<string, number>; discrepancy: boolean; needsReview: number;
  bonus: { pending: number; pendingChecks: number; approved: number; rejected: number; indicativeAmount: number };
  trackingGaps: string[];
}

export interface ArtiePostRow {
  id: string; platform: string; url: string; caption: string | null; publishedAt: string; views: number;
  igMatchId: string | null; matchSource: string | null; countDecision: string | null; needsReview: boolean;
}

export interface ArtieCandidateRow {
  id: string; status: string; maxViews: number; initialAmount: number; approvedAmount: number | null;
  flags: string[]; qualifiesOn: string[];
  primary: { url: string; platform: string; views: number } | null;
  related: { id: string; url: string; platform: string; views: number }[];
}

export interface ArtieDetail {
  counts: { counted: number; perPlatform: Record<string, number>; discrepancy: boolean };
  posts: ArtiePostRow[];
  candidates: ArtieCandidateRow[];
}

export const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook" };

export const AVATAR_COLORS = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500", "bg-pink-500", "bg-teal-500", "bg-amber-500", "bg-rose-500", "bg-indigo-500", "bg-cyan-600"];
export const avatarColor = (name: string) => AVATAR_COLORS[Array.from(name).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_COLORS.length];
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
