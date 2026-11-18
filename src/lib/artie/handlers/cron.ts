import { NextRequest, NextResponse } from "next/server";
import { requireArtieReviewer } from "@/lib/artieServer";
import { runArtieSync, deriveAll } from "@/lib/artie/sync";
import type { Programme } from "@/lib/artie/programme";


// Vercel cron sends `Authorization: Bearer $CRON_SECRET`; a reviewer can also
// trigger it from the dashboard ("Sync now"). Unlike the comments cron, a plain
// signed-in session is NOT enough — this touches pay data.
async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return !(await requireArtieReviewer()).error;
}

export async function handleCron(programme: Programme, req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // ?step=derive re-runs only matching + bonus detection (seconds, no ViralDeck calls).
    if (req.nextUrl.searchParams.get("step") === "derive") return NextResponse.json({ ok: true, ...(await deriveAll(programme)) });
    return NextResponse.json({ ok: true, ...(await runArtieSync(programme)) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
