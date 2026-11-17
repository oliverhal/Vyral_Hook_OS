import { cycleFor, shiftCycle, cycleByKey, inCycle, zonedMidnight, removalGraceEnd } from "../src/lib/artie/cycle";
import { matchCrossPosts } from "../src/lib/artie/match";
import { parseCsv, parseRoster, sheetExportUrl, extractHandle, parseRate, resolveFacebookShares, FB_SHARE_PREFIX, parseStartDate } from "../src/lib/artie/payrollSheet";
import { paceFor } from "../src/lib/artie/pace";
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
const fb = { id: "fb1", platform: "facebook", publishedAt: t0 + 1 * H, durationSeconds: 20.9, caption: null };
const other = { id: "tt2", platform: "tiktok", publishedAt: t0 + 3 * H, durationSeconds: 45, caption: "totally different" };
const m = matchCrossPosts([ig, tt, fb, other]);
ok(m.some((x) => x.postId === "tt1" && x.igId === "ig1"), "TikTok with same runtime + close time matches the IG post");
ok(m.some((x) => x.postId === "fb1" && x.igId === "ig1"), "FB with same runtime matches even with no caption");
ok(!m.some((x) => x.postId === "tt2"), "different runtime does not match");
ok(matchCrossPosts([ig, { ...tt, publishedAt: t0 + 3 * 24 * H }]).length === 0, "posted 3 days apart is not a cross-post");
ok(matchCrossPosts([{ ...ig, durationSeconds: null }, { ...tt, durationSeconds: null, publishedAt: t0 + 8 * H, caption: "unrelated words here" }]).length === 0, "no runtime + dissimilar captions + 8h apart: no match");
ok(matchCrossPosts([{ ...ig, durationSeconds: null }, { ...tt, durationSeconds: null }]).length === 1, "no runtime but matching captions: match");
// Template captions: identical caption on a different video 5h later must NOT be treated as a cross-post.
ok(matchCrossPosts([{ ...ig, durationSeconds: null }, { ...tt, durationSeconds: null, publishedAt: t0 + 8 * H, caption: ig.caption }]).length === 0, "same template caption but 8h apart: not a cross-post (beyond the 6h leftover window)");
ok(matchCrossPosts([{ ...ig, durationSeconds: null }, { ...tt, durationSeconds: null, publishedAt: t0 + 5 * H, caption: ig.caption }]).length === 1, "5h apart, both otherwise unmatched: paired in the leftover pass");
ok(matchCrossPosts([{ ...ig, durationSeconds: null }, { ...tt, durationSeconds: null, publishedAt: t0 + 10 * 60000, caption: "Learning piano with Artie" }]).length === 1, "posted 10 min apart with overlapping caption: match");
ok(matchCrossPosts([{ ...ig, durationSeconds: null }, { ...tt, durationSeconds: null, publishedAt: t0 + 90 * 60000, caption: "Learning piano" }]).length === 1, "90 min apart with a weak caption match: still paired, because both are otherwise unmatched leftovers");
const twoTT = matchCrossPosts([ig, tt, { ...tt, id: "tt3", publishedAt: t0 + 20 * H }]);
ok(twoTT.filter((x) => x.igId === "ig1").length === 1, "one IG post takes at most one TikTok match");


// ── leftover pass ───────────────────────────────────────────────────────────
const L = (id: string, platform: string, mins: number, cap: string | null, dur: number | null = null) => ({ id, platform, publishedAt: t0 + mins * 60000, durationSeconds: dur, caption: cap });
const lo = matchCrossPosts([L("i1", "instagram", 0, "alpha beta gamma"), L("t1", "tiktok", 25, "completely different words")]);
ok(lo.length === 1 && lo[0].igId === "i1", "leftover pass: different captions 25 min apart but both unmatched → paired");
ok(matchCrossPosts([L("i1", "instagram", 0, "alpha beta gamma"), L("t1", "tiktok", 7 * 60, "completely different words")]).length === 0, "leftover pass: 7h apart → not paired");
ok(matchCrossPosts([L("i1", "instagram", 0, "alpha", 20), L("t1", "tiktok", 25, "other", 45)]).length === 0, "leftover pass: runtimes known and different → not paired");
const best = matchCrossPosts([L("i1", "instagram", 0, "aa bb"), L("i2", "instagram", 60, "cc dd"), L("t1", "tiktok", 50, "zz yy")]);
ok(best.length === 1 && best[0].igId === "i2", "leftover pass: pairs with the nearest-in-time IG post");
const strictFirst = matchCrossPosts([L("i1", "instagram", 0, "same caption text"), L("i2", "instagram", 30, "other words here"), L("t1", "tiktok", 1, "same caption text"), L("t2", "tiktok", 31, "unrelated zzz")]);
ok(strictFirst.find((m) => m.postId === "t1")!.igId === "i1" && strictFirst.find((m) => m.postId === "t2")!.igId === "i2", "strict matches win first; leftovers then pair with what's left");

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

