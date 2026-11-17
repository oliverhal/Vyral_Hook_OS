// Suggests which TikTok/Facebook posts are cross-posts of an Instagram post.
// There is no shared id across platforms, so we compare what survives a
// cross-post: runtime, publish time, and caption text. Matches are only ever
// *suggestions* (stored as matchSource "auto") that a reviewer can override.

export interface MatchPost {
  id: string;
  platform: string; // "instagram" | "tiktok" | "facebook" | ...
  publishedAt: number; // ms
  durationSeconds: number | null;
  caption: string | null;
}

export interface MatchResult {
  postId: string; // the non-IG post
  igId: string; // the IG post it appears to duplicate
  score: number; // 0..1
}

const MAX_GAP_MS = 48 * 60 * 60 * 1000;
const MAX_DURATION_DIFF = 1.5;
const MIN_CAPTION_SIM = 0.5;

function tokens(s: string | null): Set<string> {
  return new Set(
    (s ?? "").toLowerCase().replace(/[^\w#\s\u00C0-\u024F\u0400-\u04FF]/g, " ").split(/\s+/).filter((t) => t.length > 1)
  );
}

export function captionSimilarity(a: string | null, b: string | null): number {
  const ta = tokens(a), tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((t) => { if (tb.has(t)) inter++; });
  return inter / (ta.size + tb.size - inter);
}

function score(ig: MatchPost, other: MatchPost): number | null {
  const gap = Math.abs(ig.publishedAt - other.publishedAt);
  if (gap > MAX_GAP_MS) return null;
  const timeScore = 1 - gap / MAX_GAP_MS;
  const bothHaveDuration = ig.durationSeconds != null && other.durationSeconds != null;
  const sim = captionSimilarity(ig.caption, other.caption);

  if (bothHaveDuration) {
    const diff = Math.abs(ig.durationSeconds! - other.durationSeconds!);
    if (diff > MAX_DURATION_DIFF) return null;
    // Same runtime + close in time is a strong match even with different captions.
    return 0.5 * (1 - diff / MAX_DURATION_DIFF) + 0.3 * timeScore + 0.2 * sim;
  }
  // No runtime to lean on → require the captions to agree.
  if (sim < MIN_CAPTION_SIM) return null;
  return 0.6 * sim + 0.4 * timeScore;
}

/**
 * Greedy best-first matching of one creator's non-IG posts to their IG posts.
 * An IG post can be matched by at most one post per other platform.
 */
export function matchCrossPosts(posts: MatchPost[]): MatchResult[] {
  const igs = posts.filter((p) => p.platform === "instagram");
  const others = posts.filter((p) => p.platform !== "instagram");

  const candidates: MatchResult[] = [];
  for (const o of others) {
    for (const ig of igs) {
      const s = score(ig, o);
      if (s != null) candidates.push({ postId: o.id, igId: ig.id, score: s });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const usedOther = new Set<string>();
  const usedIgPlatform = new Set<string>(); // `${igId}|${platform}`
  const platformOf = new Map(others.map((o) => [o.id, o.platform]));
  const out: MatchResult[] = [];
  for (const c of candidates) {
    const key = `${c.igId}|${platformOf.get(c.postId)}`;
    if (usedOther.has(c.postId) || usedIgPlatform.has(key)) continue;
    usedOther.add(c.postId);
    usedIgPlatform.add(key);
    out.push(c);
  }
  return out;
}
