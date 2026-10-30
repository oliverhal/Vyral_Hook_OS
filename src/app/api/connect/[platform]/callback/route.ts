import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CONNECT_PLATFORMS, type ConnectPlatform, normalizeHandle, redirectUri } from "@/lib/connectedAccounts";
import { encryptToken } from "@/lib/tokenCrypto";
import * as facebook from "@/lib/facebook";
import * as youtube from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  const platform = params.platform as ConnectPlatform;
  if (!CONNECT_PLATFORMS.includes(platform)) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });

  const looped = req.cookies.get("oauth_loop")?.value;
  const back = (query: string) => {
    const res = NextResponse.redirect(new URL(`/comments?tab=accounts&${query}`, req.url));
    res.cookies.delete(`oauth_state_${platform}`);
    res.cookies.delete("oauth_loop");
    return res;
  };

  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  // Cancelling the picker is how a "connect several" run ends.
  if (looped !== undefined && sp.get("error") === "access_denied") return back(`connected=${looped}`);
  if (sp.get("error") || !code) return back(`error=${encodeURIComponent(sp.get("error_description") ?? sp.get("error") ?? "cancelled")}`);
  if (!sp.get("state") || sp.get("state") !== req.cookies.get(`oauth_state_${platform}`)?.value) {
    return back("error=Login+expired%2C+try+again");
  }

  const connectedBy = session.user.name ?? session.user.email ?? null;
  try {
    if (platform === "facebook") {
      const pages = await facebook.pagesFromCode(code, redirectUri(platform));
      for (const p of pages) {
        const handles = Array.from(new Set([p.id, normalizeHandle(p.username)].filter(Boolean)));
        await prisma.connectedAccount.upsert({
          where: { platform_externalId: { platform, externalId: p.id } },
          create: { platform, externalId: p.id, name: p.name, handles, accessToken: encryptToken(p.access_token), connectedBy },
          update: { name: p.name, handles, accessToken: encryptToken(p.access_token), connectedBy, lastError: null },
        });
      }
      return back(`connected=${pages.length}`);
    }

    const ch = await youtube.channelFromCode(code, redirectUri(platform));
    const handles = Array.from(new Set([normalizeHandle(ch.channelId), normalizeHandle(ch.handle)].filter(Boolean)));
    const tokens = {
      accessToken: encryptToken(ch.accessToken),
      tokenExpiresAt: ch.expiresAt,
      ...(ch.refreshToken && { refreshToken: encryptToken(ch.refreshToken) }),
    };
    await prisma.connectedAccount.upsert({
      where: { platform_externalId: { platform, externalId: ch.channelId } },
      create: { platform, externalId: ch.channelId, name: ch.title, handles, connectedBy, ...tokens },
      update: { name: ch.title, handles, connectedBy, lastError: null, ...tokens },
    });
    if (looped !== undefined) {
      const res = NextResponse.redirect(new URL(`/api/connect/${platform}?loop=1`, req.url));
      res.cookies.set("oauth_loop", String(Number(looped) + 1), { httpOnly: true, secure: true, sameSite: "lax", maxAge: 1800, path: "/" });
      return res;
    }
    return back("connected=1");
  } catch (err) {
    return back(`error=${encodeURIComponent(err instanceof Error ? err.message : String(err))}`);
  }
}
