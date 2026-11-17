import { cycleFor, shiftCycle, cycleByKey, inCycle, zonedMidnight } from "../src/lib/artie/cycle";
import { matchCrossPosts } from "../src/lib/artie/match";
import { parseCsv, parseRoster, sheetExportUrl, extractHandle, parseRate } from "../src/lib/artie/payrollSheet";
import { countVideos, detectCandidates, type CountPost } from "../src/lib/artie/bonus";

let failed = 0;
const ok = (c: boolean, m: string) => { console.log(c ? "ok  " : "FAIL", m); if (!c) failed++; };
const iso = (d: Date) => d.toISOString();

// ── cycle ──────────────────────────────────────────────────────────────────
// Nov 2026: London is on GMT (UTC+0) → 28 Nov 23:59 London == 23:59Z.
const lastMoment = new Date("2026-11-28T23:59:00Z");
const firstMoment = new Date("2026-11-29T00:00:00Z");
ok(cycleFor(lastMoment).key === "2026-11", "28 Nov 23:59 belongs to the cycle closing in Nov");
ok(cycleFor(firstMoment).key === "2026-12", "29 Nov 00:00 belongs to the next cycle");
const nov = cycleFor(lastMoment);
ok(iso(nov.start) === "2026-10-29T00:00:00.000Z" && iso(nov.end) === "2026-11-29T00:00:00.000Z", "Nov cycle spans 29 Oct 00:00 → 29 Nov 00:00 (excl.)");
ok(nov.startLabel === "29 Oct" && nov.endLabel === "28 Nov", "labels read 29 Oct → 28 Nov");
// BST: 28 Jul 23:59 London == 22:59Z; 29 Jul 00:00 London == 23:00Z on the 28th.
ok(cycleFor(new Date("2026-07-28T22:59:00Z")).key === "2026-07", "BST: 28 Jul 23:59 London still closing cycle");
ok(cycleFor(new Date("2026-07-28T23:00:00Z")).key === "2026-08", "BST: 29 Jul 00:00 London starts next cycle");
// February (non-leap): cutoff is end of 28 Feb.
ok(cycleFor(new Date("2027-02-28T23:59:00Z")).key === "2027-02", "Feb 28 23:59 is the closing cycle");
ok(cycleFor(new Date("2027-03-01T00:00:00Z")).key === "2027-03", "1 Mar starts the next cycle (no 29 Feb)");
const mar = cycleByKey("2027-03")!;
ok(iso(mar.start) === "2027-03-01T00:00:00.000Z" && mar.startLabel === "1 Mar", "Mar cycle starts 1 Mar after a 28-day Feb");
// Leap year.
ok(cycleFor(new Date("2028-02-28T23:59:00Z")).key === "2028-02" && cycleFor(new Date("2028-02-29T00:00:00Z")).key === "2028-03", "leap Feb: 29 Feb opens the next cycle");
// Year rollover + shifting.
ok(cycleFor(new Date("2026-12-29T00:00:00Z")).key === "2027-01", "29 Dec rolls into the Jan cycle");
ok(shiftCycle(cycleByKey("2027-01")!, -1).key === "2026-12" && shiftCycle(cycleByKey("2026-12")!, 1).key === "2027-01", "shiftCycle crosses year boundaries");
ok(cycleByKey("2026-13") === null && cycleByKey("nope") === null, "cycleByKey rejects bad keys");
ok(inCycle(lastMoment, nov) && !inCycle(firstMoment, nov), "inCycle boundary is [start, end)");
ok(iso(zonedMidnight(2026, 6, 29)) === "2026-07-28T23:00:00.000Z", "London midnight in BST is 23:00Z the day before");

