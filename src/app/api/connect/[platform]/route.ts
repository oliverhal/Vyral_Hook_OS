import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CONNECT_PLATFORMS, type ConnectPlatform, redirectUri } from "@/lib/connectedAccounts";
import * as facebook from "@/lib/facebook";
import * as youtube from "@/lib/youtube";

// Starts the OAuth flow that lets the bot read and reply to comments as a
// creator's Facebook Page or YouTube channel.
export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  const platform = params.platform as ConnectPlatform;
  if (!CONNECT_PLATFORMS.includes(platform)) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });

  const state = randomBytes(16).toString("hex");
  const url =
    platform === "facebook"
      ? facebook.authUrl(redirectUri(platform), state)
      : youtube.authUrl(redirectUri(platform), state);

  const res = NextResponse.redirect(url);
  res.cookies.set(`oauth_state_${platform}`, state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  // ?loop=1 (YouTube): after each channel connects, go straight back to
  // Google's channel picker so lots of brand accounts can be added in a row.
  if (req.nextUrl.searchParams.get("loop") === "1") {
    res.cookies.set("oauth_loop", req.cookies.get("oauth_loop")?.value ?? "0", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 1800, path: "/" });
  } else {
    res.cookies.delete("oauth_loop");
  }
  return res;
}
