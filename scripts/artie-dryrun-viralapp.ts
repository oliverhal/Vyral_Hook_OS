// Read-only: pulls real viral.app posts for the current + previous cycle and runs the
// cross-post matcher, to sanity-check coverage and matching before anything is stored.
import * as fs from "fs";
import { fetchVideosBetween } from "../src/lib/viralApp";
import { cycleFor, shiftCycle } from "../src/lib/artie/cycle";
import { matchCrossPosts } from "../src/lib/artie/match";

for (const f of [".env.local"]) for (const l of fs.readFileSync(f, "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

(async () => {
  const cur = cycleFor(new Date()), prev = shiftCycle(cur, -1);
  console.log(`window: ${prev.start.toISOString().slice(0, 10)} → ${cur.end.toISOString().slice(0, 10)}  (cycles ${prev.key}, ${cur.key})`);
  const t0 = Date.now();
  const { videos, truncated } = await fetchVideosBetween(prev.start, cur.end);
  console.log(`fetched ${videos.length} videos in ${((Date.now() - t0) / 1000).toFixed(1)}s, truncated=${truncated}`);
  const by = (k: (v: any) => string) => videos.reduce((a: Record<string, number>, v) => ((a[k(v)] = (a[k(v)] ?? 0) + 1), a), {});
  console.log("by platform:", by((v) => v.platform));
  console.log("with durationSeconds:", videos.filter((v) => v.durationSeconds != null).length, "| with caption:", videos.filter((v) => v.caption).length);
  console.log("posts per cycle:", by((v) => cycleFor(new Date(v.publishedAt!)).key));
  console.log("≥100K views:", videos.filter((v) => v.viewCount >= 100000).length, by((v) => (v.viewCount >= 100000 ? v.platform : "-")));

  // Stand-in "creator" = same normalised handle on instagram + tiktok.
  const key = (v: any) => (v.accountUsername ?? "").toLowerCase().replace(/^@/, "");
  const groups = new Map<string, typeof videos>();
  for (const v of videos) if (v.platform !== "youtube") (groups.get(key(v)) ?? groups.set(key(v), []).get(key(v))!).push(v);
  let multi = 0, igPosts = 0, otherPosts = 0, matched = 0; const durDiffs: number[] = [], gaps: number[] = [];
  groups.forEach((vs) => {
    if (new Set(vs.map((v) => v.platform)).size < 2) return;
    multi++;
    const posts = vs.map((v) => ({ id: v.platformVideoId, platform: v.platform, publishedAt: new Date(v.publishedAt!).getTime(), durationSeconds: v.durationSeconds, caption: v.caption }));
    igPosts += posts.filter((p) => p.platform === "instagram").length; otherPosts += posts.filter((p) => p.platform !== "instagram").length;
    for (const r of matchCrossPosts(posts)) {
      matched++;
      const a = posts.find((p) => p.id === r.postId)!, b = posts.find((p) => p.id === r.igId)!;
      if (a.durationSeconds != null && b.durationSeconds != null) durDiffs.push(Math.abs(a.durationSeconds - b.durationSeconds));
      gaps.push(Math.abs(a.publishedAt - b.publishedAt) / 3600e3);
    }
  });
  const med = (a: number[]) => (a.length ? a.sort((x, y) => x - y)[Math.floor(a.length / 2)].toFixed(2) : "n/a");
  console.log(`handles present on 2+ platforms: ${multi} | their IG posts: ${igPosts}, non-IG posts: ${otherPosts}, auto-matched: ${matched}`);
  console.log(`matched pairs — median |Δduration|: ${med(durDiffs)}s, median publish gap: ${med(gaps)}h`);
})();
