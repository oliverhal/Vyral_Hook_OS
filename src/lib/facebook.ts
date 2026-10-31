// Facebook Graph API for Pages we manage. Unversioned URLs use the Meta app's
// own API version, so there's nothing to bump here when versions retire.
const GRAPH = "https://graph.facebook.com";
const SCOPES = ["pages_show_list", "pages_read_engagement", "pages_read_user_content", "pages_manage_engagement", "business_management"];

export interface FbComment {
  id: string;
  authorName: string | null;
  text: string;
  likeCount: number;
  replyCount: number;
  postedAt: string | null;
  replyAuthorIds: string[];
}

function appCreds() {
  const id = process.env.FACEBOOK_APP_ID;
  const secret = process.env.FACEBOOK_APP_SECRET;
  if (!id || !secret) throw new Error("FACEBOOK_APP_ID / FACEBOOK_APP_SECRET are not set.");
  return { id, secret };
}

async function graph<T>(path: string, params: Record<string, string>, init?: RequestInit): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(`Facebook API error ${res.status}: ${body.error?.message ?? JSON.stringify(body).slice(0, 200)}`);
  return body as T;
}

export function authUrl(redirectUri: string, state: string): string {
  const url = new URL("https://www.facebook.com/dialog/oauth");
  url.searchParams.set("client_id", appCreds().id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  // Apps on Facebook Login for Business request permissions through a saved
  // login configuration instead of a scope list.
  const configId = process.env.FACEBOOK_CONFIG_ID;
  if (configId) url.searchParams.set("config_id", configId);
  else url.searchParams.set("scope", SCOPES.join(","));
  return url.toString();
}

/** Code → long-lived user token → the Pages it manages (Page tokens from a long-lived user token don't expire). */
export async function pagesFromCode(code: string, redirectUri: string) {
  const { id, secret } = appCreds();
  const short = await graph<{ access_token: string }>("/oauth/access_token", {
    client_id: id,
    client_secret: secret,
    redirect_uri: redirectUri,
    code,
  });
  const long = await graph<{ access_token: string }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: id,
    client_secret: secret,
    fb_exchange_token: short.access_token,
  });
  type Page = { id: string; name: string; access_token?: string; username?: string };
  const pages = new Map<string, Page>();
  const collect = async (path: string) => {
    let next: string | null = `${GRAPH}${path}`;
    while (next) {
      const url: URL = new URL(next);
      if (!url.searchParams.has("access_token")) {
        url.searchParams.set("fields", "id,name,access_token,username");
        url.searchParams.set("limit", "100");
        url.searchParams.set("access_token", long.access_token);
      }
      const res: Response = await fetch(url, { cache: "no-store" });
      const body: any = await res.json();
      if (!res.ok || body.error) throw new Error(`Facebook API error ${res.status}: ${body.error?.message ?? res.statusText}`);
      for (const p of body.data ?? []) if (!pages.get(p.id)?.access_token) pages.set(p.id, p);
      next = body.paging?.next ?? null;
    }
  };

  // Pages the person has a role on directly, plus Pages owned by (or shared
  // with) their business portfolios.
  await collect("/me/accounts");
  const businesses = await graph<{ data: { id: string }[] }>("/me/businesses", { fields: "id", limit: "100", access_token: long.access_token }).catch(
    () => ({ data: [] as { id: string }[] })
  );
  for (const b of businesses.data) {
    await collect(`/${b.id}/owned_pages`).catch(() => undefined);
    await collect(`/${b.id}/client_pages`).catch(() => undefined);
  }

  // Business-owned Pages come back from owned_pages/client_pages without a
  // token; ask for each Page's token directly with the user token.
  for (const p of Array.from(pages.values())) {
    if (p.access_token) continue;
    const full = await graph<Page>(`/${p.id}`, { fields: "id,name,access_token,username", access_token: long.access_token }).catch(() => null);
    if (full?.access_token) pages.set(p.id, full);
  }

  return Array.from(pages.values())
    .filter((p) => p.access_token)
    .map((p) => ({ ...p, access_token: p.access_token! }));
}

/** Id of the Page that posted a video, or null if this Page token can't see it. */
export async function videoOwnerId(videoId: string, pageToken: string): Promise<string | null> {
  const res = await graph<{ from?: { id: string } }>(`/${videoId}`, { fields: "from{id}", access_token: pageToken });
  return res.from?.id ?? null;
}

export async function listComments(videoId: string, pageToken: string, limit = 100): Promise<FbComment[]> {
  const res = await graph<{ data: any[] }>(`/${videoId}/comments`, {
    fields: "id,message,from{id,name},created_time,like_count,comment_count,comments.limit(25){from{id}}",
    filter: "toplevel",
    order: "reverse_chronological",
    limit: String(limit),
    access_token: pageToken,
  });
  return (res.data ?? [])
    .filter((c) => c.message)
    .map((c) => ({
      id: c.id,
      authorName: c.from?.name ?? null,
      text: c.message,
      likeCount: Number(c.like_count ?? 0),
      replyCount: Number(c.comment_count ?? 0),
      postedAt: c.created_time ?? null,
      replyAuthorIds: (c.comments?.data ?? []).map((r: any) => String(r.from?.id ?? "")),
    }));
}

export async function replyToComment(commentId: string, message: string, pageToken: string): Promise<string> {
  const res = await graph<{ id: string }>(`/${commentId}/comments`, { message, access_token: pageToken }, { method: "POST" });
  return res.id;
}
