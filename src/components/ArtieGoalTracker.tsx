"use client";

import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { goalFor } from "@/lib/artie/goal";

const money = (n: number, cur: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
const num = (n: number) => n.toLocaleString("en-US");

export default function ArtieGoalTracker({ goal, currency, isCurrent }: { goal: ReturnType<typeof goalFor>; currency: string; isCurrent: boolean }) {
  const g = goal;
  const pct = Math.min(100, g.fullTarget > 0 ? (g.actual / g.fullTarget) * 100 : 0);
  const marker = Math.min(100, g.fullTarget > 0 ? (g.expected / g.fullTarget) * 100 : 0);
  const tone = g.status === "ahead" ? "emerald" : g.status === "on_track" ? "amber" : "rose";
  return (
    <section className="mb-4 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Target className="w-4.5 h-4.5" /></div>
          <div>
            <p className="font-bold text-slate-900 leading-tight">Video goal</p>
            <p className="text-xs text-slate-500">{g.creators} creators × {g.perDay} a day = {num(g.perDayTotal)} videos a day · {isCurrent ? `day ${g.daysElapsed} of ${g.daysTotal}` : "closed cycle"}</p>
          </div>
        </div>
        <span className={cn("badge", tone === "emerald" ? "bg-emerald-50 text-emerald-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700")}>
          {g.gap >= 0 ? `${num(g.gap)} ahead` : `${num(-g.gap)} behind`}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div><p className="text-2xl font-black text-slate-900">{num(g.actual)}</p><p className="text-[11px] text-slate-500">posted (unique)</p></div>
        <div><p className="text-2xl font-black text-slate-400">{num(g.expected)}</p><p className="text-[11px] text-slate-500">should be by now</p></div>
        <div><p className="text-2xl font-black text-slate-400">{num(g.fullTarget)}</p><p className="text-[11px] text-slate-500">cycle target</p></div>
      </div>

      <div className="relative mt-3 h-3 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Videos posted against cycle target">
        <div className={cn("h-full rounded-full", tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${pct}%` }} />
        <div className="absolute top-0 bottom-0 w-0.5 bg-slate-700" style={{ left: `${marker}%` }} title="Where the team should be today" />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {g.pctOfExpected}% of where we should be{isCurrent && g.projected > 0 ? <> · at today’s rate the cycle finishes on <strong className="text-slate-700">{num(g.projected)}</strong> videos</> : null}.
        {" "}The line marks today’s goal; it moves up {num(g.perDayTotal)} each day.
      </p>

      <div className="mt-4 grid sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="font-semibold text-slate-700 mb-1.5">Videos — expected vs actual</p>
          <dl className="space-y-1 text-slate-500">
            <div className="flex justify-between"><dt>Expected by now</dt><dd className="font-semibold text-slate-700">{num(g.expected)}</dd></div>
            <div className="flex justify-between"><dt>Actual</dt><dd className="font-semibold text-slate-700">{num(g.actual)}</dd></div>
            <div className="flex justify-between"><dt>Still needed for the cycle</dt><dd className="font-semibold text-slate-700">{num(g.remaining)}{isCurrent && g.remaining > 0 ? ` (${g.neededPerDay}/day)` : ""}</dd></div>
            <div className="flex justify-between"><dt>Pro rata by end of cycle</dt><dd className={cn("font-semibold", g.projected >= g.fullTarget ? "text-emerald-700" : "text-rose-700")}>{num(g.projected)} of {num(g.fullTarget)}</dd></div>
          </dl>
        </div>
        {g.spend ? (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="font-semibold text-slate-700 mb-1.5">Spend — at {money(g.spend.avgRate, currency)} avg per video</p>
            <dl className="space-y-1 text-slate-500">
              <div className="flex justify-between"><dt>Expected by now</dt><dd className="font-semibold text-slate-700">{money(g.spend.expected, currency)}</dd></div>
              <div className="flex justify-between"><dt>Actual</dt><dd className="font-semibold text-slate-700">{money(g.spend.actual, currency)}</dd></div>
              <div className="flex justify-between"><dt>Still needed to hit the target</dt><dd className="font-semibold text-slate-700">{money(g.spend.stillNeeded, currency)}</dd></div>
              <div className="flex justify-between"><dt>Pro rata by end of cycle</dt><dd className="font-semibold text-slate-700">{money(g.spend.projected, currency)} of {money(g.spend.fullTarget, currency)}</dd></div>
            </dl>
          </div>
        ) : <div className="rounded-xl bg-slate-50 p-3 text-slate-400">Spend goal appears once creators have a rate on the sheet.</div>}
      </div>
    </section>
  );
}