// ── the real payroll sheet's layout (multi-programme, with sensitive columns) ─
const real = [
  " Creator ID,Creator Full Name,Client Name,Tiktok,Instagram,Facebook,Email,Password,Status,Monthly Rate ($),Per-Video Rate ($) (Tiktok only),Payment Details,Notes",
  "C-001,Kira Piano,Artie,https://www.tiktok.com/@kirapiano,https://www.instagram.com/kira.piano,https://www.facebook.com/profile.php?id=9001,kira@x.com,hunter2,Active,€500,8.33,IBAN DE00 SECRET,secret note",
  "C-002,Blank Status,Artie,https://www.tiktok.com/@blank,https://www.instagram.com/blank.ig,,b@x.com,pw2,,€500,8.33,acct 999,",
  "C-003,Fired Person,Artie,https://www.tiktok.com/@fired,https://www.instagram.com/fired.ig,,f@x.com,pw3,Fired,€500,8.33,acct 111,",
  "C-004,Ecosia Creator,Ecosia,https://www.tiktok.com/@eco,https://www.instagram.com/eco.ig,,e@x.com,pw4,Active,€500,8.33,acct 222,",
  "C-005,No Handles Artie,Artie,N/A,none,,n@x.com,pw5,Active,€500,8.33,PAYPAL SECRET,",
  "C-006,artie lower,artie,https://www.tiktok.com/@lowercase,,,l@x.com,pw6,Active,€800,13.33,acct 333,",
].join("\n");
const rr = parseRoster(parseCsv(real), { client: "Artie" });
ok(!rr.error && rr.columns.name === "Creator Full Name" && rr.columns.id === "Creator ID", "real sheet: name is 'Creator Full Name', not 'Creator ID' (leading space in header tolerated)");
ok(rr.columns.rate === "Per-Video Rate ($) (Tiktok only)", "real sheet: reads the per-video rate, not the monthly retainer");
ok(rr.creators.map((c) => c.name).sort().join("|") === "Blank Status|Kira Piano|artie lower", "real sheet: Artie only, case-insensitive; Fired and other programmes excluded; blank status kept");
ok(rr.skipped.otherClient === 1 && rr.skipped.inactive === 1, "real sheet: counts what it skipped (1 other programme, 1 fired)");
ok(rr.creators.find((c) => c.name === "Kira Piano")!.sheetKey === "id:C-001" && rr.creators.find((c) => c.name === "Kira Piano")!.ratePerVideo === 8.33, "real sheet: Creator ID is the stable key; per-video rate 8.33");
ok(rr.creators.find((c) => c.name === "Kira Piano")!.facebook === "9001", "real sheet: Facebook profile.php?id= becomes the page id");
ok(rr.unmapped.length === 1 && rr.unmapped[0].label === "No Handles Artie", "real sheet: unusable row is listed by name only");
const blob = JSON.stringify(rr);
ok(!/hunter2|pw\d|SECRET|acct \d+|IBAN|PAYPAL/i.test(blob), "real sheet: no passwords, bank/payment details or notes appear anywhere in the parsed result");
ok(parseRoster(parseCsv(real), { client: "Nope" }).creators.length === 0, "client filter with no matches imports nobody (and doesn't fall back to everyone)");
ok(parseRoster(parseCsv(real), {}).creators.length === 4, "blank client filter imports every non-fired row with a handle (4)");
ok(parseRoster(parseCsv("Creator Name,Instagram\nA,@a"), { client: "Artie" }).error?.includes("Client Name") === true, "a client filter on a sheet with no client column errors instead of importing everyone");
const monthlyOnly = parseRoster(parseCsv("Creator Name,Instagram,Monthly Rate\nA,@a,€500"));
ok(monthlyOnly.creators[0].ratePerVideo === null && monthlyOnly.columns.rate === null, "a monthly-only sheet leaves the per-video rate empty rather than mislabelling it");

