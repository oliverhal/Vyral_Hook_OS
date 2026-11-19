const BASE_URL = "https://api.apify.com/v2";

// Comment scrapers that also return replies, so we can tell whether the
// creator has answered a comment (viral.app only counts replies).
const TIKTOK_ACTOR = "clockworks~tiktok-comments-scraper";
const INSTAGRAM_ACTOR = "apify~instagram-comment-scraper";

const COMMENTS_PER_VIDEO = 60;
const REPLIES_PER_COMMENT = 5;

export interface ScrapedComment {
  id: string;
  authorHandle: string | null;
  text: string;
  language: string | null;
  likeCount: number;
  replyCount: number;
  postedAt: string | null;
  shareUrl: string | null;
  replyAuthors: string[];
}

export function apifyEnabled(): boolean {
  return Boolean(process.env.APIFY_TOKEN);
}

async function runActor(actor: string, input: Record<string, unknown>): Promise<any[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set in this project's environment variables.");
  // run-sync waits up to 300s for the run and returns its dataset items.
  const res = await fetch(`${BASE_URL}/acts/${actor}/run-sync-get-dataset-items?timeout=280`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Apify ${actor} error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as any[];
}

function videoKey(platform: string, url: string): string | null {
  const m =
    platform === "tiktok" ? url.match(/\/(?:video|photo)\/(\d+)/) : url.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/** Comments with reply authors, keyed by platform video id (TikTok id / IG shortcode). */
export async function scrapeComments(
  platform: "tiktok" | "instagram",
  urls: string[]
): Promise<Map<string, ScrapedComment[]>> {
  const byVideo = new Map<string, ScrapedComment[]>();
  if (urls.length === 0) return byVideo;

  if (platform === "tiktok") {
    const items = await runActor(TIKTOK_ACTOR, {
      postURLs: urls,
      topLevelCommentsPerPost: COMMENTS_PER_VIDEO,
      maxRepliesPerComment: REPLIES_PER_COMMENT,
    });
    // Top-level comments and replies come back as one flat list; replies
    // point at their parent with repliesToId.
    const top = new Map<string, ScrapedComment & { videoKey: string }>();
    const replies: any[] = [];
    for (const it of items) {
      if (it.errorCode || !it.cid) continue;
      if (it.repliesToId) {
        replies.push(it);
        continue;
      }
      const key = videoKey("tiktok", it.videoWebUrl ?? "");
      if (!key) continue;
      top.set(it.cid, {
        videoKey: key,
        id: it.cid,
        authorHandle: it.uniqueId ?? null,
        text: it.text ?? "",
        language: null,
        likeCount: Number(it.diggCount ?? 0),
        replyCount: Number(it.replyCommentTotal ?? 0),
        postedAt: it.createTimeISO ?? null,
        shareUrl: null,
        replyAuthors: [],
      });
    }
    for (const r of replies) top.get(r.repliesToId)?.replyAuthors.push(String(r.uniqueId ?? "").toLowerCase());
    for (const { videoKey: key, ...c } of Array.from(top.values())) {
      byVideo.set(key, [...(byVideo.get(key) ?? []), c]);
    }
    return byVideo;
  }

  const items = await runActor(INSTAGRAM_ACTOR, {
    directUrls: urls,
    resultsLimit: COMMENTS_PER_VIDEO,
    includeNestedComments: true,
  });
  for (const it of items) {
    if (it.errorCode || !it.id) continue;
    const key = videoKey("instagram", it.postUrl ?? it.inputUrl ?? it.url ?? "");
    if (!key) continue;
    const nested: any[] = Array.isArray(it.replies) ? it.replies : [];
    byVideo.set(key, [
      ...(byVideo.get(key) ?? []),
      {
        id: String(it.id),
        authorHandle: it.ownerUsername ?? null,
        text: it.text ?? "",
        language: null,
        likeCount: Number(it.likesCount ?? 0),
        replyCount: Number(it.repliesCount ?? nested.length),
        postedAt: it.timestamp ?? null,
        shareUrl: null,
        replyAuthors: nested.map((r) => String(r.ownerUsername ?? "").toLowerCase()),
      },
    ]);
  }
  return byVideo;
}
