// Wording used to push creators who are behind on the daily posting target: what they're missing in
// videos AND money, what's still available, and what to do about it. Pure functions so the same
// numbers drive the creator's link and the message a reviewer copies to send them.
//
// Tone: direct and specific, never shaming. Only the creator's OWN numbers appear — nothing about
// any other creator.

export interface NudgePace {
  status: string;
  actual: number;
  expected: number;
  delta: number; // negative when behind
  remaining: number; // videos still needed to hit the full-cycle target
  daysLeft: number;
  neededPerDay: number;
}

export interface NudgeInput {
  pace: NudgePace;
  rate: number | null; // per-video rate; null → no money wording
  currency: string;
  bonusAmount: number;
  threshold: number;
  cycleEndLabel: string; // e.g. "28 Nov"
  best?: { views: number; platform: string; url: string } | null; // their own best video this cycle
}

export type NudgeSeverity = "close" | "behind" | "far";

export interface NudgeFacts {
  behindBy: number;
  /** Money for the videos they're behind by (what they'd have earned at pace). null without a rate. */
  missed: number | null;
  /** Money still available this cycle if they hit the full target. null without a rate. */
  available: number | null;
  severity: NudgeSeverity;
  urgent: boolean; // final stretch
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function nudgeFacts(i: NudgeInput): NudgeFacts | null {
  if (i.pace.status !== "behind") return null;
  const behindBy = Math.abs(Math.min(0, i.pace.delta));
  const ratio = i.pace.expected > 0 ? i.pace.actual / i.pace.expected : 1;
  return {
    behindBy,
    missed: i.rate != null ? round2(behindBy * i.rate) : null,
    available: i.rate != null && i.pace.remaining > 0 ? round2(i.pace.remaining * i.rate) : null,
    severity: ratio >= 0.75 ? "close" : ratio >= 0.5 ? "behind" : "far",
    urgent: i.pace.daysLeft > 0 && i.pace.daysLeft <= 5,
  };
}

export const money = (n: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);
export const viewsLabel = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));
const daysWord = (d: number) => (d < 1.5 ? "about a day" : `${Math.round(d)} days`);

export interface CreatorNudge {
  headline: string;
  points: string[];
  missed: number | null;
  available: number | null;
  best: { label: string; url: string } | null;
}

/** What a creator sees on their own link when they're behind. null when they aren't. */
export function creatorNudge(i: NudgeInput): CreatorNudge | null {
  const f = nudgeFacts(i);
  if (!f) return null;
  const m = (n: number) => money(n, i.currency);
  const p = i.pace;

  const headline =
    f.severity === "far" ? "You’re missing out on videos — and money"
    : f.severity === "behind" ? "You’re behind schedule — and it’s costing you"
    : "You’re close — a few more videos gets you back on track";

  const points: string[] = [`You’ve posted ${p.actual} videos but need to be at ${p.expected} by now — that’s ${f.behindBy} behind.`];
  if (f.missed != null) points.push(`At ${m(i.rate as number)} a video, that’s ${m(f.missed)} you haven’t earned yet.`);
  if (p.daysLeft > 0 && p.remaining > 0) {
    points.push(
      `${f.urgent ? "Final stretch: only " : ""}${daysWord(p.daysLeft)} left in this cycle (ends ${i.cycleEndLabel}). Post about ${p.neededPerDay} a day to finish on target${f.available != null ? ` — up to ${m(f.available)} is still on the table` : ""}.`
    );
  }
  points.push(`Every video that reaches ${viewsLabel(i.threshold)} views earns an extra ${m(i.bonusAmount)} bonus on top.`);
  const best = i.best ? { label: `Your best video this cycle hit ${viewsLabel(i.best.views)} views — make more like it.`, url: i.best.url } : null;
  return { headline, points, missed: f.missed, available: f.available, best };
}

/** Plain-text message a reviewer can paste into Slack/WhatsApp/email. */
export function nudgeMessage(i: NudgeInput & { firstName: string; link: string }): string | null {
  const n = creatorNudge(i);
  if (!n) return null;
  return [
    `Hi ${i.firstName}! Quick check-in on your Artie posting 👋`,
    "",
    ...n.points.map((x) => `• ${x}`),
    ...(n.best ? [`• ${n.best.label}`] : []),
    "",
    `See your progress any time: ${i.link}`,
  ].join("\n");
}
