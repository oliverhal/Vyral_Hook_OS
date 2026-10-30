"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import UserAvatar from "./UserAvatar";

interface WeekData {
  submitterName: string;
  weekStart: string;
  count: number;
  selected: number;
}

interface MemberDetail {
  name: string;
  color: string;
  avatarUrl: string | null;
}

interface MonthlyLeaderboardProps {
  data: WeekData[];
  memberDetails: MemberDetail[];
}

const RANK_STYLES = [
  { bg: "bg-amber-50 border-amber-200",   badge: "bg-amber-400 text-white",   label: "text-amber-600", icon: "🥇" },
  { bg: "bg-slate-50 border-slate-200",   badge: "bg-slate-400 text-white",   label: "text-slate-500", icon: "🥈" },
  { bg: "bg-orange-50 border-orange-200", badge: "bg-orange-400 text-white",  label: "text-orange-600", icon: "🥉" },
];

export default function MonthlyLeaderboard({ data, memberDetails }: MonthlyLeaderboardProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const monthLabel = new Date(year, month, 1).toLocaleString("default", { month: "long", year: "numeric" });
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  // Filter data to the selected month
  const monthData = useMemo(() => {
    return data.filter(d => {
      const ws = new Date(d.weekStart);
      // Include weeks that overlap with this month
      const weekEnd = new Date(ws);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return (ws.getFullYear() === year && ws.getMonth() === month) ||
             (weekEnd.getFullYear() === year && weekEnd.getMonth() === month);
    });
  }, [data, year, month]);

  // Aggregate by person
  const scores = useMemo(() => {
    const agg = new Map<string, { submitted: number; selected: number }>();
    for (const d of monthData) {
      const existing = agg.get(d.submitterName) ?? { submitted: 0, selected: 0 };
      agg.set(d.submitterName, {
        submitted: existing.submitted + d.count,
        selected: existing.selected + d.selected,
      });
    }

    return Array.from(agg.entries())
      .map(([name, stats]) => {
        const member = memberDetails.find(m => m.name === name);
        // Score: finalized hooks worth 3x, submitted hooks worth 1x
        const score = (stats.selected * 3) + stats.submitted;
        return { name, ...stats, score, color: member?.color ?? "slate", avatarUrl: member?.avatarUrl ?? null };
      })
      .sort((a, b) => b.score - a.score || b.selected - a.selected || b.submitted - a.submitted);
  }, [monthData, memberDetails]);

  const hasData = scores.length > 0;

  return (
    <div className="bg-[#0d1117] rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <Trophy className="w-4 h-4 text-amber-400" />
          <div>
            <h2 className="text-white font-bold text-base">Monthly Leaderboard</h2>
            <p className="text-white/40 text-xs mt-0.5">Score: finalized hook = 3pts · submitted = 1pt</p>
          </div>
        </div>
        {/* Month nav */}
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono text-white/60 w-28 text-center">{monthLabel}</span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-8 text-white/20 text-sm">No submissions this month</div>
      ) : (
        <div className="space-y-2">
          {scores.map((person, i) => {
            const style = RANK_STYLES[i] ?? null;
            const selectionRate = person.submitted > 0
              ? Math.round((person.selected / person.submitted) * 100)
              : 0;

            return (
              <div
                key={person.name}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors",
                  i < 3 ? cn(style!.bg, "border") : "bg-white/[0.03] border-white/5"
                )}
              >
                {/* Rank */}
                <div className="w-6 text-center flex-shrink-0">
                  {i < 3 ? (
                    <span className="text-base leading-none">{style!.icon}</span>
                  ) : (
                    <span className="text-xs font-mono text-white/30">#{i + 1}</span>
                  )}
                </div>

                {/* Avatar */}
                <UserAvatar name={person.name} color={person.color} avatarUrl={person.avatarUrl} size="sm" className="ring-0" />

                {/* Name */}
                <span className={cn("text-sm font-semibold flex-1 truncate", i < 3 ? "text-slate-800" : "text-white/80")}>
                  {person.name}
                </span>

                {/* Stats */}
                <div className="flex items-center gap-3 text-right flex-shrink-0">
                  <div className="text-center">
                    <div className={cn("text-xs font-mono font-bold", i < 3 ? "text-slate-700" : "text-white/60")}>{person.submitted}</div>
                    <div className={cn("text-[10px]", i < 3 ? "text-slate-400" : "text-white/30")}>submitted</div>
                  </div>
                  <div className="text-center">
                    <div className={cn("text-xs font-mono font-bold", i < 3 ? "text-emerald-600" : "text-emerald-400")}>{person.selected}</div>
                    <div className={cn("text-[10px]", i < 3 ? "text-slate-400" : "text-white/30")}>finalized</div>
                  </div>
                  <div className="text-center min-w-[40px]">
                    <div className={cn("text-xs font-mono font-bold", i < 3 ? "text-slate-400" : "text-white/30")}>{selectionRate}%</div>
                    <div className={cn("text-[10px]", i < 3 ? "text-slate-400" : "text-white/30")}>rate</div>
                  </div>
                  {/* Score pill */}
                  <div className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold font-mono min-w-[44px] text-center",
                    i === 0 ? "bg-amber-400 text-white" :
                    i === 1 ? "bg-slate-400 text-white" :
                    i === 2 ? "bg-orange-400 text-white" :
                    "bg-white/10 text-white/60"
                  )}>
                    {person.score}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasData && (
        <p className="text-[11px] text-white/20 mt-3 text-right font-mono">
          Score = (finalized × 3) + submitted
        </p>
      )}
    </div>
  );
}
