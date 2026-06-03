"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarClient, COLOR_MAP } from "./types";

interface CalendarGridViewProps {
  clients: CalendarClient[];
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isClientActiveOnDay(client: CalendarClient, date: Date): boolean {
  const start = new Date(client.contractStart);
  start.setHours(0, 0, 0, 0);
  const end = client.contractEnd ? new Date(client.contractEnd) : null;
  if (end) end.setHours(23, 59, 59, 999);
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d >= start && (!end || d <= end);
}

export default function CalendarGridView({ clients }: CalendarGridViewProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tooltip, setTooltip] = useState<{ day: number; names: string[] } | null>(null);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const days = useMemo(() => {
    const result: Array<{ day: number; date: Date; clients: CalendarClient[] }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const activeClients = clients.filter((c) => isClientActiveOnDay(c, date));
      result.push({ day: d, date, clients: activeClients });
    }
    return result;
  }, [year, month, daysInMonth, clients]);

  // Weeks for capacity
  const weeks = useMemo(() => {
    const result: number[] = [];
    let weekStart = 1;
    while (weekStart <= daysInMonth) {
      const weekEnd = Math.min(weekStart + 6 - ((firstDay + weekStart - 1) % 7), daysInMonth);
      // Count unique active clients for the week
      const weekClients = new Set<string>();
      for (let d = weekStart; d <= weekEnd; d++) {
        const date = new Date(year, month, d);
        clients.forEach((c) => {
          if (isClientActiveOnDay(c, date)) weekClients.add(c.id);
        });
      }
      result.push(weekClients.size);
      weekStart += 7;
    }
    return result;
  }, [year, month, daysInMonth, firstDay, clients]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const monthName = new Date(year, month, 1).toLocaleString("default", { month: "long", year: "numeric" });
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Build grid cells (blanks + days)
  const gridCells: Array<{ empty: true } | { day: number; date: Date; clients: CalendarClient[] }> = [];
  for (let i = 0; i < firstDay; i++) gridCells.push({ empty: true });
  gridCells.push(...days);

  // Group cells into rows of 7
  const rows: typeof gridCells[] = [];
  for (let i = 0; i < gridCells.length; i += 7) {
    rows.push(gridCells.slice(i, i + 7));
  }

  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">{monthName}</h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }}
            className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Today
          </button>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[32px_repeat(7,1fr)] gap-px mb-1">
        <div />
        {dayNames.map((d) => (
          <div key={d} className="text-center text-xs text-slate-500 uppercase tracking-wide py-1">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 flex flex-col gap-px">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-[32px_repeat(7,1fr)] gap-px flex-1">
            {/* Week capacity */}
            <div className="flex items-center justify-center">
              <span className="text-xs font-mono text-slate-500">{weeks[rowIdx] || 0}</span>
            </div>
            {/* Days */}
            {Array.from({ length: 7 }).map((_, colIdx) => {
              const cell = row[colIdx];
              if (!cell || "empty" in cell) {
                return <div key={colIdx} className="bg-white/[0.02] rounded-lg" />;
              }
              const { day, clients: dayClients } = cell;
              return (
                <div
                  key={colIdx}
                  className="bg-[#0f1629] border border-white/5 rounded-lg p-1.5 min-h-[70px] relative hover:bg-white/5 transition-colors cursor-default"
                  onMouseEnter={() => dayClients.length > 0 && setTooltip({ day, names: dayClients.map(c => c.name) })}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <div className={cn(
                    "text-xs font-mono w-5 h-5 flex items-center justify-center rounded-full mb-1",
                    isToday(day) ? "bg-emerald-500 text-white font-semibold" : "text-slate-400"
                  )}>
                    {day}
                  </div>
                  <div className="flex flex-wrap gap-0.5">
                    {dayClients.slice(0, 4).map((c) => (
                      <div
                        key={c.id}
                        className={cn("w-2 h-2 rounded-full", COLOR_MAP[c.color]?.dot || "bg-violet-500")}
                        title={c.name}
                      />
                    ))}
                    {dayClients.length > 4 && (
                      <span className="text-xs text-slate-500">+{dayClients.length - 4}</span>
                    )}
                  </div>

                  {/* Tooltip */}
                  {tooltip?.day === day && tooltip.names.length > 0 && (
                    <div className="absolute z-50 bottom-full left-0 mb-1 bg-[#1a2540] border border-white/20 rounded-lg px-3 py-2 shadow-xl min-w-[140px] pointer-events-none">
                      <div className="text-xs text-slate-300 font-semibold mb-1">Active clients</div>
                      {tooltip.names.map((n, i) => (
                        <div key={i} className="text-xs text-white">{n}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
