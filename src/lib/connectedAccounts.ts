import type { ConnectedAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/tokenCrypto";
import * as youtube from "@/lib/youtube";

export const CONNECT_PLATFORMS = ["facebook", "youtube"] as const;
export type ConnectPlatform = (typeof CONNECT_PLATFORMS)[number];

export function normalizeHandle(h: string | null | undefined): string {
  return (h ?? "").trim().replace(/^@/, "").toLowerCase();
}

export function redirectUri(platform: ConnectPlatform): string {
  return `${process.env.NEXTAUTH_URL}/api/connect/${platform}/callback`;
}

/** The connected Page/channel that posted a video, matched on its creator handle. */
export async function accountForVideo(platform: string, creatorHandle: string | null): Promise<ConnectedAccount | null> {
  const handle = normalizeHandle(creatorHandle);
  if (!handle) return null;
  return prisma.connectedAccount.findFirst({ where: { platform, handles: { has: handle } } });
}

/** A usable access token, refreshing YouTube's short-lived token when needed. */
export async function accessToken(account: ConnectedAccount): Promise<string> {
  const current = decryptToken(account.accessToken);
  if (account.platform !== "youtube") return current;
  if (account.tokenExpiresAt && account.tokenExpiresAt > new Date()) return current;
  if (!account.refreshToken) throw new Error(`${account.name}: YouTube session expired — reconnect the channel.`);

  const fresh = await youtube.refreshAccessToken(decryptToken(account.refreshToken));
  await prisma.connectedAccount.update({
    where: { id: account.id },
    data: { accessToken: encryptToken(fresh.accessToken), tokenExpiresAt: fresh.expiresAt, lastError: null },
  });
  return fresh.accessToken;
}
