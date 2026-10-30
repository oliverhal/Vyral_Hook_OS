import type { CommentProject, TrackedVideo } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import * as viraldeck from "@/lib/viraldeck";
import * as viralApp from "@/lib/viralApp";
import { triageComments } from "@/lib/commentTriage";
import { apifyEnabled, scrapeComments, type ScrapedComment } from "@/lib/apify";
import { accessToken, accountForVideo, normalizeHandle } from "@/lib/connectedAccounts";
import * as facebook from "@/lib/facebook";
import * as youtube from "@/lib/youtube";

// Only Facebook Pages and YouTube channels for now: those are the accounts
// the bot can reply as. Add "tiktok" / "instagram" to bring them back into
// the inbox (Apify reply detection for them is already wired up).
export const TRACKED_PLATFORMS = ["facebook", "youtube"];

const COMMENT_PAGES_PER_VIDEO = 3; // ~45–90 comments, 9 viral.app credits
const REFETCH_AFTER_HOURS = 20;

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

type FetchedComment = ScrapedComment & { repliesChecked: boolean };

function fromViralApp(c: viralApp.LiveComment): FetchedComment | null {
  if (!c.platform_comment_id || !c.comment_text) return null;
  if (c.comment_type && c.comment_type !== "top_level") return null;
  return {
    id: c.platform_comment_id,
    authorHandle: c.commenter_username,
    text: c.comment_text,
    language: c.comment_language,
    likeCount: c.like_count ?? 0,
    replyCount: c.reply_count ?? 0,
    postedAt: c.commented_at,
    shareUrl: c.share_url,
    replyAuthors: [],
    repliesChecked: false,
  };
}

/**
 * Comments for one video from the best source available:
 *  - Facebook/YouTube via the official API when the Page/channel is connected
 *    (same comment ids the bot replies to, and real reply authors)
 *  - TikTok/Instagram via the Apify batch scraped up front
 *  - otherwise viral.app, which only counts replies
 * creatorKeys are the lowercased ids/handles that identify the creator among
 * reply authors.
 */
async function commentsForVideo(
  video: TrackedVideo,
  scraped: Map<string, ScrapedComment[]>
): Promise<{ comments: FetchedComment[]; creatorKeys: Set<string> }> {
  const creatorKeys = new Set([normalizeHandle(video.creatorHandle)].filter(Boolean));

  if (video.platform === "facebook" || video.platform === "youtube") {
    const account = await accountForVideo(video.platform, video.creatorHandle, video.platformVideoId);
    if (account) {
      creatorKeys.add(account.externalId.toLowerCase());
      const token = await accessToken(account);
      const official =
        video.platform === "facebook"
          ? (await facebook.listComments(video.platformVideoId, token)).map((c) => ({
              id: c.id, authorHandle: c.authorName, text: c.text, likeCount: c.likeCount, replyCount: c.replyCount,
              postedAt: c.postedAt, replyAuthors: c.replyAuthorIds.map((a) => a.toLowerCase()),
            }))
          : (await youtube.listComments(video.platformVideoId, token)).map((c) => ({
              id: c.id, authorHandle: c.authorHandle, text: c.text, likeCount: c.likeCount, replyCount: c.replyCount,
              postedAt: c.postedAt, replyAuthors: c.replyAuthorChannelIds.map((a) => a.toLowerCase()),
            }));
      return {
        comments: official.map((c) => ({ ...c, language: null, shareUrl: null, repliesChecked: true })),
        creatorKeys,
      };
    }
  }

  const fromApify = scraped.get(`${video.platform}:${video.platformVideoId}`);
  if (fromApify) return { comments: fromApify.map((c) => ({ ...c, repliesChecked: true })), creatorKeys };

  const live = await viralApp.fetchComments(video.platform, video.platformVideoId, COMMENT_PAGES_PER_VIDEO);
  return { comments: live.map(fromViralApp).filter((c): c is FetchedComment => c !== null), creatorKeys };
}

/**
 * Fetch comments for the most-viewed videos that haven't been checked in the
 * last REFETCH_AFTER_HOURS, then triage any new comments. Processes at most
 * maxVideos per call so it fits inside one serverless invocation; the cron
 * runs several times a morning to work through the queue.
 *
 * TikTok/Instagram go through Apify when APIFY_TOKEN is set, because those
 * scrapers list reply authors — so we know whether the creator answered and
 * can clear the comment from the inbox automatically. Everything else (and
 * any Apify failure) falls back to viral.app, which only counts replies.
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

  const scraped = new Map<string, ScrapedComment[]>();
  if (apifyEnabled()) {
    for (const platform of ["tiktok", "instagram"] as const) {
      const urls = videos.filter((v) => v.platform === platform).map((v) => v.url);
      try {
        for (const [key, comments] of Array.from((await scrapeComments(platform, urls)).entries())) {
          scraped.set(`${platform}:${key}`, comments);
        }
      } catch (err) {
        console.error(`Apify ${platform} scrape failed, falling back to viral.app`, err);
      }
    }
  }

  const summary: { video: string; comments: number; triaged: number; error?: string }[] = [];

  for (const video of videos) {
    try {
      const { comments, creatorKeys } = await commentsForVideo(video, scraped);

      for (const c of comments) {
        if (!c.text) continue;
        const creatorReplied = c.repliesChecked && c.replyAuthors.some((a) => creatorKeys.has(a));
        const fresh = {
          likeCount: c.likeCount,
          replyCount: c.replyCount,
          ...(c.repliesChecked && { repliesChecked: true, creatorReplied }),
        };
        await prisma.videoComment.upsert({
          where: { videoId_platformCommentId: { videoId: video.id, platformCommentId: c.id } },
          create: {
            videoId: video.id,
            platformCommentId: c.id,
            authorHandle: c.authorHandle,
            text: c.text,
            language: c.language,
            postedAt: c.postedAt ? new Date(c.postedAt) : null,
            shareUrl: c.shareUrl,
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

      // The creator answered on their own — take it off the VA's list.
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
