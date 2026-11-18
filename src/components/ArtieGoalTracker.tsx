"use client";

import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Goal, Measure } from "@/lib/artie/goal";

const num = (n: number) => n.toLocaleString("en-US");
const tone = (s: Measure["status"]) => (s === "ahead" ? "emerald" : s === "on_track" ? "amber" : "rose");

export default function ArtieGoalTracker({ goal, currency, isCurrent, costPerCreator, bonusEnabled = true, onRoster, postingNow }: { goal: Goal; currency: string; isCurrent: boolean; costPerCreator?: number | null; bonusEnabled?: boolean; onRoster?: number; postingNow?: number }) {
  const g = goal;
  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  const rows: { label: string; m: Measure; f: (n: number) => string }[] = [
    { label: "Videos", m: g.videos, f: num },
    ...(g.spend ? [{ label: bonusEnabled ? "Spend (incl. bonuses)" : "Creator spend", m: g.spend, f: money }] : []),
  ];
  const v = g.videos;
  const t = tone(v.status);
  const pct = Math.min(100, v.fullTarget > 0 ? (v.actual / v.fullTarget) * 100 : 0);
  const marker = Math.min(100, v.fullTarget > 0 ? (v.expected / v.fullTarget) * 100 : 0);
  return (
    <section className="mb-4 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Target className="w-5 h-5" /></div>
          <div>
            <p className="font-bold text-slate-900 leading-tight">Programme goal</p>
            <p className="text-xs text-slate-500">Target {g.creators} creators × {g.perDay} a day = {num(g.perDayTotal)} videos a day{onRoster != null ? ` · ${onRoster} on the roster${postingNow != null ? `, ${postingNow} posting` : ""}` : ""} · {isCurrent ? `day ${g.daysElapsed} of ${g.daysTotal}` : "closed cycle"}</p>
          </div>
        </div>
        <span className={cn("badge", t === "emerald" ? "bg-emerald-50 text-emerald-700" : t === "amber" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700")}>
          {v.gap >= 0 ? `${num(v.gap)} videos ahead` : `${num(-v.gap)} videos behind`}
        </span>
      </div>

      <div className="relative mt-4 h-3 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Videos posted against the cycle target">
        <div className={cn("h-full rounded-full", t === "emerald" ? "bg-emerald-500" : t === "amber" ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${pct}%` }} />
        <div className="absolute top-0 bottom-0 w-0.5 bg-slate-700" style={{ left: `${marker}%` }} title="Where the team should be today" />
      </div>
      <p className="mt-2 text-sm text-slate-700">{isCurrent ? "At this pace the cycle finishes on" : "The cycle finished on"} <strong className={v.projected >= v.fullTarget ? "text-emerald-700" : "text-rose-700"}>{num(v.projected)} videos</strong> of {num(v.fullTarget)}{g.spend && g.spend.fullTarget > 0 ? <> and <strong className={g.spend.projected >= g.spend.fullTarget ? "text-emerald-700" : "text-rose-700"}>{money(g.spend.projected)}</strong> spend of {money(g.spend.fullTarget)}</> : null}.</p>
      <p className="mt-1 text-xs text-slate-500">The line marks today’s goal and moves up {num(g.perDayTotal)} videos a day.{isCurrent && v.remaining > 0 ? ` To hit the cycle target the team now needs ${g.neededPerDay} a day.` : ""}</p>

      <div className="mt-3 overflow-x-auto -mx-1">
        <table className="w-full text-xs min-w-[520px]">
          <thead><tr className="text-left text-slate-400"><th className="font-medium px-1 py-1.5"> </th><th className="font-medium px-1 text-right">Expected by now</th><th className="font-medium px-1 text-right">Actual</th><th className="font-medium px-1 text-right">Still needed</th><th className="font-medium px-1 text-right">Pro rata by end of cycle</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ label, m, f }) => (
              <tr key={label}>
                <td className="px-1 py-2 font-semibold text-slate-700">{label}</td>
                <td className="px-1 text-right text-slate-500">{f(m.expected)}</td>
                <td className="px-1 text-right font-semibold text-slate-800">{f(m.actual)}</td>
                <td className="px-1 text-right text-slate-500">{f(m.remaining)}</td>
                <td className={cn("px-1 text-right font-semibold", m.projected >= m.fullTarget ? "text-emerald-700" : "text-rose-700")}>{f(m.projected)} <span className="font-normal text-slate-400">of {f(m.fullTarget)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Per creator per month: {g.perDay * 30} videos{costPerCreator ? <> and {money(costPerCreator)} creator budget{bonusEnabled ? " including bonuses" : ""}</> : null}. The roster is bigger than the target on purpose, to cover people who drop out or haven’t started posting. Pro rata = today’s daily rate carried to the end of the cycle.{costPerCreator ? " Spend is shown in the dashboard currency without conversion." : ""}</p>
    </section>
  );
}
