// "You're in the top 10% of creators this cycle" — shown to a creator on their own link.
//
// The rule (kept deliberately simple and explainable):
//  • Metric: views of the videos they published this cycle, per day since they started (the later of the
//    cycle start and their start date), so someone who joined mid-cycle isn't ranked against full-cycle
//    totals.
//  • Only creators with at least MIN_DAYS of activity are ranked, and only if at least MIN_POOL creators
//    qualify — a percentile of five people means nothing, and the first days of a cycle are noise.
//  • Ties share the better rank.
//  • Only POSITIVE tiers are ever shown (top 10% / 25% / half). Nothing is shown below the middle,
//    and a creator never sees anyone else's numbers or name.

export type RankTier = 10 | 25 | 50;

export const MIN_RANK_DAYS = 7;
export const MIN_RANK_POOL = 10;

export interface RankInput { id: string; totalViews: number; activeDays: number }

export function viewsPerDay(totalViews: number, activeDays: number): number {
  return totalViews / Math.max(MIN_RANK_DAYS, activeDays);
}

/** The best tier `id` reaches, or null (not ranked, pool too small, or below the middle). */
export function rankTier(all: RankInput[], id: string): RankTier | null {
  const ranked = all.filter((c) => c.activeDays >= MIN_RANK_DAYS).map((c) => ({ id: c.id, v: viewsPerDay(c.totalViews, c.activeDays) }));
  if (ranked.length < MIN_RANK_POOL) return null;
  const me = ranked.find((c) => c.id === id);
  if (!me) return null;
  const rank = 1 + ranked.filter((c) => c.v > me.v).length; // ties share the better rank
  const share = rank / ranked.length;
  return share <= 0.1 ? 10 : share <= 0.25 ? 25 : share <= 0.5 ? 50 : null;
}
