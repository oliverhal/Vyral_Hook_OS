"use client";

import { format, eachWeekOfInterval, subWeeks, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";

interface WeekData {
  weekStart: string;
  submitterName: string;
  count: number;
  selected: number;
}

interface ContributionBoardProps {
  data: WeekData[];
  members: string[];
  weeks?: number;
}

function getIntensity(count: number): string {
  if (count === 0) return "bg-white/5 border border-white/10";
  if (count <= 1) return "bg-blue-900/60 border border-blue-800/40";
  if (count <= 3) return "bg-blue-700/70 border border-blue-600/40";
  if (count <= 5) return "bg-blue-500/80 border border-blue-400/40";
  return "bg-blue-400 border border-blue-300/40";
}

function getTooltip(member: string, weekStart: string, count: number, selected: number): string {
  const date = format(new Date(weekStart), "d MMM yyyy");
  if (count === 0) return `${member} — ${date}: No hooks`;
  return `${member} — ${date}: ${count} hook${count !== 1 ? "s" : ""} (${selected} selected)`;
}

export default function ContributionBoard({ data, members, weeks = 20 }: ContributionBoardProps) {
  const now = new Date();
  const startDate = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), weeks - 1);

  const weekStarts = eachWeekOfInterval(
    { start: startDate, end: now },
    { weekStartsOn: 1 }
  ).map((d) => d.toISOString().split("T")[0]);

  function getCellData(member: string, weekStart: string): WeekData {
    return (
      data.find(
        (d) =>
          d.submitterName === member &&
          d.weekStart.split("T")[0] === weekStart
      ) ?? { weekStart, submitterName: member, count: 0, selected: 0 }
    );
  }

  const monthLabels: { label: string; colIndex: number }[] = [];
  weekStarts.forEach((ws, i) => {
    const d = new Date(ws);
    if (i === 0 || d.getDate() <= 7) {
      const label = format(d, "MMM");
      if (!monthLabels.length || monthLabels[monthLabels.length - 1].label !== label) {
        monthLabels.push({ label, colIndex: i });
      }
    }
  });

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="min-w-max">
        {/* Month labels */}
        <div className="flex mb-1.5 ml-28">
          {weekStarts.map((ws, i) => {
            const entry = monthLabels.find((m) => m.colIndex === i);
            return (
              <div key={ws} className="w-7 flex-shrink-0 text-center">
                {entry && (
                  <span className="text-xs text-white/30 font-medium">{entry.label}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Grid rows */}
        {members.map((member) => (
          <div key={member} className="flex items-center gap-1 mb-1.5">
            {/* Member name */}
            <div className="w-24 flex-shrink-0 text-right pr-3">
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-white/60 font-medium truncate">{member}</span>
                <div className="w-5 h-5 rounded-full bg-blue-600/30 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-blue-300">{member.charAt(0)}</span>
                </div>
              </div>
            </div>

            {/* Week cells */}
            {weekStarts.map((ws) => {
              const cell = getCellData(member, ws);
              return (
                <div
                  key={ws}
                  className={cn(
                    "w-6 h-6 rounded flex-shrink-0 cursor-default transition-all duration-100 hover:scale-110",
                    getIntensity(cell.count)
                  )}
                  title={getTooltip(member, ws, cell.count, cell.selected)}
                />
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center justify-end gap-2 mt-3 ml-28">
          <span className="text-xs text-white/30">Less</span>
          {[0, 1, 3, 5, 7].map((v) => (
            <div
              key={v}
              className={cn("w-4 h-4 rounded-sm", getIntensity(v))}
            />
          ))}
          <span className="text-xs text-white/30">More</span>
        </div>
      </div>
    </div>
  );
}
