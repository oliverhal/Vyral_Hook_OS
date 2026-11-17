import { NextRequest, NextResponse } from "next/server";
import { requireArtieReviewer } from "@/lib/artieServer";
import { runArtieSync } from "@/lib/artie/sync";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Vercel cron sends `Authorization: Bearer $CRON_SECRET`; a reviewer can also
// trigger it from the dashboard ("Sync now"). Unlike the comments cron, a plain
// signed-in session is NOT enough — this touches pay data.
async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return !(await requireArtieReviewer()).error;
}

async function handle(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await runArtieSync()) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
