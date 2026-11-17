import { getCreatorProgress, type Db } from "../src/lib/artie/views";
import { cycleFor } from "../src/lib/artie/cycle";

let failed = 0;
const ok = (c: boolean, m: string) => { console.log(c ? "ok  " : "FAIL", m); if (!c) failed++; };

const now = new Date("2026-11-17T12:00:00Z");
const cyc = cycleFor(now); // closing 28 Nov 2026
const prevStart = new Date("2026-10-10T12:00:00Z"); // inside the previous cycle
const inCur = new Date("2026-11-05T12:00:00Z");

const TOK_A = "A".repeat(43), TOK_B = "B".repeat(43), TOK_OLD = "O".repeat(43);
const creators = [
  { id: "A", name: "Alpha Creator", accessToken: TOK_A, active: true, ratePerVideo: 99, sheetKey: "a" },
  { id: "B", name: "Bravo Creator", accessToken: TOK_B, active: true, ratePerVideo: 77, sheetKey: "b" },
  { id: "C", name: "Gone Creator", accessToken: "C".repeat(43), active: false, ratePerVideo: 1, sheetKey: "c" },
];
const post = (id: string, creatorId: string, when: Date, views = 1000, platform = "instagram") => ({
  id, creatorId, platform, platformVideoId: id, url: `https://example.com/${id}`, publishedAt: when, views,
  igMatchId: null, countDecision: null, caption: null, durationSeconds: null, username: null,
});
const posts = [
  post("a1", "A", inCur, 250000), post("a2", "A", inCur, 5000), post("a-prev", "A", prevStart),
  post("b1", "B", inCur, 180000), post("b2", "B", inCur), post("b3", "B", inCur), post("b-prev", "B", prevStart),
];
const cand = (id: string, creatorId: string, primaryPostId: string, status: string, initial = 50, approved: number | null = null, cycleKey = cyc.key) =>
  ({ id, creatorId, primaryPostId, cycleKey, status, initialAmount: initial, approvedAmount: approved, maxViews: 200000, flags: '["possible_fb_ig_overlap"]', reason: "internal note" });
const candidates = [
  cand("ca1", "A", "a1", "pending"),
  cand("cb1", "B", "b1", "rejected", 50, 0),
  cand("cb2", "B", "b2", "corrected", 50, 25),
  cand("cb3", "B", "b3", "approved", 50, 50),
];

const matches = (row: Record<string, any>, where: Record<string, any>) =>
  Object.entries(where ?? {}).every(([k, v]) => {
    if (v && typeof v === "object" && !(v instanceof Date)) {
      return (v.gte == null || row[k] >= v.gte) && (v.lt == null || row[k] < v.lt);
    }
    return row[k] === v;
  });

const db = {
  artieCreator: {
    findUnique: async ({ where }: any) => creators.find((c) => c.accessToken === where.accessToken) ?? null,
    findMany: async ({ where }: any) => creators.filter((c) => (where?.active === undefined || c.active === where.active)).map((c) => ({ id: c.id })),
  },
  artieSettings: { findUnique: async () => ({ bonusThreshold: 100000, bonusAmount: 50, currency: "USD" }) },
  artiePost: {
    findMany: async ({ where }: any) => posts.filter((p) => matches(p, where)),
    groupBy: async ({ where, _min }: any) => {
      if (_min) { const m = new Map<string, Date>(); for (const p of posts.filter((p) => matches(p, where))) { const c = m.get(p.creatorId); if (!c || p.publishedAt < c) m.set(p.creatorId, p.publishedAt); } return Array.from(m, ([creatorId, d]) => ({ creatorId, _min: { publishedAt: d } })); }
      const m = new Map<string, number>(); for (const p of posts.filter((p) => matches(p, where))) m.set(p.creatorId, (m.get(p.creatorId) ?? 0) + p.views); return Array.from(m, ([creatorId, v]) => ({ creatorId, _sum: { views: v } })); },
  },
  artieBonusCandidate: { findMany: async ({ where }: any) => candidates.filter((c) => matches(c, where)) },
} as unknown as Db;

