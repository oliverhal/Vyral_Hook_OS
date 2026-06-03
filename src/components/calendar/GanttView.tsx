"use client";

import { useState, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarClient, COLOR_BAR, STATUS_BAR_OVERRIDE, getContractStatus, STATUS_STYLES } from "./types";

interface GanttViewProps {
  clients: CalendarClient[];
  onEditClient: (client: CalendarClient) => void;
}

type Scale = "days" | "weeks" | "months" | "quarters";

const SCALE_CONFIG: Record<Scale, {
  label: string;
  pxPerDay: number;
  visibleDays: number;
  navStepDays: number;
  colLabel: (d: Date) => string;
  colWidth: (d: Date) => number; // in days
  getCols: (start: Date, days: number) => Date[];
}> = {
  days: {
    label: "Days",
    pxPerDay: 36,
    visibleDays: 28,
    navStepDays: 7,
    colLabel: (d) => d.toLocaleString("default", { weekday: "short", day: "numeric" }),
    colWidth: () => 1,
    getCols: (start, days) => Array.from({ length: days }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i); return d;
    }),
  },
  weeks: {
    label: "Weeks",
    pxPerDay: 14,
    visibleDays: 84,
    navStepDays: 28,
    colLabel: (d) => {
      const end = new Date(d); end.setDate(end.getDate() + 6);
      return `${d.toLocaleString("default", { month: "short", day: "numeric" })} – ${end.toLocaleString("default", { day: "numeric" })}`;
    },
    colWidth: () => 7,
    getCols: (start, days) => {
      const cols: Date[] = [];
      const d = new Date(start);
      while ((d.getTime() - start.getTime()) / 86400000 < days) {
        cols.push(new Date(d));
        d.setDate(d.getDate() + 7);
      }
      return cols;
    },
  },
  months: {
    label: "Months",
    pxPerDay: 4,
    visibleDays: 365,
    navStepDays: 91,
    colLabel: (d) => d.toLocaleString("default", { month: "short", year: "numeric" }),
    colWidth: (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
    getCols: (start, days) => {
      const cols: Date[] = [];
      const d = new Date(start.getFullYear(), start.getMonth(), 1);
      while ((d.getTime() - start.getTime()) / 86400000 < days) {
        cols.push(new Date(d));
        d.setMonth(d.getMonth() + 1);
      }
      return cols;
    },
  },
  quarters: {
    label: "Quarters",
    pxPerDay: 1.6,
    visibleDays: 730,
    navStepDays: 91,
    colLabel: (d) => `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`,
    colWidth: (d) => {
      const qStart = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
      const qEnd = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 1);
      return (qEnd.getTime() - qStart.getTime()) / 86400000;
    },
    getCols: (start, days) => {
      const cols: Date[] = [];
      const q = Math.floor(start.getMonth() / 3);
      const d = new Date(start.getFullYear(), q * 3, 1);
      while ((d.getTime() - start.getTime()) / 86400000 < days) {
        cols.push(new Date(d));
        d.setMonth(d.getMonth() + 3);
      }
      return cols;
    },
  },
};

const LEFT_COL_WIDTH = 200;

function daysBetween(a: Date, b: Date) {
  return (b.getTime() - a.getTime()) / 86400000;
}