// ── match ──────────────────────────────────────────────────────────────────
const H = 3600e3, t0 = Date.parse("2026-11-05T10:00:00Z");
const ig = { id: "ig1", platform: "instagram", publishedAt: t0, durationSeconds: 21, caption: "Learning piano with Artie #piano" };
const tt = { id: "tt1", platform: "tiktok", publishedAt: t0 + 2 * H, durationSeconds: 21.4, caption: "Learning piano with Artie #piano #fyp" };
const fb = { id: "fb1", platform: "facebook", publishedAt: t0 + 5 * H, durationSeconds: 20.9, caption: null };
const other = { id: "tt2", platform: "tiktok", publishedAt: t0 + 3 * H, durationSeconds: 45, caption: "totally different" };
const m = matchCrossPosts([ig, tt, fb, other]);
ok(m.some((x) => x.postId === "tt1" && x.igId === "ig1"), "TikTok with same runtime + close time matches the IG post");
ok(m.some((x) => x.postId === "fb1" && x.igId === "ig1"), "FB with same runtime matches even with no caption");
ok(!m.some((x) => x.postId === "tt2"), "different runtime does not match");
ok(matchCrossPosts([ig, { ...tt, publishedAt: t0 + 3 * 24 * H }]).length === 0, "posted 3 days apart is not a cross-post");
ok(matchCrossPosts([{ ...ig, durationSeconds: null }, { ...tt, durationSeconds: null, caption: "unrelated words here" }]).length === 0, "no runtime + dissimilar captions: no match");
ok(matchCrossPosts([{ ...ig, durationSeconds: null }, { ...tt, durationSeconds: null }]).length === 1, "no runtime but matching captions: match");
const twoTT = matchCrossPosts([ig, tt, { ...tt, id: "tt3", publishedAt: t0 + 20 * H }]);
ok(twoTT.filter((x) => x.igId === "ig1").length === 1, "one IG post takes at most one TikTok match");


// ── payroll sheet ──────────────────────────────────────────────────────────
const csv = [
  "Artie creator payroll,,,,,",
  "Creator Name,Email,Rate per video,Instagram,TikTok,Facebook",
  '"Smith, Jo",jo@x.com,$12.50,@jo.piano,https://www.tiktok.com/@jopiano?lang=en,https://facebook.com/profile.php?id=1000123',
  'Maria Lopez,,"€ 15",https://instagram.com/maria.l/,N/A,',
  'No Handles,,10,n/a,none,',
  ',,10,@ghost,,',
  '"Multi\nLine Name",ml@x.com,9,@ml,@ml_tt,',
  "Maria Lopez,,15,@maria2,,",
  ",,,,,",
].join("\n");
const rows = parseCsv(csv);
ok(rows[2][0] === "Smith, Jo", "CSV: quoted comma stays in one cell");
ok(rows.some((r) => r[0] === "Multi\nLine Name"), "CSV: quoted newline stays in one cell");
const ro = parseRoster(rows);
ok(!ro.error && ro.columns.instagram === "Instagram" && ro.columns.rate === "Rate per video", "roster: header row found below a title row, columns detected");
const jo = ro.creators.find((c) => c.name === "Smith, Jo")!;
ok(jo.sheetKey === "jo@x.com" && jo.ratePerVideo === 12.5, "roster: email becomes the stable key, $12.50 parsed");
ok(jo.instagram === "jo.piano" && jo.tiktok === "jopiano" && jo.facebook === "1000123", "roster: @handle, TikTok URL and FB profile.php?id= all normalised");
const maria = ro.creators.find((c) => c.name === "Maria Lopez")!;
ok(maria.instagram === "maria.l" && maria.tiktok === null && maria.facebook === null && maria.ratePerVideo === 15, "roster: IG URL parsed, N/A and blank become null, '€ 15' parsed");
ok(ro.unmapped.some((u) => /No Instagram/.test(u.reason)), "roster: row with no usable handle is listed as unmapped, not dropped");
ok(ro.unmapped.some((u) => u.reason === "No creator name"), "roster: row with no name is listed as unmapped");
ok(ro.unmapped.some((u) => /Duplicate/.test(u.reason)), "roster: duplicate creator is listed as unmapped");
ok(ro.creators.length === 3, "roster: three real creators (Jo, Maria, Multi-line)");
ok(parseRoster(parseCsv("a,b\n1,2")).error != null, "roster: no recognisable header gives a clear error");
ok(sheetExportUrl("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit#gid=42")?.endsWith("export?format=csv&gid=42") === true, "sheet URL: keeps the tab gid");
ok(sheetExportUrl("nonsense") === null, "sheet URL: rejects non-sheet input");
ok(extractHandle("@Foo_Bar", "instagram") === "foo_bar" && extractHandle("don't have one", "tiktok") === null, "handles: lower-cased, 'don't have' ignored");
ok(parseRate("n/a") === null && parseRate("1,250.50 USD") === 1250.5, "rate: n/a is null, thousands separators handled");