(async () => {
  const a = (await getCreatorProgress(TOK_A, db, now))!;
  const b = (await getCreatorProgress(TOK_B, db, now))!;

  ok(a.name === "Alpha Creator" && b.name === "Bravo Creator", "each token resolves to its own creator");
  ok(a.countedVideos === 2 && b.countedVideos === 3, "counts are per creator (A=2, B=3)");
  const urlsA = JSON.stringify(a), urlsB = JSON.stringify(b);
  ok(!/\/b\d/.test(urlsA) && !urlsA.includes("Bravo"), "creator A's payload contains none of B's posts or name");
  ok(!/\/a\d/.test(urlsB) && !urlsB.includes("Alpha"), "creator B's payload contains none of A's posts or name");
  // Potential earnings: a creator sees their OWN rate and total, never anyone else's.
  ok(a.potential?.rate === 99 && a.potential.videos === 2 && a.potential.base === 198 && a.potential.bonus === 50 && a.potential.total === 248, "A's potential earnings = 2 videos × 99 + 50 bonus = 248");
  ok(b.potential?.rate === 77 && b.potential.base === 231 && b.potential.bonus === 75 && b.potential.total === 306, "B's potential earnings = 3 × 77 + 75 (rejected bonus excluded) = 306");
  ok(!urlsA.includes('"rate":77') && !urlsA.includes("231") && !urlsB.includes('"rate":99') && !urlsB.includes("198"), "neither creator's page contains the other's rate or earnings");
  // Ranking: with only 2 active creators there's no meaningful percentile, and nothing about anyone else leaks.
  ok(a.rank === null && b.rank === null, "a tiny pool (2 active creators) shows no ranking");
  ok(!JSON.stringify(a).includes("tier") || a.rank === null, "no ranking data leaks when there's no tier");
  ok(a.bonusItems.length === 1 && a.bonusItems[0].url.endsWith("/a1"), "A sees only their own qualifying video");

  ok((await getCreatorProgress("X".repeat(43), db, now)) === null, "unknown token returns nothing");
  ok((await getCreatorProgress("", db, now)) === null && (await getCreatorProgress("short", db, now)) === null, "empty / short tokens return nothing");
  ok((await getCreatorProgress("C".repeat(43), db, now)) === null, "an inactive creator's link stops working");
  ok((await getCreatorProgress(TOK_OLD, db, now)) === null, "a regenerated (old) token no longer resolves");

  const leaks = ["flags", "possible_fb_ig_overlap", "internal note", "ratePerVideo", "discrepancy", "sheetKey", "accessToken"];
  ok(leaks.every((l) => !urlsA.includes(l) && !urlsB.includes(l)), "no internal fields (flags, notes, rate, token, discrepancy) reach the creator payload");

  // Money/state rules for what the creator sees.
  ok(a.bonusItems[0].state === "under_review" && a.bonusItems[0].amount === 50 && a.indicativeBonus === 50, "pending bonus shows as under review at the initial indicative amount");
  const rej = b.bonusItems.find((i) => i.url.endsWith("/b1"))!;
  ok(rej.state === "not_approved" && rej.amount === 0 && rej.previouslyShown === 50, "rejected bonus stays visible as 'not approved' and keeps what they previously saw");
  const adj = b.bonusItems.find((i) => i.url.endsWith("/b2"))!;
  ok(adj.state === "adjusted" && adj.amount === 25 && adj.previouslyShown === 50, "corrected bonus shows the adjusted amount and the earlier one");
  ok(b.bonusCount === 2 && b.indicativeBonus === 75, "rejected is excluded from count/total (25 adjusted + 50 approved)");

  ok(!("previousCycles" in a), "creator payload carries no previous-cycle history");
  ok(a.cycle.endLabel === "28 Nov" && a.cycle.startLabel === "29 Oct", "creator sees the active cycle's date range");

  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
  process.exit(failed ? 1 : 0);
})();
