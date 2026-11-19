import type { CommentProject, ConnectedAccount, TrackedVideo } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import * as viraldeck from "@/lib/viraldeck";
import * as viralApp from "@/lib/viralApp";
import { triageComments } from "@/lib/commentTriage";
import { accessToken, accountForVideo, normalizeHandle } from "@/lib/connectedAccounts";
import * as facebook from "@/lib/facebook";
import * as youtube from "@/lib/youtube";

// Facebook and YouTube: the platforms the bot can reply on (as the posting
// Page/channel, or on YouTube as the campaign's brand channel).
export const TRACKED_PLATFORMS = ["facebook", "youtube"];

// Comments are checked twice a day (morning and evening cron batches).
const REFETCH_AFTER_HOURS = 8;

function appName(projectName: string): string {
  return projectName.replace(/[^\w\s.&-]/g, "").trim();
}

/** Mirror the tracker projects into CommentProject rows (new ones start disabled). */
export async function syncProjectList(): Promise<void> {
  if (process.env.VIRALDECK_API_KEY) {
    for (const p of await viraldeck.listProjects()) {
      await prisma.commentProject.upsert({
        where: { source_externalId: { source: "viraldeck", externalId: p.id } },
        create: { source: "viraldeck", externalId: p.id, name: p.name },
        update: { name: p.name },
      });
    }
  }
  if (process.env.VIRAL_APP_API_KEY) {
    await prisma.commentProject.upsert({
      where: { source_externalId: { source: "viralapp", externalId: "default" } },
      create: { source: "viralapp", externalId: "default", name: "Artie" },
      update: {},
    });
  }
}

