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

async function get<T>(path: string, params: Record<string, string | number> = {}, key?: string): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  // ViralDeck rate-limits bursts per key (429 + Retry-After): wait as told and retry.
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key ?? apiKey()}` }, cache: "no-store" });
    if (res.status === 429 && attempt < 6) {
      const wait = Math.min(30, Math.max(1, Number(res.headers.get("retry-after")) || 2));
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`ViralDeck API error ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }
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


// ── Artie creator dashboard ──────────────────────────────────────────────────
// Artie lives in its own ViralDeck workspace, so it has its own key
// (VIRALDECK_ARTIE_API_KEY) — the workspace key above can't see it.

export interface ViraldeckAccount {
  id: string;
  platform: string;
  handle: string;
  displayName: string | null;
  videoCount: number;
}

export function artieApiKey(): string {
  const key = process.env.VIRALDECK_ARTIE_API_KEY;
  if (!key) throw new Error("VIRALDECK_ARTIE_API_KEY is not set in this project's environment variables.");
  return key;
}

/** The Artie project id visible to the Artie key (it should see exactly one project). */
export async function artieProjectId(key = artieApiKey()): Promise<string> {
  const res = await get<{ data: ViraldeckProject[] }>("/projects", {}, key);
  const projects = res.data ?? [];
  const hit = projects.length === 1 ? projects[0] : projects.find((p) => /artie/i.test(p.name));
  if (!hit) throw new Error("The Artie ViralDeck key can't see a project called Artie.");
  return hit.id;
}

/** Every tracked account in the project. /creators pages by offset cursor, 100 at a time. */
export async function listAccounts(projectId: string, key = artieApiKey()): Promise<ViraldeckAccount[]> {
  const out: ViraldeckAccount[] = [];
  let cursor = 0;
  for (let page = 0; page < 50; page++) {
    const res = await get<{ data: any[]; meta: { nextCursor: number | null } }>("/creators", { projectId, limit: LIMIT, cursor }, key);
    for (const c of res.data ?? []) {
      out.push({ id: c.id, platform: c.platform, handle: String(c.handle ?? ""), displayName: c.displayName ?? null, videoCount: Number(c.videoCount ?? 0) });
    }
    if (res.meta?.nextCursor == null) break;
    cursor = res.meta.nextCursor;
  }
  return out;
}

/**
 * One account's videos published in [from, to). There's no date filter, but a
 * single account only has a few dozen to a few hundred videos, so we page the
 * account (not the whole project) and trim on the exact instant.
 */
export async function fetchAccountVideos(projectId: string, creatorId: string, from: Date, to: Date, key = artieApiKey()): Promise<ViraldeckVideo[]> {
  const out: ViraldeckVideo[] = [];
  let cursor = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await get<{ data: any[]; meta: { nextCursor: number | null } }>("/videos", { projectId, creatorId, limit: LIMIT, cursor }, key);
    for (const raw of res.data ?? []) {
      const published = raw.publishedAt ? new Date(raw.publishedAt).getTime() : NaN;
      if (!(published >= from.getTime() && published < to.getTime())) continue;
      out.push({
        id: raw.id, platform: raw.platform, creatorId: raw.creatorId, creatorHandle: raw.creatorHandle ?? null,
        title: raw.title ?? null, url: raw.url, thumbnailUrl: raw.thumbnailUrl ?? null, publishedAt: raw.publishedAt ?? null,
        views: Number(raw.views ?? 0), comments: Number(raw.comments ?? 0),
      });
    }
    if (res.meta?.nextCursor == null) break;
    cursor = res.meta.nextCursor;
  }
  return out;
}

/** Run `fn` over `items` with at most `n` in flight (keeps us polite to the API and inside the function timeout). */
export async function mapPool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }));
  return results;
}