// ── Facebook links ──────────────────────────────────────────────────────────
ok(extractHandle("https://www.facebook.com/people/Heidi-Plays/61596075565168/", "facebook") === "61596075565168", "FB /people/Name/<id> → the numeric page id");
ok(extractHandle("https://www.facebook.com/people/Dustin-Keys/pfbid0Yr51EFHwahAv8Q4heiob1o6GjcMGuptt4eFJs9vcmQ8BNLU7FtNKCaqtXjmVxasMl/", "facebook") === "dustin-keys", "FB /people/Name/<pfbid> → the page name (no numeric id available)");
ok(extractHandle("https://www.facebook.com/pages/Some-Page/1234567890/", "facebook") === "1234567890", "FB /pages/Name/<id> → id");
ok(extractHandle("https://www.facebook.com/share/1Ap2H8DK95/?mibextid=x", "facebook")?.startsWith(FB_SHARE_PREFIX) === true, "FB share link is flagged for resolution, not read as the page 'share'");
ok(extractHandle("https://www.facebook.com/profile.php?id=9001", "facebook") === "9001" && extractHandle("https://www.facebook.com/andrealearnspiano", "facebook") === "andrealearnspiano", "FB profile.php?id= and plain page URLs still work");
const shareRows = [{ sheetKey: "a", name: "A", ratePerVideo: null, rateSource: null, instagram: null, tiktok: null, facebook: `${FB_SHARE_PREFIX}https://www.facebook.com/share/abc/` }, { sheetKey: "b", name: "B", ratePerVideo: null, rateSource: null, instagram: null, tiktok: null, facebook: `${FB_SHARE_PREFIX}https://www.facebook.com/share/zzz/` }, { sheetKey: "c", name: "C", ratePerVideo: null, rateSource: null, instagram: null, tiktok: null, facebook: "kept" }] as any;
(async () => {
  await resolveFacebookShares(shareRows, (async (u: string) => { if (String(u).includes("zzz")) throw new Error("blocked"); return { url: "https://www.facebook.com/people/Geraldpiano/61576486175052/?mibextid=x" } as any; }) as any);
  ok(shareRows[0].facebook === "61576486175052", "share link followed → the page id from where it lands");
  ok(shareRows[1].facebook === null, "a share link that can't be followed becomes null, not a wrong handle");
  ok(shareRows[2].facebook === "kept", "non-share values are untouched");
})();

// ── per-video rates (sheet vs derived) ──────────────────────────────────────
const derived = parseRoster(parseCsv("Creator Full Name,Instagram,Monthly Rate ($),Expected Videos / Cyclen on tiktok,Per-Video Rate ($) (Tiktok only)\nA,@a,€500,60,\nB,@b,€500,60,8.33\nC,@c,€500,,\nD,@d,,,"));
const rateOf = (n: string) => derived.creators.find((c) => c.name === n)!;
ok(rateOf("A").ratePerVideo === 8.33 && rateOf("A").rateSource === "derived", "blank per-video rate falls back to monthly ÷ expected videos (€500 ÷ 60 = 8.33)");
ok(rateOf("B").ratePerVideo === 8.33 && rateOf("B").rateSource === "sheet", "a per-video rate on the sheet is used as-is");
ok(rateOf("C").ratePerVideo === null && rateOf("D").ratePerVideo === null, "no expected videos, or no rate at all → no rate (never guessed)");

// ── removed creators stay until the cycle closes ────────────────────────────
ok(removalGraceEnd(new Date("2026-11-10T12:00:00Z")).toISOString() === "2026-12-01T00:00:00.000Z", "removed mid-cycle (10 Nov): stays until the cycle closes (28 Nov) + 2 days = 1 Dec");
ok(removalGraceEnd(new Date("2026-11-30T09:00:00Z")).toISOString() === "2026-12-01T00:00:00.000Z", "removed 1 day after the cycle closed: still belongs to that cycle → gone 1 Dec");
ok(removalGraceEnd(new Date("2026-12-05T09:00:00Z")).toISOString() === "2026-12-31T00:00:00.000Z", "removed early in a new cycle: stays through that cycle + 2 days");
ok(removalGraceEnd(new Date("2026-11-28T23:30:00Z")).toISOString() === "2026-12-01T00:00:00.000Z", "removed on the last day of a cycle: that cycle's grace");