/** Pull 10K+ videos from the lookback window for every enabled project. */
export async function syncVideos(): Promise<{ project: string; videos: number; error?: string }[]> {
  const projects = await prisma.commentProject.findMany({ where: { enabled: true } });
  const summary: { project: string; videos: number; error?: string }[] = [];

  // One project's tracker error shouldn't stop the others syncing.
  for (const project of projects) {
    try {
      summary.push({ project: project.name, videos: await syncProjectVideos(project) });
    } catch (err) {
      summary.push({ project: project.name, videos: 0, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return summary;
}

async function syncProjectVideos(project: CommentProject): Promise<number> {
  const rows =
    project.source === "viralapp"
      ? (await viralApp.fetchTopVideos(project.minViews, project.lookbackDays)).map((v) => ({
          platform: v.platform,
          platformVideoId: v.platformVideoId,
          creatorHandle: v.accountUsername,
          title: v.caption,
          url: viralApp.videoUrl(v.platform, v.platformVideoId, v.accountUsername),
          thumbnailUrl: v.thumbnailUrl,
          publishedAt: v.publishedAt,
          views: v.viewCount,
          commentCount: v.commentCount,
        }))
      : (await viraldeck.fetchTopVideos(project.externalId, project.minViews, project.lookbackDays)).flatMap((v) => {
          const platformVideoId = viralApp.platformVideoIdFromUrl(v.platform, v.url);
          if (!platformVideoId) return [];
          return [
            {
              platform: v.platform,
              platformVideoId,
              creatorHandle: v.creatorHandle,
              title: v.title,
              url: v.url,
              thumbnailUrl: v.thumbnailUrl,
              publishedAt: v.publishedAt,
              views: v.views,
              commentCount: v.comments,
            },
          ];
        });

  const tracked = rows.filter((r) => TRACKED_PLATFORMS.includes(r.platform));
  for (const r of tracked) {
    const data = {
      projectId: project.id,
      creatorHandle: r.creatorHandle,
      title: r.title,
      url: r.url,
      thumbnailUrl: r.thumbnailUrl,
      publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
      views: r.views,
      commentCount: r.commentCount,
      lastSeenAt: new Date(),
    };
    await prisma.trackedVideo.upsert({
      where: { platform_platformVideoId: { platform: r.platform, platformVideoId: r.platformVideoId } },
      create: { platform: r.platform, platformVideoId: r.platformVideoId, ...data },
      update: data,
    });
  }

  await prisma.commentProject.update({ where: { id: project.id }, data: { lastSyncedAt: new Date() } });
  return tracked.length;
}

type FetchedComment = {
  id: string;
  authorHandle: string | null;
  text: string;
  likeCount: number;
  replyCount: number;
  postedAt: string | null;
  replyAuthors: string[];
};

interface VideoSource {
  comments: FetchedComment[];
  // Lowercased ids whose replies count as "already answered".
  answeredBy: Set<string>;
  replyAccount: ConnectedAccount;
  asBrand: boolean;
}

/**
 * Comments for one video, read with the account the bot will reply as:
 *  - the Page/channel that posted it, when it's connected (replies as the
 *    creator), or
 *  - for YouTube, the campaign's brand channel (replies openly as the brand;
 *    YouTube lets any channel reply under any public video).
 * Returns null when nobody can reply, so we don't spend API calls on it.
 */
async function sourceForVideo(video: TrackedVideo & { project: CommentProject }): Promise<VideoSource | null> {
  const owner = await accountForVideo(video.platform, video.creatorHandle, video.platformVideoId);
  if (owner) {
    const token = await accessToken(owner);
    const comments =
      video.platform === "facebook"
        ? (await facebook.listComments(video.platformVideoId, token)).map((c) => ({
            id: c.id, authorHandle: c.authorName, text: c.text, likeCount: c.likeCount, replyCount: c.replyCount,
            postedAt: c.postedAt, replyAuthors: c.replyAuthorIds.map((a) => a.toLowerCase()),
          }))
        : (await youtube.listComments(video.platformVideoId, token)).map((c) => ({
            id: c.id, authorHandle: c.authorHandle, text: c.text, likeCount: c.likeCount, replyCount: c.replyCount,
            postedAt: c.postedAt, replyAuthors: c.replyAuthorChannelIds.map((a) => a.toLowerCase()),
          }));
    const answeredBy = new Set([owner.externalId.toLowerCase(), normalizeHandle(video.creatorHandle)].filter(Boolean));
    return { comments, answeredBy, replyAccount: owner, asBrand: false };
  }

  if (video.platform !== "youtube" || !video.project.brandYoutubeAccountId) return null;
  const brand = await prisma.connectedAccount.findUnique({ where: { id: video.project.brandYoutubeAccountId } });
  if (!brand) return null;
  const token = await accessToken(brand);
  const creatorChannel = await youtube.videoChannelId(video.platformVideoId, token).catch(() => null);
  const comments = (await youtube.listComments(video.platformVideoId, token)).map((c) => ({
    id: c.id, authorHandle: c.authorHandle, text: c.text, likeCount: c.likeCount, replyCount: c.replyCount,
    postedAt: c.postedAt, replyAuthors: c.replyAuthorChannelIds.map((a) => a.toLowerCase()),
  }));
  // Skip comments the creator or the brand has already answered.
  const answeredBy = new Set([brand.externalId.toLowerCase(), creatorChannel?.toLowerCase() ?? ""].filter(Boolean));
  return { comments, answeredBy, replyAccount: brand, asBrand: true };
}

/**
 * Fetch comments for the most-viewed videos that haven't been checked in the
 * last REFETCH_AFTER_HOURS, then triage any new comments. Processes at most
 * maxVideos per call so it fits inside one serverless invocation; the cron
 * runs in morning and evening batches to work through the queue.
 */
export async function fetchAndTriage(maxVideos: number) {
  const staleBefore = new Date(Date.now() - REFETCH_AFTER_HOURS * 60 * 60 * 1000);
  const videos = await prisma.trackedVideo.findMany({
    where: {
      project: { enabled: true },
      platform: { in: TRACKED_PLATFORMS },
      commentCount: { gt: 0 },
      OR: [{ commentsFetchedAt: null }, { commentsFetchedAt: { lt: staleBefore } }],
    },
    include: { project: true },
    orderBy: { views: "desc" },
    take: maxVideos,
  });

  const summary: { video: string; comments: number; triaged: number; error?: string }[] = [];

  for (const video of videos) {
    try {
      const source = await sourceForVideo(video);
      if (!source) {
        await prisma.trackedVideo.update({
          where: { id: video.id },
          data: { commentsFetchedAt: new Date(), commentsFetchError: null, replyAccountId: null },
        });
        summary.push({ video: video.url, comments: 0, triaged: 0, error: "no connected account or brand channel" });
        continue;
      }
      const { comments, answeredBy, replyAccount, asBrand } = source;

      // Switching between creator voice and brand voice: re-draft replies
      // that haven't been posted yet.
      if (video.replyAsBrand !== asBrand) {
        await prisma.videoComment.updateMany({
          where: { videoId: video.id, botReplyId: null },
          data: { intent: null, needsReply: false, suggestedReply: null, botReplyText: null },
        });
      }
      await prisma.trackedVideo.update({
        where: { id: video.id },
        data: { replyAccountId: replyAccount.id, replyAsBrand: asBrand },
      });

      for (const c of comments) {
        if (!c.text) continue;
        const creatorReplied = c.replyAuthors.some((a) => answeredBy.has(a));
        const fresh = { likeCount: c.likeCount, replyCount: c.replyCount, repliesChecked: true, creatorReplied };
        await prisma.videoComment.upsert({
          where: { videoId_platformCommentId: { videoId: video.id, platformCommentId: c.id } },
          create: {
            videoId: video.id,
            platformCommentId: c.id,
            authorHandle: c.authorHandle,
            text: c.text,
            postedAt: c.postedAt ? new Date(c.postedAt) : null,
            ...fresh,
          },
          update: fresh,
        });
      }

      const untriaged = await prisma.videoComment.findMany({ where: { videoId: video.id, intent: null } });
      let triaged = 0;
      if (untriaged.length > 0) {
        const results = await triageComments(
          {
            appName: appName(video.project.name),
            replyBrief: video.project.replyBrief,
            platform: video.platform,
            creatorHandle: video.creatorHandle,
            videoTitle: video.title,
            asBrand,
          },
          untriaged.map((c) => ({ id: c.id, text: c.text, language: c.language, replyCount: c.replyCount }))
        );
        for (const r of results) {
          await prisma.videoComment.update({
            where: { id: r.id },
            data: { intent: r.intent, needsReply: r.needsReply, suggestedReply: r.suggestedReply },
          });
        }
        triaged = results.length;
      }

      // Already answered by the creator (or the brand) — nothing to post.
      await prisma.videoComment.updateMany({
        where: { videoId: video.id, creatorReplied: true, status: "open" },
        data: { status: "replied", statusUpdatedBy: "creator (auto)" },
      });

      await prisma.trackedVideo.update({
        where: { id: video.id },
        data: { commentsFetchedAt: new Date(), commentsFetchError: null },
      });
      summary.push({ video: video.url, comments: comments.length, triaged });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.trackedVideo.update({
        where: { id: video.id },
        data: { commentsFetchedAt: new Date(), commentsFetchError: message.slice(0, 500) },
      });
      summary.push({ video: video.url, comments: 0, triaged: 0, error: message });
    }
  }

  return summary;
}
