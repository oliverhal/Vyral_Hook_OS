import { NextRequest, NextResponse } from "next/server";
import { requireArtieReviewer } from "@/lib/artieServer";
import { isProgramme } from "@/lib/artie/programme";
import { bearerFrom, secretMatches } from "@/lib/artie/trackerAuth";
import { computeOverview } from "./overview";
import { summariseProgramme, publicView } from "@/lib/artie/summary";

// Programme-level aggregates for the client-facing Video Views Tracker.
//   default            → team counts + goal progress only (no login, CDN-cacheable).
//   ?view=full         → everything: behind/on-track split, spend, bonuses.
//                        · TRACKER_API_SECRET NOT set → open to anyone with the URL (aggregates only, 5-min CDN cache).
//                        · TRACKER_API_SECRET set     → needs `Authorization: Bearer <secret>` (or a signed-in reviewer); never cached.
// Setting the secret later locks the money/bonus numbers without any other change.
// No CORS headers on purpose — the tracker must call this from its server, not from a browser.
export async function handleTracker(req: NextRequest) {
  const programme = req.nextUrl.searchParams.get("programme") ?? "artie";
  if (!isProgramme(programme)) return NextResponse.json({ error: "programme must be artie or ecosia" }, { status: 400 });
  const full = req.nextUrl.searchParams.get("view") === "full";
  const secret = process.env.TRACKER_API_SECRET;
  const locked = full && !!secret;

  if (locked) {
    const viaSecret = secretMatches(bearerFrom(req.headers.get("authorization")), secret);
    if (!viaSecret && (await requireArtieReviewer()).error) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
  }

  const summary = summariseProgramme(await computeOverview(programme, req.nextUrl.searchParams.get("cycle") ?? ""));
  return NextResponse.json(full ? summary : publicView(summary), {
    // Open responses are identical for everyone, so the CDN may share them for 5 minutes (also protects the database).
    headers: { "Cache-Control": locked ? "no-store" : "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
