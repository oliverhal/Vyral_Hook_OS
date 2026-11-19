import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchAndTriage, syncProjectList, syncVideos } from "@/lib/commentsSync";
import { runAutoReplies } from "@/lib/commentBot";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Kept small so an Apify scrape plus triage fits in one 300s invocation.
const VIDEOS_PER_RUN = 8;

// Vercel cron sends `Authorization: Bearer $CRON_SECRET`; signed-in team
// members can also trigger it from the Comments page ("Sync now").
async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return Boolean(await getServerSession(authOptions));
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const step = req.nextUrl.searchParams.get("step") ?? "videos";
  try {
    if (step === "videos") {
      await syncProjectList();
      return NextResponse.json({ ok: true, step, projects: await syncVideos() });
    }
    if (step === "comments") {
      return NextResponse.json({ ok: true, step, videos: await fetchAndTriage(VIDEOS_PER_RUN) });
    }
    if (step === "reply") {
      return NextResponse.json({ ok: true, step, accounts: await runAutoReplies() });
    }
    return NextResponse.json({ error: `Unknown step "${step}"` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
