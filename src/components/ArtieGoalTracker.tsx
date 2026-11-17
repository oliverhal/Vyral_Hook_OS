"use client";

import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Goal, Measure } from "@/lib/artie/goal";

const num = (n: number) => n.toLocaleString("en-US");
const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}K` : num(n));
const tone = (s: Measure["status"]) => (s === "ahead" ? "emerald" : s === "on_track" ? "amber" : "rose");

export default function ArtieGoalTracker({ goal, currency, isCurrent }: { goal: Goal; currency: string; isCurrent: boolean }) {
  const g = goal;
  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  const rows: { label: string; m: Measure; f: (n: number) => string }[] = [
    { label: "Videos", m: g.videos, f: num },
    { label: "Spend (incl. bonuses)", m: g.spend, f: money },
    { label: "Views", m: g.views, f: compact },
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
            <p className="text-xs text-slate-500">{g.creators} creators × {g.perDay} a day = {num(g.perDayTotal)} videos a day · {isCurrent ? `day ${g.daysElapsed} of ${g.daysTotal}` : "closed cycle"} · from the Art Master calculator</p>
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
      <p className="mt-1.5 text-xs text-slate-500">The line marks today’s goal and moves up {num(g.perDayTotal)} videos a day.{isCurrent && v.remaining > 0 ? ` To hit the cycle target the team now needs ${g.neededPerDay} a day.` : ""}</p>

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
      <p className="mt-2 text-[11px] text-slate-400">Targets per creator per month: 60 videos, {money(600)} creator cost including bonuses, 250K views. Pro rata = today’s daily rate carried to the end of the cycle. Spend is shown in the dashboard currency without conversion.</p>
    </section>
  );
}
