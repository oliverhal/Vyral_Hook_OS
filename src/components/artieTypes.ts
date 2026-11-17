// Shapes returned by /api/artie/overview and /api/artie/creators/[id], shared by the
// dashboard list and its expandable creator cards.

export interface ArtieRow {
  id: string; name: string; ratePerVideo: number | null;
  handles: { instagram: string | null; tiktok: string | null; facebook: string | null };
  counted: number; perPlatform: Record<string, number>; discrepancy: boolean; needsReview: number;
  bonus: { pending: number; approved: number; rejected: number; indicativeAmount: number };
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
}

export interface ArtieDetail {
  counts: { counted: number; perPlatform: Record<string, number>; discrepancy: boolean };
  posts: ArtiePostRow[];
  candidates: ArtieCandidateRow[];
}

export const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook" };