// ── counting + bonuses ─────────────────────────────────────────────────────
const P = (id: string, platform: string, views: number, igMatchId: string | null = null, countDecision: string | null = null): CountPost =>
  ({ id, platform, views, igMatchId, countDecision });
const ctx = { threshold: 100000, hasFacebookAccount: true, facebookLinked: null as boolean | null };

let posts = [P("ig1", "instagram", 120000), P("tt1", "tiktok", 90000, "ig1"), P("fb1", "facebook", 130000, "ig1")];
let c = countVideos(posts);
ok(c.counted === 1 && !c.discrepancy && c.needsReview.length === 0, "same video on 3 platforms counts once, no discrepancy");
let cand = detectCandidates(posts, ctx);
ok(cand.length === 1 && cand[0].primaryPostId === "ig1", "IG+FB pair over threshold yields ONE candidate (no double bonus)");
ok(cand[0].flags.includes("possible_fb_ig_overlap") && cand[0].qualifiesOn.sort().join() === "facebook,instagram", "…flagged for overlap, qualifying on both");

posts = [P("ig1", "instagram", 50000), P("ig2", "instagram", 40000), P("tt9", "tiktok", 20000)];
c = countVideos(posts);
ok(c.counted === 2 && c.needsReview.length === 1 && c.needsReview[0].id === "tt9", "TikTok-only post is NOT counted and lands in needs-review");
ok(c.discrepancy, "IG 2 vs TikTok 1 raises the internal discrepancy flag");
ok(countVideos([P("ig1", "instagram", 1), P("tt9", "tiktok", 1, null, "count")]).counted === 2, "reviewer 'count' decision includes the TikTok-only post");
ok(countVideos([P("ig1", "instagram", 1), P("tt9", "tiktok", 1, null, "ignore")]).needsReview.length === 0, "reviewer 'ignore' clears it from needs-review");
cand = detectCandidates([P("tt9", "tiktok", 150000)], ctx);
ok(cand.length === 1 && cand[0].flags.includes("tiktok_only") && cand[0].flags.includes("no_ig_counterpart"), "TikTok-only 150K is a flagged candidate, not silently dropped or paid");
ok(detectCandidates([P("ig1", "instagram", 99999)], ctx).length === 0, "99,999 views is below threshold");
ok(detectCandidates([P("ig1", "instagram", 100000)], ctx).length === 1, "exactly 100,000 qualifies");

const noFb = detectCandidates([P("ig1", "instagram", 200000)], { threshold: 100000, hasFacebookAccount: false, facebookLinked: null });
ok(noFb.length === 1 && noFb[0].flags.length === 0, "creator with no Facebook: no FB assumptions, no flags");
const unlinked = detectCandidates([P("ig1", "instagram", 200000)], { threshold: 100000, hasFacebookAccount: true, facebookLinked: false });
ok(!unlinked[0].flags.includes("ig_views_may_include_fb"), "FB known to be unlinked: IG views not flagged as possibly shared");
const unknown = detectCandidates([P("ig1", "instagram", 200000)], ctx);
ok(unknown[0].flags.includes("ig_views_may_include_fb") && unknown[0].flags.includes("fb_linkage_unknown"), "FB present, linkage unknown: flagged for the reviewer");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
