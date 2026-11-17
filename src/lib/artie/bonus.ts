// Counting and bonus detection for one creator in one cycle. Pure functions:
// the caller passes in posts already filtered to the cycle.

export interface CountPost {
  id: string;
  platform: string;
  views: number;
  igMatchId: string | null; // set when this (non-IG) post is a suspected cross-post of an IG post
  countDecision: string | null; // reviewer: "count" | "ignore" | null
}

export type Flag =
  | "possible_fb_ig_overlap" // IG + FB versions of one video both exist: IG's number may already include FB views
  | "ig_views_may_include_fb" // creator has a Facebook account that isn't known to be unlinked
  | "fb_linkage_unknown"
  | "tiktok_only"
  | "facebook_only"
  | "no_ig_counterpart";

export interface Group {
  primary: CountPost;
  related: CountPost[];
}

/** A "unique video" = an IG post plus whichever other-platform posts were matched to it; unmatched non-IG posts stand alone. */
export function groupPosts(posts: CountPost[]): Group[] {
  const byId = new Map(posts.map((p) => [p.id, p]));
  const groups = new Map<string, Group>();
  for (const p of posts) {
    if (p.platform === "instagram") groups.set(p.id, { primary: p, related: [] });
  }
  const standalone: Group[] = [];
  for (const p of posts) {
    if (p.platform === "instagram") continue;
    const ig = p.igMatchId ? groups.get(p.igMatchId) : undefined;
    if (ig && byId.has(p.igMatchId!)) ig.related.push(p);
    else standalone.push({ primary: p, related: [] });
  }
  return Array.from(groups.values()).concat(standalone);
}

/**
 * "unique": every unique video counts once, whichever platform it was posted on — a cross-post
 *           is one video, and a TikTok- or Facebook-only video still counts.
 * "instagram": only Instagram videos count (TikTok/FB-only ones wait for a reviewer's decision).
 */
export type CountMode = "unique" | "instagram";

export interface Counts {
  /** Unique videos (see CountMode). */
  counted: number;
  perPlatform: Record<string, number>;
  /** Non-IG posts with no IG counterpart that nobody has decided on yet. */
  needsReview: CountPost[];
  /** Internal only: true when IG/TikTok/FB post counts differ. */
  discrepancy: boolean;
}

export function countVideos(posts: CountPost[], mode: CountMode = "unique"): Counts {
  const perPlatform: Record<string, number> = { instagram: 0, tiktok: 0, facebook: 0 };
  for (const p of posts) perPlatform[p.platform] = (perPlatform[p.platform] ?? 0) + 1;

  const groups = groupPosts(posts);
  let counted = 0;
  const needsReview: CountPost[] = [];
  for (const g of groups) {
    if (g.primary.platform === "instagram") counted++;
    else if (g.primary.countDecision === "ignore") continue; // reviewer said no
    else if (mode === "unique" || g.primary.countDecision === "count") counted++;
    else needsReview.push(g.primary);
  }

  const tracked = ["instagram", "tiktok", "facebook"].filter((pl) => perPlatform[pl] > 0);
  const discrepancy = tracked.length > 1 && new Set(tracked.map((pl) => perPlatform[pl])).size > 1;
  return { counted, perPlatform, needsReview, discrepancy };
}

export interface Candidate {
  primaryPostId: string;
  relatedPostIds: string[];
  qualifiesOn: string[]; // platforms whose post is at/above the threshold
  flags: Flag[];
  maxViews: number;
}

export interface CreatorBonusContext {
  threshold: number;
  hasFacebookAccount: boolean;
  /** null = we don't know whether the creator's FB and IG are linked. */
  facebookLinked: boolean | null;
}

/**
 * One candidate per *unique video* that reaches the threshold on any platform.
 * Cross-posts collapse into their IG video, so an IG+FB pair can never yield two
 * bonuses; the flags tell the reviewer where the views may have come from.
 */
export function detectCandidates(posts: CountPost[], ctx: CreatorBonusContext): Candidate[] {
  const out: Candidate[] = [];
  for (const g of groupPosts(posts)) {
    const members = [g.primary, ...g.related];
    const hit = members.filter((m) => m.views >= ctx.threshold);
    if (hit.length === 0) continue;

    const flags: Flag[] = [];
    const platforms = new Set(members.map((m) => m.platform));
    if (platforms.has("instagram") && platforms.has("facebook")) flags.push("possible_fb_ig_overlap");
    if (g.primary.platform === "instagram" && ctx.hasFacebookAccount && ctx.facebookLinked !== false) {
      flags.push("ig_views_may_include_fb");
    }
    if (ctx.hasFacebookAccount && ctx.facebookLinked === null) flags.push("fb_linkage_unknown");
    if (g.primary.platform !== "instagram") {
      flags.push("no_ig_counterpart");
      flags.push(g.primary.platform === "tiktok" ? "tiktok_only" : "facebook_only");
    }

    out.push({
      primaryPostId: g.primary.id,
      relatedPostIds: g.related.map((r) => r.id),
      qualifiesOn: Array.from(new Set(hit.map((m) => m.platform))),
      flags,
      maxViews: Math.max(...members.map((m) => m.views)),
    });
  }
  return out;
}

/**
 * A bonus needs a real look when the same video is on both Instagram and Facebook for the
 * creator — that usually means the accounts are linked, so the views may be counted twice.
 * Everything else is a plain "it hit the threshold" approval.
 */
export const needsLinkCheck = (flags: string[]): boolean => flags.includes("possible_fb_ig_overlap");
