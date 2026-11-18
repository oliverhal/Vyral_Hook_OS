import { goalFor } from "./goal";

// Programme-level numbers for sharing outside Hook OS (the client-facing Video Views Tracker). Built ONLY
// from aggregate fields, so nothing per-creator — names, handles, rates, links — can end up in the output.

type D = Date | string;

export interface OverviewLike {
  programme: { id: string; label: string };
  bonusEnabled: boolean;
  goalMembers: { start: string | null }[];
  monthlyCostPerCreator: number | null;
  bonusSummary: { givenCount: number; givenAmount: number; pendingCount: number; pendingAmount: number };
  cycle: { key: string; start: D; end: D; startLabel: string; endLabel: string };
  creators: { counted: number; estTotal: number | null; perPlatform: Record<string, number>; pace: { status: string } }[];
  settings: { currency: string; videosPerDay: number; lastVideoSyncAt: D | null };
}

export interface ProgrammeSummary {
  programme: { id: string; label: string };
  generatedAt: string;
  lastSyncedAt: string | null;
  cycle: { key: string; startLabel: string; endLabel: string; daysElapsed: number; daysTotal: number };
  creators: { onRoster: number; postingNow: number; behindPace: number; onTrackOrAhead: number; notStarted: number };
  videos: {
    unique: number; expectedByNow: number; gap: number; cycleTarget: number; projectedByCycleEnd: number; neededPerDay: number;
    perPlatform: { instagram: number; tiktok: number; facebook: number };
  };
  goal: { creatorsCounted: number; perDay: number; perDayTotal: number };
  spend: { currency: string; actual: number; budgetToDate: number; cycleBudget: number; projectedByCycleEnd: number } | null;
  bonuses: { enabled: false } | { enabled: true; givenCount: number; givenAmount: number; pendingCount: number; pendingAmount: number };
}

const iso = (d: D | null) => (d ? new Date(d).toISOString() : null);

export function summariseProgramme(o: OverviewLike, now = new Date()): ProgrammeSummary {
  const sum = (f: (c: OverviewLike["creators"][number]) => number) => o.creators.reduce((n, c) => n + f(c), 0);
  const unique = sum((c) => c.counted);
  // Same definition as the dashboard's "spent" card: unique videos × rate, plus bonuses where they exist.
  const spent = sum((c) => c.estTotal ?? 0);

  const goal = goalFor({
    cycle: { key: o.cycle.key, start: new Date(o.cycle.start), end: new Date(o.cycle.end), startLabel: o.cycle.startLabel, endLabel: o.cycle.endLabel },
    now, actualVideos: unique, actualSpend: spent, perDay: o.settings.videosPerDay, costPerCreator: o.monthlyCostPerCreator,
    members: o.goalMembers.map((m) => ({ start: m.start ? new Date(m.start) : null })),
  });

  const status = (s: string) => o.creators.filter((c) => c.pace.status === s).length;
  return {
    programme: { id: o.programme.id, label: o.programme.label },
    generatedAt: now.toISOString(),
    lastSyncedAt: iso(o.settings.lastVideoSyncAt),
    cycle: { key: o.cycle.key, startLabel: o.cycle.startLabel, endLabel: o.cycle.endLabel, daysElapsed: goal.daysElapsed, daysTotal: goal.daysTotal },
    creators: {
      onRoster: o.creators.length,
      postingNow: o.creators.filter((c) => c.counted > 0).length,
      behindPace: status("behind"),
      onTrackOrAhead: status("on_track") + status("ahead"),
      notStarted: status("not_started"),
    },
    videos: {
      unique, expectedByNow: goal.videos.expected, gap: goal.videos.gap, cycleTarget: goal.videos.fullTarget,
      projectedByCycleEnd: goal.videos.projected, neededPerDay: goal.neededPerDay,
      perPlatform: { instagram: sum((c) => c.perPlatform.instagram ?? 0), tiktok: sum((c) => c.perPlatform.tiktok ?? 0), facebook: sum((c) => c.perPlatform.facebook ?? 0) },
    },
    goal: { creatorsCounted: goal.creators, perDay: goal.perDay, perDayTotal: goal.perDayTotal },
    spend: goal.spend ? { currency: o.settings.currency, actual: goal.spend.actual, budgetToDate: goal.spend.expected, cycleBudget: goal.spend.fullTarget, projectedByCycleEnd: goal.spend.projected } : null,
    bonuses: o.bonusEnabled
      ? { enabled: true, givenCount: o.bonusSummary.givenCount, givenAmount: o.bonusSummary.givenAmount, pendingCount: o.bonusSummary.pendingCount, pendingAmount: o.bonusSummary.pendingAmount }
      : { enabled: false },
  };
}
