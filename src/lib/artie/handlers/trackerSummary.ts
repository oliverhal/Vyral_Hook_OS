import { NextRequest, NextResponse } from "next/server";
import { requireArtieReviewer } from "@/lib/artieServer";
import { isProgramme } from "@/lib/artie/programme";
import { bearerFrom, secretMatches } from "@/lib/artie/trackerAuth";
import { computeOverview } from "./overview";
import { summariseProgramme } from "@/lib/artie/summary";

// Programme-level aggregates for the client-facing Video Views Tracker. Called server-to-server with
// `Authorization: Bearer $TRACKER_API_SECRET`; a signed-in reviewer may also call it (to preview it).
// No CORS headers on purpose — browsers on other sites must not be able to call this.
export async function handleTracker(req: NextRequest) {
  const viaSecret = secretMatches(bearerFrom(req.headers.get("authorization")), process.env.TRACKER_API_SECRET);
  if (!viaSecret && (await requireArtieReviewer()).error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const programme = req.nextUrl.searchParams.get("programme") ?? "artie";
  if (!isProgramme(programme)) return NextResponse.json({ error: "programme must be artie or ecosia" }, { status: 400 });

  const overview = await computeOverview(programme, req.nextUrl.searchParams.get("cycle") ?? "");
  return NextResponse.json(summariseProgramme(overview), { headers: { "Cache-Control": "no-store" } });
}
