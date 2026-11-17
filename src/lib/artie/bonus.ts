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
  | "similar_views_ig_fb" // viral on BOTH IG and FB with near-identical views → probably one set of views shown on both (linked accounts): investigate
  | "also_on_other_platform" // viral on both IG and FB with clearly different views → each platform earns its own bonus
  | "possible_fb_ig_overlap" // IG + FB versions of one video both exist but only one reached the threshold: IG's number may already include FB views
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

/** IG and FB views within this ratio of each other count as "the same views" (min/max ≥ 0.9, i.e. within ~10%). */
export const SIMILAR_VIEWS_RATIO = 0.9;

/**
 * Bonus candidates for one creator in one cycle.
 *
 *  - One candidate per unique video that reaches the threshold on any platform (cross-posts collapse
 *    into their IG video), EXCEPT:
 *  - A video viral on BOTH Instagram and Facebook:
 *      · clearly different view counts → two real, separate achievements → TWO candidates (one per
 *        platform), each awarded on its own;
 *      · the same / similar view counts → when the accounts are linked Facebook also shows its views
 *        on Instagram, so it's probably ONE set of views → ONE candidate, flagged to investigate.
 *  - If only one of the two platforms reached the threshold, it stays one candidate, flagged because
 *    the Instagram number may already include the Facebook views.
 */
export function detectCandidates(posts: CountPost[], ctx: CreatorBonusContext): Candidate[] {
  const out: Candidate[] = [];
  for (const g of groupPosts(posts)) {
    const members = [g.primary, ...g.related];
    const hit = members.filter((m) => m.views >= ctx.threshold);
    if (hit.length === 0) continue;

    const ig = members.find((m) => m.platform === "instagram");
    const fb = members.find((m) => m.platform === "facebook");

    if (ig && fb && ig.views >= ctx.threshold && fb.views >= ctx.threshold) {
      const ratio = Math.min(ig.views, fb.views) / Math.max(ig.views, fb.views);
      if (ratio < SIMILAR_VIEWS_RATIO) {
        // Genuinely different numbers on each platform: award both, separately.
        const rest = g.related.filter((r) => r.platform !== "facebook").map((r) => r.id);
        out.push({ primaryPostId: ig.id, relatedPostIds: rest, qualifiesOn: ["instagram"], flags: ["also_on_other_platform"], maxViews: ig.views });
        out.push({ primaryPostId: fb.id, relatedPostIds: [], qualifiesOn: ["facebook"], flags: ["also_on_other_platform"], maxViews: fb.views });
        continue;
      }
      // Same / similar views on both: probably the same views shown twice. One candidate, to investigate.
      out.push({
        primaryPostId: g.primary.id,
        relatedPostIds: g.related.map((r) => r.id),
        qualifiesOn: ["instagram", "facebook"],
        flags: ["similar_views_ig_fb"],
        maxViews: Math.max(...members.map((m) => m.views)),
      });
      continue;
    }

    const flags: Flag[] = [];
    if (ig && fb) flags.push("possible_fb_ig_overlap");
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
 * A bonus needs a real look when the same video is on both Instagram and Facebook and the views might
 * be the same ones shown twice (linked accounts): near-identical views on both, or only one platform
 * reached the threshold. Everything else — including a video that's clearly viral on both with
 * different numbers — is a plain "it hit the threshold" approval.
 */
export const needsLinkCheck = (flags: string[]): boolean =>
  flags.includes("similar_views_ig_fb") || flags.includes("possible_fb_ig_overlap");
