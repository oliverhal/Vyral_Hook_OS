import { prisma } from "@/lib/prisma";
import { accessToken } from "@/lib/connectedAccounts";
import * as facebook from "@/lib/facebook";
import * as youtube from "@/lib/youtube";

// Reply where it helps: people asking about the app, real questions, and
// positive comments where the triage found a natural way to mention the app.
// Jokes, negativity and noise are left alone. Earlier intents are answered
// first so praise never uses up a video's cap before an app question.
const REPLY_INTENTS = ["high_intent", "question", "positive"];
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
          // The comment sync assigns each video the account that replies on it:
          // the Page/channel that posted it, or the campaign's brand channel.
          video: { replyAccountId: account.id, project: { enabled: true } },
        },
        orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
        take: 200,
      })
    ).sort((a, b) => REPLY_INTENTS.indexOf(a.intent ?? "") - REPLY_INTENTS.indexOf(b.intent ?? ""));

    const recent = (
      await prisma.videoComment.findMany({
        where: { botRepliedAt: { gte: since }, video: { replyAccountId: account.id } },
        select: { videoId: true, botReplyText: true },
      })
    );
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
