const BASE_URL = "https://viraldeck.io/api/v1";
const LIMIT = 100;
const MAX_PAGES = 100; // safety cap (10,000 videos per project)

// VIRALDECK_API_KEY is scoped to the whole Vyral Labs workspace, so every
// request that returns videos must be pinned to a projectId.

export interface ViraldeckProject {
  id: string;
  name: string;
  status: string;
  videoCount: number;
  viralNowCount: number;
  platforms: string[];
}

export interface ViraldeckVideo {
  id: string;
  platform: string;
  creatorId: string;
  creatorHandle: string | null;
  title: string | null;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  views: number;
  comments: number;
}

function apiKey(): string {
  const key = process.env.VIRALDECK_API_KEY;
  if (!key) throw new Error("VIRALDECK_API_KEY is not set in this project's environment variables.");
  return key;
}

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey()}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`ViralDeck API error ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export async function listProjects(): Promise<ViraldeckProject[]> {
  const res = await get<{ data: ViraldeckProject[] }>("/projects");
  return res.data ?? [];
}

/**
 * ViralDeck has no views/date filter on /videos, but it returns videos sorted
 * by views descending — so we walk pages until views drop below minViews and
 * keep only those published inside the lookback window.
 */
export async function fetchTopVideos(
  projectId: string,
  minViews: number,
  lookbackDays: number
): Promise<ViraldeckVideo[]> {
  const since = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
  const out: ViraldeckVideo[] = [];
  let cursor = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await get<{ data: any[]; meta: { nextCursor: number | null } }>("/videos", {
      projectId,
      limit: LIMIT,
      cursor,
    });

    let belowThreshold = false;
    for (const raw of res.data ?? []) {
      const views = Number(raw.views ?? 0);
      if (views < minViews) {
        belowThreshold = true;
        break;
      }
      const published = raw.publishedAt ? new Date(raw.publishedAt).getTime() : 0;
      if (published < since) continue;
      out.push({
        id: raw.id,
        platform: raw.platform,
        creatorId: raw.creatorId,
        creatorHandle: raw.creatorHandle ?? null,
        title: raw.title ?? null,
        url: raw.url,
        thumbnailUrl: raw.thumbnailUrl ?? null,
        publishedAt: raw.publishedAt ?? null,
        views,
        comments: Number(raw.comments ?? 0),
      });
    }

    if (belowThreshold || res.meta?.nextCursor == null) break;
    cursor = res.meta.nextCursor;
  }

  return out;
}