// ── start dates ─────────────────────────────────────────────────────────────
const NOW = new Date("2026-11-17T15:30:00Z");
const sd = (v: string) => parseStartDate(v, NOW)?.toISOString() ?? null;
ok(sd("Nov 11") === "2026-11-11T00:00:00.000Z", "start date 'Nov 11' → 11 Nov this year (London midnight)");
ok(sd("Aug16") === "2026-08-15T23:00:00.000Z", "'Aug16' (no space) → 16 Aug, London summer time");
ok(sd("9 Oct") === "2026-10-08T23:00:00.000Z", "'9 Oct' (day first) → 9 Oct");
ok(sd("Dec 5") === "2025-12-05T00:00:00.000Z", "'Dec 5' is in the future, so it means last year");
ok(sd("Nov 20") === "2026-11-20T00:00:00.000Z", "a start a few days ahead (within a week) keeps this year");
ok(sd("Nov 11, 2025") === "2025-11-11T00:00:00.000Z" && sd("2025-03-04") === "2025-03-04T00:00:00.000Z", "explicit years are used as written");
ok(sd("soon") === null && sd("") === null && sd("31/12/2025") === null, "unreadable or ambiguous values → null, never a guess");
const sheetWithStart = parseRoster(parseCsv("Creator Full Name,Instagram,Start Date (when they joined slack)\nA,@a,Nov 11\nB,@b,"), { now: NOW });
ok(sheetWithStart.creators[0].startDate?.toISOString() === "2026-11-11T00:00:00.000Z" && sheetWithStart.creators[1].startDate === null, "roster reads the start-date column; blank stays null");

// ── pace (2 a day, from their own start date) ───────────────────────────────
const cyc2 = cycleFor(NOW); // 29 Oct → 28 Nov
const pc = (counted: number, startDate: string | null, now = new Date("2026-11-17T12:00:00Z"), cycle = cyc2) => paceFor({ counted, cycle, startDate: startDate ? new Date(startDate) : null, now, perDay: 2 });
ok(pc(40, null).expected === 39 && pc(40, null).status === "ahead" && pc(40, null).delta === 1, "full-cycle creator, 19.5 days in: 39 expected; 40 posted → ahead");
ok(pc(36, null).status === "on_track" && pc(30, null).status === "behind" && pc(30, null).delta === -9, "36/39 is on track (within 10%); 30/39 is 9 behind");
const newbie = pc(12, "2026-11-11T00:00:00Z");
ok(newbie.expected === 13 && newbie.startedThisCycle && newbie.status === "on_track", "joined 11 Nov: only 6.5 days counted → 13 expected, not 39");
ok(pc(12, "2026-09-20T00:00:00Z").expected === 39 && !pc(12, "2026-09-20T00:00:00Z").startedThisCycle, "started before the cycle: measured from the cycle start");
ok(pc(0, "2026-11-20T00:00:00Z").status === "not_started" && pc(0, "2026-11-20T00:00:00Z").expected === 0, "start date in the future: no expectation yet");
ok(pc(1, "2026-11-17T08:00:00Z").status === "just_started", "under a day in: just started, not judged");
const closed = pc(60, null, new Date("2026-11-17T12:00:00Z"), shiftCycle(cyc2, -1));
ok(closed.expected === 60 && closed.status === "ahead", "a closed cycle expects the full 30 days × 2 = 60");

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
c = countVideos(posts, "instagram");
ok(c.counted === 2 && c.needsReview.length === 1 && c.needsReview[0].id === "tt9", "instagram mode: TikTok-only post is NOT counted and lands in needs-review");
ok(c.discrepancy, "IG 2 vs TikTok 1 raises the internal discrepancy flag");
ok(countVideos([P("ig1", "instagram", 1), P("tt9", "tiktok", 1, null, "count")], "instagram").counted === 2, "reviewer 'count' decision includes the TikTok-only post");
ok(countVideos([P("ig1", "instagram", 1), P("tt9", "tiktok", 1, null, "ignore")], "instagram").needsReview.length === 0, "reviewer 'ignore' clears it from needs-review");
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

// ── unique-video count mode (default) ──────────────────────────────────────
const tiktokOnly = Array.from({ length: 31 }, (_, i) => P("t" + i, "tiktok", 1000 + i));
ok(countVideos(tiktokOnly).counted === 31 && countVideos(tiktokOnly).needsReview.length === 0, "unique mode: a creator with 31 TikToks and no Instagram counts 31 (not 0)");
ok(countVideos(tiktokOnly, "instagram").counted === 0, "instagram mode: the same creator counts 0");
const mixed = [P("ig1", "instagram", 1), P("tt1", "tiktok", 1, "ig1"), P("fb1", "facebook", 1, "ig1"), P("ig2", "instagram", 1), P("tt2", "tiktok", 1, "ig2"), P("tt3", "tiktok", 1), P("fb9", "facebook", 1)];
ok(countVideos(mixed).counted === 4, "unique mode: 2 cross-posted videos (3+2 posts) + a TikTok-only + a Facebook-only = 4 unique videos");
ok(countVideos([...mixed, P("tt4", "tiktok", 1, null, "ignore")]).counted === 4, "unique mode: a reviewer's 'ignore' still excludes a post");
ok(countVideos(mixed, "instagram").counted === 2, "instagram mode: only the 2 Instagram videos");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
