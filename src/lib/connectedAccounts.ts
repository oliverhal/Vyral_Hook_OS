import type { ConnectedAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/tokenCrypto";
import * as facebook from "@/lib/facebook";
import * as youtube from "@/lib/youtube";

export const CONNECT_PLATFORMS = ["facebook", "youtube"] as const;
export type ConnectPlatform = (typeof CONNECT_PLATFORMS)[number];

export function normalizeHandle(h: string | null | undefined): string {
  return (h ?? "").trim().replace(/^@/, "").toLowerCase();
}

export function redirectUri(platform: ConnectPlatform): string {
  return `${process.env.NEXTAUTH_URL}/api/connect/${platform}/callback`;
}

/**
 * The connected Page/channel that posted a video, matched on its creator
 * handle. Trackers often use a different id than the platform API returns
 * (Facebook profile ids, old YouTube handles), so when nothing matches we
 * ask the platform which connected account owns the video and remember
 * that handle.
 */
export async function accountForVideo(
  platform: string,
  creatorHandle: string | null,
  platformVideoId?: string
): Promise<ConnectedAccount | null> {
  const handle = normalizeHandle(creatorHandle);
  if (handle) {
    const match = await prisma.connectedAccount.findFirst({ where: { platform, handles: { has: handle } } });
    if (match) return match;
  }
  if (!platformVideoId) return null;

  const accounts = await prisma.connectedAccount.findMany({ where: { platform } });
  let owner: ConnectedAccount | undefined;
  if (platform === "youtube" && accounts.length > 0) {
    // Any connected channel's token can look up who uploaded a public video.
    const channelId = await youtube.videoChannelId(platformVideoId, await accessToken(accounts[0])).catch(() => null);
    owner = accounts.find((a) => a.externalId === channelId);
  } else if (platform === "facebook") {
    for (const account of accounts) {
      const ownerId = await facebook.videoOwnerId(platformVideoId, decryptToken(account.accessToken)).catch(() => null);
      if (ownerId === account.externalId) {
        owner = account;
        break;
      }
    }
  }
  if (!owner) return null;
  if (handle && !owner.handles.includes(handle)) {
    return prisma.connectedAccount.update({ where: { id: owner.id }, data: { handles: { push: handle } } });
  }
  return owner;
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
