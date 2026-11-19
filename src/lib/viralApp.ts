const BASE_URL = "https://viral.app/api/v1";
const PER_PAGE = 100;
const MAX_PAGES = 50;

export interface ViralAppVideo {
  platform: string;
  platformVideoId: string;
  accountUsername: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  viewCount: number;
  commentCount: number;
}

export interface LiveComment {
  platform_comment_id: string | null;
  commenter_username: string | null;
  comment_text: string | null;
  comment_language: string | null;
  like_count: number | null;
  reply_count: number | null;
  comment_type: string | null;
  commented_at: string | null;
  share_url: string | null;
}

function apiKey(): string {
  const key = process.env.VIRAL_APP_API_KEY;
  if (!key) throw new Error("VIRAL_APP_API_KEY is not set in this project's environment variables.");
  return key;
}

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { "x-api-key": apiKey() }, cache: "no-store" });
  if (!res.ok) throw new Error(`viral.app API error ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/** Org-wide tracked videos above minViews published inside the lookback window. */
export async function fetchTopVideos(minViews: number, lookbackDays: number): Promise<ViralAppVideo[]> {
  const from = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const out: ViralAppVideo[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await get<{ data: any[]; pageCount: number }>("/videos", {
      page,
      perPage: PER_PAGE,
      sortCol: "viewCount",
      sortDir: "desc",
      "dateRange[from]": from,
      "dateRange[to]": new Date().toISOString().slice(0, 10),
    });

    let belowThreshold = false;
    for (const v of res.data ?? []) {
      const views = Number(v.viewCount ?? 0);
      if (views < minViews) {
        belowThreshold = true;
        break;
      }
      out.push({
        platform: v.platform,
        platformVideoId: v.platformVideoId,
        accountUsername: v.accountUsername ?? null,
        caption: v.caption ?? null,
        thumbnailUrl: v.thumbnailUrl ?? null,
        publishedAt: v.publishedAt ?? null,
        viewCount: views,
        commentCount: Number(v.commentCount ?? 0),
      });
    }

    if (belowThreshold || page >= (res.pageCount ?? 1)) break;
  }

  return out;
}

/**
 * Live comments for any public video (works for videos tracked in ViralDeck
 * too). 3 credits per page; replies are counted, not listed.
 */
export async function fetchComments(
  platform: string,
  platformVideoId: string,
  maxPages: number
): Promise<LiveComment[]> {
  const out: LiveComment[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {};
    if (pageToken) params.pageToken = pageToken;
    const res: { comments: LiveComment[]; nextPageToken: string | null } = await get(
      `/live/${platform}/videos/${encodeURIComponent(platformVideoId)}/comments`,
      params
    );
    out.push(...(res.comments ?? []));
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
  }

  return out;
}

export function videoUrl(platform: string, platformVideoId: string, username: string | null): string {
  switch (platform) {
    case "tiktok":
      return `https://www.tiktok.com/@${username ?? "_"}/video/${platformVideoId}`;
    case "instagram":
      return `https://www.instagram.com/reel/${platformVideoId}/`;
    case "youtube":
      return `https://www.youtube.com/shorts/${platformVideoId}`;
    case "facebook":
      return `https://www.facebook.com/reel/${platformVideoId}`;
    default:
      return "";
  }
}

/** Native platform video id from a public post URL (what the live endpoints expect). */
export function platformVideoIdFromUrl(platform: string, url: string): string | null {
  const patterns: Record<string, RegExp[]> = {
    tiktok: [/\/video\/(\d+)/, /\/photo\/(\d+)/],
    instagram: [/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/],
    youtube: [/\/shorts\/([A-Za-z0-9_-]{6,})/, /[?&]v=([A-Za-z0-9_-]{6,})/, /youtu\.be\/([A-Za-z0-9_-]{6,})/],
    facebook: [/\/reel\/(\d+)/, /\/videos\/(?:[^/]+\/)?(\d+)/, /[?&]v=(\d+)/],
  };
  for (const re of patterns[platform] ?? []) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}
