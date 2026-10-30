import { prisma } from "@/lib/prisma";
import { accessToken, normalizeHandle } from "@/lib/connectedAccounts";
import * as facebook from "@/lib/facebook";
import * as youtube from "@/lib/youtube";

// Only reply where it clearly helps: people asking about the app or asking a
// real question. Praise, jokes and noise are left alone so the account
// doesn't look like it answers everything.
const REPLY_INTENTS = ["high_intent", "question"];
const MAX_POSTS_PER_RUN = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

function pause(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Posts suggested replies as the connected Facebook Page / YouTube channel.
 * Accounts in dry-run only get botReplyText filled in so the team can review
 * what would have been posted. The cron runs hourly through the day, so with
 * MAX_POSTS_PER_RUN and the per-account caps replies trickle out naturally
 * instead of landing all at once.
 */
export async function runAutoReplies() {
  const accounts = await prisma.connectedAccount.findMany({ where: { autoReply: true } });
  const since = new Date(Date.now() - DAY_MS);
  const summary: { account: string; posted: number; drafted: number; errors: number }[] = [];
  let budget = MAX_POSTS_PER_RUN;

  for (const account of accounts) {
    if (budget <= 0) break;
    const handles = new Set(account.handles);
    const mine = (h: string | null) => handles.has(normalizeHandle(h));

    const candidates = (
      await prisma.videoComment.findMany({
        where: {
          needsReply: true,
          intent: { in: REPLY_INTENTS },
          status: "open",
          creatorReplied: false,
          suggestedReply: { not: null },
          botReplyId: null,
          botReplyError: null,
          ...(account.dryRun && { botReplyText: null }),
          video: { platform: account.platform, project: { enabled: true } },
        },
        include: { video: { select: { id: true, creatorHandle: true } } },
        orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
        take: 200,
      })
    ).filter((c) => mine(c.video.creatorHandle));

    const recent = (
      await prisma.videoComment.findMany({
        where: { botRepliedAt: { gte: since }, video: { platform: account.platform } },
        select: { videoId: true, botReplyText: true, video: { select: { creatorHandle: true } } },
      })
    ).filter((c) => mine(c.video.creatorHandle));
    let postedToday = recent.length;
    const perVideo = new Map<string, number>();
    const usedTexts = new Set<string>();
    for (const r of recent) {
      perVideo.set(r.videoId, (perVideo.get(r.videoId) ?? 0) + 1);
      if (r.botReplyText) usedTexts.add(r.botReplyText.toLowerCase());
    }

    let posted = 0;
    let drafted = 0;
    let errors = 0;
    let token: string | null = null;

    for (const c of candidates) {
      if (budget <= 0) break;
      if (!account.dryRun && postedToday >= account.maxPerDay) break;
      if ((perVideo.get(c.videoId) ?? 0) >= account.maxPerVideoDay) continue;
      const text = c.suggestedReply!.trim();
      // Never post the same line twice in a day — copy-paste replies read as a bot.
      if (usedTexts.has(text.toLowerCase())) continue;

      if (account.dryRun) {
        await prisma.videoComment.update({ where: { id: c.id }, data: { botReplyText: text } });
        drafted++;
        budget--;
        perVideo.set(c.videoId, (perVideo.get(c.videoId) ?? 0) + 1);
        usedTexts.add(text.toLowerCase());
        continue;
      }

      try {
        token ??= await accessToken(account);
        const replyId =
          account.platform === "facebook"
            ? await facebook.replyToComment(c.platformCommentId, text, token)
            : await youtube.replyToComment(c.platformCommentId, text, token);
        await prisma.videoComment.update({
          where: { id: c.id },
          data: {
            botReplyText: text,
            botReplyId: replyId,
            botRepliedAt: new Date(),
            status: "replied",
            statusUpdatedBy: `bot (${account.name})`,
          },
        });
        posted++;
        postedToday++;
        budget--;
        perVideo.set(c.videoId, (perVideo.get(c.videoId) ?? 0) + 1);
        usedTexts.add(text.toLowerCase());
        await pause(3000 + Math.random() * 5000);
      } catch (err) {
        errors++;
        const message = err instanceof Error ? err.message : String(err);
        await prisma.videoComment.update({ where: { id: c.id }, data: { botReplyText: text, botReplyError: message.slice(0, 500) } });
        await prisma.connectedAccount.update({ where: { id: account.id }, data: { lastError: message.slice(0, 500) } });
        if (/token|session|permission|OAuth|expired/i.test(message)) break;
      }
    }

    summary.push({ account: account.name, posted, drafted, errors });
  }

  return summary;
}
