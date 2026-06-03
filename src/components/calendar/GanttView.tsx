"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CalendarClient,
  COLOR_BAR,
  STATUS_BAR_OVERRIDE,
  getContractStatus,
  STATUS_STYLES,
} from "./types";

interface GanttViewProps {
  clients: CalendarClient[];
  onEditClient: (client: CalendarClient) => void;
}

const MONTHS_VISIBLE = 12;
const LEFT_COL_WIDTH = 200;
const MONTH_WIDTH = 120;

function getMonthsBetween(start: Date, count: number): Date[] {
  const months: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    months.push(d);
  }
  return months;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function dateToOffset(date: Date, viewStart: Date): number {
  const totalDays = (date.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24);
  return totalDays;
}

function monthStartOffset(month: Date, viewStart: Date): number {
  return dateToOffset(month, viewStart);
}

export default function GanttView({ clients, onEditClient }: GanttViewProps) {
  const today = useMemo(() => new Date(), []);

  // Start view 2 months before today
  const [viewOffset, setViewOffset] = useState(0);

  const viewStart = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() - 2 + viewOffset, 1);
    return d;
  }, [today, viewOffset]);

  const months = useMemo(() => getMonthsBetween(viewStart, MONTHS_VISIBLE), [viewStart]);

  const totalDays = useMemo(() => {
    const lastMonth = months[months.length - 1];
    const endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 1);
    return (endDate.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24);
  }, [months, viewStart]);

  const totalWidth = totalDays * (MONTH_WIDTH / 30);

  const todayOffset = useMemo(() => {
    return dateToOffset(today, viewStart) * (MONTH_WIDTH / 30);
  }, [today, viewStart]);

  // Capacity per month (active clients count)
  const capacity = useMemo(() => {
    return months.map((month) => {
      const monthStart = month;
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      const count = clients.filter((c) => {
        const start = new Date(c.contractStart);
        const end = c.contractEnd ? new Date(c.contractEnd) : null;
        return start <= monthEnd && (!end || end >= monthStart);
      }).length;
      return count;
    });
  }, [clients, months]);

  const maxCapacity = Math.max(...capacity, 1);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Navigation */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
        <div className="text-sm text-slate-400">
          {months[0].toLocaleString("default", { month: "long", year: "numeric" })}
          {" — "}
          {months[months.length - 1].toLocaleString("default", { month: "long", year: "numeric" })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewOffset((o) => o - 3)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewOffset(0)}
            className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setViewOffset((o) => o + 3)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Gantt body */}
      <div className="flex-1 overflow-auto">
        <div className="flex">
          {/* Fixed left column */}
          <div className="flex-shrink-0 bg-[#080e1a] z-10" style={{ width: LEFT_COL_WIDTH }}>
            {/* Header spacer */}
            <div className="h-8 border-b border-white/10 border-r border-white/10" />
            {/* Capacity header */}
            <div className="h-16 border-b border-white/10 border-r border-white/10 px-3 flex items-center">
              <span className="text-xs text-slate-500 uppercase tracking-wide">Active clients</span>
            </div>
            {/* Client names */}
            {clients.map((client) => (
              <div
                key={client.id}
                className="h-12 border-b border-white/10 border-r border-white/10 px-3 flex items-center gap-2 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => onEditClient(client)}
              >
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", COLOR_BAR[client.color] || "bg-violet-500")} />
                <span className="text-sm text-white truncate font-medium">{client.name}</span>
              </div>
            ))}
          </div>

          {/* Scrollable right side */}
          <div className="flex-1 overflow-x-auto">
            <div style={{ width: totalWidth, minWidth: "100%" }}>
              {/* Month headers */}
              <div className="flex h-8 border-b border-white/10 relative">
                {months.map((month, i) => {
                  const days = getDaysInMonth(month.getFullYear(), month.getMonth());
                  const w = days * (MONTH_WIDTH / 30);
                  return (
                    <div
                      key={i}
                      className="flex-shrink-0 border-r border-white/10 flex items-center px-3"
                      style={{ width: w }}
                    >
                      <span className="text-xs font-mono text-slate-400">
                        {month.toLocaleString("default", { month: "short" })} {month.getFullYear()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Capacity bars */}
              <div className="flex h-16 border-b border-white/10 relative items-end pb-1 px-1 gap-px">
                {months.map((month, i) => {
                  const days = getDaysInMonth(month.getFullYear(), month.getMonth());
                  const w = days * (MONTH_WIDTH / 30);
                  const pct = (capacity[i] / maxCapacity) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-shrink-0 flex flex-col items-center justify-end"
                      style={{ width: w - 2 }}
                    >
                      <span className="text-xs font-mono text-slate-400 mb-0.5">{capacity[i]}</span>
                      <div
                        className="w-full bg-emerald-500/30 rounded-sm"
                        style={{ height: `${Math.max(pct * 0.35, 4)}px` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Client rows */}
              <div className="relative">
                {/* Today line */}
                {todayOffset >= 0 && todayOffset <= totalWidth && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-emerald-400/60 z-20 pointer-events-none"
                    style={{ left: todayOffset }}
                  />
                )}

                {/* Month grid lines */}
                {months.map((month, i) => {
                  const offset = monthStartOffset(month, viewStart) * (MONTH_WIDTH / 30);
                  return (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 w-px bg-white/5 pointer-events-none"
                      style={{ left: offset }}
                    />
                  );
                })}

                {clients.map((client) => {
                  const status = getContractStatus(client);
                  const start = new Date(client.contractStart);
                  const end = client.contractEnd
                    ? new Date(client.contractEnd)
                    : new Date(viewStart.getFullYear(), viewStart.getMonth() + MONTHS_VISIBLE, 1);
                  const isOngoing = !client.contractEnd;

                  const startPx = Math.max(dateToOffset(start, viewStart) * (MONTH_WIDTH / 30), 0);
                  const endPx = Math.min(dateToOffset(end, viewStart) * (MONTH_WIDTH / 30), totalWidth);
                  const width = Math.max(endPx - startPx, 8);

                  const barColor =
                    STATUS_BAR_OVERRIDE[status] || COLOR_BAR[client.color] || "bg-violet-500";

                  return (
                    <div
                      key={client.id}
                      className="h-12 border-b border-white/10 flex items-center relative"
                    >
                      <div
                        className={cn(
                          "absolute h-6 rounded flex items-center px-2 cursor-pointer hover:brightness-110 transition-all",
                          barColor,
                          isOngoing ? "rounded-r-none" : ""
                        )}
                        style={{ left: startPx, width }}
                        onClick={() => onEditClient(client)}
                        title={client.name}
                      >
                        <span className="text-xs font-medium text-white truncate whitespace-nowrap">
                          {client.name}
                        </span>
                        {isOngoing && (
                          <div
                            className="absolute right-0 top-0 bottom-0 w-4 flex items-center justify-center"
                            style={{
                              background: "repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 6px)",
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-t border-white/10 flex items-center gap-6">
        {(Object.entries(STATUS_STYLES) as [string, { pill: string }][]).map(([status, styles]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", styles.pill)}>
              {status.replace("_", " ")}
            </span>
          </div>
        ))}
        <div className="ml-auto text-xs text-slate-500 font-mono">
          Today: {today.toISOString().split("T")[0]}
        </div>
      </div>
    </div>
  );
}
