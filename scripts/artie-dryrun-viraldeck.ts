// Read-only: pulls real Artie posts from ViralDeck for the current + previous cycle and runs the
// cross-post matcher, to sanity-check coverage and matching quality before anything is stored.
// Usage: VIRALDECK_ARTIE_API_KEY=vd_... npx ts-node ... scripts/artie-dryrun-viraldeck.ts
import * as fs from "fs";
import { artieProjectId, listAccounts, fetchAccountVideos, mapPool } from "../src/lib/viraldeck";
import { cycleFor, shiftCycle } from "../src/lib/artie/cycle";
import { matchCrossPosts } from "../src/lib/artie/match";

(async () => {
  const cur = cycleFor(new Date()), prev = shiftCycle(cur, -1);
  console.log(`window: ${prev.start.toISOString().slice(0, 10)} → ${cur.end.toISOString().slice(0, 10)}  (cycles ${prev.key}, ${cur.key})`);
  const pid = await artieProjectId();
  const accounts = (await listAccounts(pid)).filter((a) => ["instagram", "tiktok", "facebook"].includes(a.platform));
  console.log("accounts:", accounts.length, accounts.reduce((m: Record<string, number>, a) => ((m[a.platform] = (m[a.platform] ?? 0) + 1), m), {}));
  const t0 = Date.now();
  const per = await mapPool(accounts, Number(process.env.CONC ?? 1), (a) => fetchAccountVideos(pid, a.id, prev.start, cur.end));
  const videos = per.flat();
  if (process.env.CACHE_TO) fs.writeFileSync(process.env.CACHE_TO, JSON.stringify(accounts.map((a, i) => ({ a, videos: per[i] }))));
  console.log(`fetched ${videos.length} in-window videos from ${accounts.length} accounts in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log("per cycle:", videos.reduce((m: Record<string, number>, v) => { const k = cycleFor(new Date(v.publishedAt!)).key; m[k] = (m[k] ?? 0) + 1; return m; }, {}));
  console.log("≥100K views:", videos.filter((v) => v.views >= 100000).length, "| with title:", videos.filter((v) => v.title).length, "of", videos.length);

  // Stand-in "creator" = same handle on 2+ platforms (no roster yet).
  const byHandle = new Map<string, { platform: string; v: typeof videos[number] }[]>();
  accounts.forEach((a, i) => per[i].forEach((v) => { const k = a.handle.toLowerCase().replace(/^@/, ""); (byHandle.get(k) ?? byHandle.set(k, []).get(k)!).push({ platform: a.platform, v }); }));
  let handles = 0, ig = 0, other = 0, matched = 0; const gaps: number[] = []; const sims: number[] = [];
  byHandle.forEach((rows) => {
    if (new Set(rows.map((r) => r.platform)).size < 2) return;
    handles++;
    const posts = rows.map((r) => ({ id: r.v.id, platform: r.platform, publishedAt: new Date(r.v.publishedAt!).getTime(), durationSeconds: null, caption: r.v.title }));
    ig += posts.filter((p) => p.platform === "instagram").length; other += posts.filter((p) => p.platform !== "instagram").length;
    for (const m of matchCrossPosts(posts)) {
      matched++;
      const a = posts.find((p) => p.id === m.postId)!, b = posts.find((p) => p.id === m.igId)!;
      gaps.push(Math.abs(a.publishedAt - b.publishedAt) / 60000);
    }
  });
  const q = (a: number[], p: number) => (a.length ? a.sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(1) : "n/a");
  console.log(`handles on 2+ platforms: ${handles} | IG posts: ${ig}, non-IG posts: ${other}, auto-matched: ${matched}`);
  console.log(`matched pairs publish gap (min): median ${q(gaps, 0.5)}, p90 ${q(gaps, 0.9)}, max ${q(gaps, 1)}`);
})().catch((e) => { console.error(e); process.exit(1); });
