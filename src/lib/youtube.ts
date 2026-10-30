// YouTube Data API v3 for channels connected via Google OAuth.
const API = "https://www.googleapis.com/youtube/v3";
const SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

export interface YtComment {
  id: string;
  authorHandle: string | null;
  text: string;
  likeCount: number;
  replyCount: number;
  postedAt: string | null;
  replyAuthorChannelIds: string[];
}

function clientCreds() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set.");
  return { id, secret };
}

async function token(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Google OAuth error ${res.status}: ${body.error_description ?? body.error}`);
  return body as { access_token: string; refresh_token?: string; expires_in: number };
}

async function yt<T>(path: string, accessToken: string, params: Record<string, string>, init?: RequestInit): Promise<T> {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`YouTube API error ${res.status}: ${body.error?.message ?? res.statusText}`);
  return body as T;
}

export function authUrl(redirectUri: string, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientCreds().id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function channelFromCode(code: string, redirectUri: string) {
  const { id, secret } = clientCreds();
  const t = await token({ code, client_id: id, client_secret: secret, redirect_uri: redirectUri, grant_type: "authorization_code" });
  const res = await yt<{ items: { id: string; snippet: { title: string; customUrl?: string } }[] }>("/channels", t.access_token, {
    part: "snippet",
    mine: "true",
  });
  const channel = res.items?.[0];
  if (!channel) throw new Error("This Google account has no YouTube channel.");
  return {
    channelId: channel.id,
    title: channel.snippet.title,
    handle: channel.snippet.customUrl ?? null,
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000),
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const { id, secret } = clientCreds();
  const t = await token({ refresh_token: refreshToken, client_id: id, client_secret: secret, grant_type: "refresh_token" });
  return { accessToken: t.access_token, expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000) };
}

export async function listComments(videoId: string, accessToken: string): Promise<YtComment[]> {
  const res = await yt<{ items: any[] }>("/commentThreads", accessToken, {
    part: "snippet,replies",
    videoId,
    maxResults: "100",
    order: "relevance",
    textFormat: "plainText",
  });
  return (res.items ?? []).map((t) => {
    const top = t.snippet.topLevelComment.snippet;
    return {
      id: t.snippet.topLevelComment.id,
      authorHandle: (top.authorDisplayName ?? "").replace(/^@/, "") || null,
      text: top.textOriginal ?? top.textDisplay ?? "",
      likeCount: Number(top.likeCount ?? 0),
      replyCount: Number(t.snippet.totalReplyCount ?? 0),
      postedAt: top.publishedAt ?? null,
      replyAuthorChannelIds: (t.replies?.comments ?? []).map((r: any) => r.snippet?.authorChannelId?.value ?? ""),
    };
  });
}

export async function replyToComment(parentId: string, text: string, accessToken: string): Promise<string> {
  const res = await yt<{ id: string }>("/comments", accessToken, { part: "snippet" }, {
    method: "POST",
    body: JSON.stringify({ snippet: { parentId, textOriginal: text } }),
  });
  return res.id;
}