export default function GanttView({ clients, onEditClient }: GanttViewProps) {
  const today = useMemo(() => new Date(), []);
  const [scale, setScale] = useState<Scale>("months");
  const [viewOffset, setViewOffset] = useState(0); // in days from default start

  const cfg = SCALE_CONFIG[scale];

  const viewStart = useMemo(() => {
    let base: Date;
    if (scale === "days") {
      base = new Date(today); base.setDate(base.getDate() - 7);
    } else if (scale === "weeks") {
      const dow = today.getDay();
      base = new Date(today); base.setDate(base.getDate() - dow - 7);
    } else if (scale === "months") {
      base = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    } else {
      const q = Math.floor(today.getMonth() / 3);
      base = new Date(today.getFullYear(), q * 3 - 3, 1);
    }
    const d = new Date(base);
    d.setDate(d.getDate() + viewOffset);
    return d;
  }, [today, scale, viewOffset]);

  const viewEnd = useMemo(() => {
    const d = new Date(viewStart);
    d.setDate(d.getDate() + cfg.visibleDays);
    return d;
  }, [viewStart, cfg]);

  const totalDays = useMemo(() => daysBetween(viewStart, viewEnd), [viewStart, viewEnd]);
  const totalWidth = totalDays * cfg.pxPerDay;

  const columns = useMemo(() => cfg.getCols(viewStart, totalDays), [viewStart, totalDays, cfg, scale]);

  const todayPx = useMemo(() => {
    const d = daysBetween(viewStart, today);
    return d < 0 || d > totalDays ? null : d * cfg.pxPerDay;
  }, [today, viewStart, totalDays, cfg]);

  // Capacity per column
  const capacity = useMemo(() => columns.map((col) => {
    const colEnd = new Date(col);
    colEnd.setDate(colEnd.getDate() + cfg.colWidth(col) - 1);
    return clients.filter((c) => {
      const start = new Date(c.contractStart);
      const end = c.contractEnd ? new Date(c.contractEnd) : null;
      return start <= colEnd && (!end || end >= col);
    }).length;
  }), [columns, clients, cfg]);

  const maxCapacity = Math.max(...capacity, 1);

  function navigate(dir: number) {
    setViewOffset(o => o + dir * cfg.navStepDays);
  }
  function resetToToday() {
    setViewOffset(0);
  }

  const rangeLabel = (() => {
    const s = viewStart.toLocaleString("default", { month: "short", year: "numeric" });
    const e = viewEnd.toLocaleString("default", { month: "short", year: "numeric" });
    return s === e ? s : `${s} — ${e}`;
  })();

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Navigation bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white gap-4 flex-shrink-0">
        <div className="text-sm font-mono text-slate-500">{rangeLabel}</div>

        <div className="flex items-center gap-3">
          {/* Scale selector */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            {(Object.keys(SCALE_CONFIG) as Scale[]).map((s) => (
              <button
                key={s}
                onClick={() => { setScale(s); setViewOffset(0); }}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  scale === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {SCALE_CONFIG[s].label}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={resetToToday} className="px-3 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              Today
            </button>
            <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ minHeight: "100%" }}>
          {/* Fixed left column */}
          <div className="flex-shrink-0 sticky left-0 bg-white z-20 border-r border-slate-200" style={{ width: LEFT_COL_WIDTH }}>
            <div className="h-8 border-b border-slate-200" />
            <div className="h-14 border-b border-slate-200 px-3 flex items-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Active</span>
            </div>
            {clients.map((client) => {
              const status = getContractStatus(client);
              return (
                <div
                  key={client.id}
                  className="h-11 border-b border-slate-100 px-3 flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 transition-colors group"
                  onClick={() => onEditClient(client)}
                >
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", COLOR_BAR[client.color] || "bg-violet-500")} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-800 truncate font-medium block">{client.name}</span>
                  </div>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
                    STATUS_STYLES[status as keyof typeof STATUS_STYLES]?.pill || "bg-slate-100 text-slate-500"
                  )}>
                    {status.replace("_", " ")}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Scrollable timeline */}
          <div className="flex-1 overflow-x-auto">
            <div style={{ width: Math.max(totalWidth, 600) }}>
              {/* Column headers */}
              <div className="flex h-8 border-b border-slate-200 bg-slate-50">
                {columns.map((col, i) => {
                  const colDays = cfg.colWidth(col);
                  const w = colDays * cfg.pxPerDay;
                  const isCurrentCol = today >= col && today < new Date(col.getTime() + colDays * 86400000);
                  return (
                    <div
                      key={i}
                      className={cn("flex-shrink-0 border-r border-slate-200 flex items-center px-2", isCurrentCol && "bg-blue-50")}
                      style={{ width: w }}
                    >
                      <span className={cn("text-[11px] font-mono truncate", isCurrentCol ? "text-blue-600 font-semibold" : "text-slate-500")}>
                        {cfg.colLabel(col)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Capacity row */}
              <div className="flex h-14 border-b border-slate-200 bg-white items-end pb-1.5 px-px gap-px">
                {columns.map((col, i) => {
                  const colDays = cfg.colWidth(col);
                  const w = colDays * cfg.pxPerDay;
                  const pct = (capacity[i] / maxCapacity) * 100;
                  return (
                    <div key={i} className="flex flex-col items-center justify-end flex-shrink-0" style={{ width: w - 1 }}>
                      <span className="text-[10px] font-mono text-slate-500 mb-0.5 leading-none">{capacity[i]}</span>
                      <div className="w-full rounded-sm bg-blue-200 transition-all" style={{ height: `${Math.max(pct * 0.4, 3)}px` }} />
                    </div>
                  );
                })}
              </div>

              {/* Client rows */}
              <div className="relative bg-white">
                {/* Today line */}
                {todayPx !== null && (
                  <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: todayPx }}>
                    <div className="w-px h-full bg-blue-400/60" />
                  </div>
                )}

                {/* Grid lines */}
                {columns.map((col, i) => {
                  const offset = daysBetween(viewStart, col) * cfg.pxPerDay;
                  return (
                    <div key={i} className="absolute top-0 bottom-0 w-px bg-slate-100 pointer-events-none" style={{ left: offset }} />
                  );
                })}

                {clients.map((client) => {
                  const status = getContractStatus(client);
                  const start = new Date(client.contractStart);
                  const end = client.contractEnd ? new Date(client.contractEnd) : viewEnd;
                  const isOngoing = !client.contractEnd;

                  const startPx = Math.max(daysBetween(viewStart, start) * cfg.pxPerDay, 0);
                  const endPx = Math.min(daysBetween(viewStart, end) * cfg.pxPerDay, totalWidth);
                  const width = Math.max(endPx - startPx, 6);

                  const barColor = STATUS_BAR_OVERRIDE[status as keyof typeof STATUS_BAR_OVERRIDE] || COLOR_BAR[client.color] || "bg-violet-500";

                  return (
                    <div key={client.id} className="h-11 border-b border-slate-100 flex items-center relative">
                      {startPx < totalWidth && endPx > 0 && (
                        <div
                          className={cn("absolute h-7 rounded cursor-pointer hover:brightness-125 hover:scale-y-105 transition-all flex items-center overflow-hidden", barColor, isOngoing ? "rounded-r-none" : "")}
                          style={{ left: startPx, width }}
                          onClick={() => onEditClient(client)}
                          title={`${client.name}${client.contractEnd ? ` · ends ${new Date(client.contractEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : " · ongoing"}`}
                        >
                          {width > 40 && (
                            <span className="text-[11px] font-medium text-white px-2 truncate whitespace-nowrap">{client.name}</span>
                          )}
                          {isOngoing && (
                            <div className="absolute right-0 top-0 bottom-0 w-5 flex-shrink-0"
                              style={{ background: "repeating-linear-gradient(90deg, transparent 0px, transparent 3px, rgba(0,0,0,0.25) 3px, rgba(0,0,0,0.25) 5px)" }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-2.5 border-t border-slate-200 bg-white flex items-center gap-5 flex-shrink-0">
        {(Object.entries(STATUS_STYLES) as [string, { pill: string }][]).map(([status, styles]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", styles.pill)}>
              {status.replace("_", " ")}
            </span>
          </div>
        ))}
        <div className="ml-auto text-[11px] text-slate-400 font-mono">
          Today: {today.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      </div>
    </div>
  );
}
