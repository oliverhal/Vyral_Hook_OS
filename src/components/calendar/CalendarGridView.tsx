"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarClient, COLOR_BAR, getContractStatus, STATUS_STYLES } from "./types";

interface CalendarGridViewProps {
  clients: CalendarClient[];
  onEditClient: (client: CalendarClient) => void;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isActiveOnDay(client: CalendarClient, date: Date): boolean {
  const start = startOfDay(new Date(client.contractStart));
  const end = client.contractEnd ? startOfDay(new Date(client.contractEnd)) : null;
  const d = startOfDay(date);
  return d >= start && (!end || d <= end);
}

// Build week rows: each row is 7 days (Mon-Sun), starting from the Monday before/on the 1st of the month
function buildWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  // Monday = 0 offset
  const dow = (first.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const start = new Date(first);
  start.setDate(start.getDate() - dow);

  const last = new Date(year, month + 1, 0);
  const lastDow = (last.getDay() + 6) % 7;
  const end = new Date(last);
  end.setDate(end.getDate() + (6 - lastDow));

  const weeks: Date[][] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// For each week row, compute event "lanes" (vertical stacking positions)
interface EventSpan {
  client: CalendarClient;
  startCol: number; // 0-6 within the week
  endCol: number;   // 0-6 within the week
  lane: number;
  startsThisWeek: boolean; // contract starts in this span (show left rounded)
  endsThisWeek: boolean;   // contract ends in this span (show right rounded)
}

function computeWeekSpans(clients: CalendarClient[], week: Date[]): EventSpan[] {
  const spans: EventSpan[] = [];
  const laneOccupancy: number[] = []; // lane -> last endCol

  for (const client of clients) {
    // Find which cols this client is active in this week
    let startCol = -1;
    let endCol = -1;
    for (let i = 0; i < 7; i++) {
      if (isActiveOnDay(client, week[i])) {
        if (startCol === -1) startCol = i;
        endCol = i;
      }
    }
    if (startCol === -1) continue;

    // Assign to lowest available lane
    let lane = 0;
    while (laneOccupancy[lane] !== undefined && laneOccupancy[lane] >= startCol) {
      lane++;
    }
    laneOccupancy[lane] = endCol;

    const contractStart = startOfDay(new Date(client.contractStart));
    const contractEnd = client.contractEnd ? startOfDay(new Date(client.contractEnd)) : null;
    const weekDayStart = startOfDay(week[startCol]);
    const weekDayEnd = startOfDay(week[endCol]);

    spans.push({
      client,
      startCol,
      endCol,
      lane,
      startsThisWeek: contractStart.getTime() === weekDayStart.getTime() || (startCol === 0 && contractStart < week[0]),
      endsThisWeek: contractEnd ? contractEnd.getTime() === weekDayEnd.getTime() : false,
    });
  }

  return spans;
}

const MAX_VISIBLE_LANES = 3;

export default function CalendarGridView({ clients, onEditClient }: CalendarGridViewProps) {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const weeks = useMemo(() => buildWeeks(year, month), [year, month]);

  const monthName = new Date(year, month, 1).toLocaleString("default", { month: "long", year: "numeric" });

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const isToday = (d: Date) => startOfDay(d).getTime() === startOfDay(today).getTime();
  const isCurrentMonth = (d: Date) => d.getMonth() === month;

  // Active count for the month
  const activeThisMonth = useMemo(() => {
    const mid = new Date(year, month, 15);
    return clients.filter(c => isActiveOnDay(c, mid)).length;
  }, [clients, year, month]);

  return (
    <div className="flex flex-col h-full p-6 overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{monthName}</h2>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">{activeThisMonth} active client{activeThisMonth !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }}
            className="px-3 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors">
            Today
          </button>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1 flex-shrink-0">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[11px] text-slate-400 uppercase tracking-widest py-1.5 font-semibold">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 flex flex-col gap-1 overflow-auto">
        {weeks.map((week, weekIdx) => {
          const spans = computeWeekSpans(clients, week);
          const visibleSpans = spans.filter(s => s.lane < MAX_VISIBLE_LANES);
          const overflowByDay: number[] = Array(7).fill(0);
          spans.filter(s => s.lane >= MAX_VISIBLE_LANES).forEach(s => {
            for (let c = s.startCol; c <= s.endCol; c++) overflowByDay[c]++;
          });

          return (
            <div key={weekIdx} className="grid grid-cols-7 gap-1 relative min-h-[90px]">
              {/* Day cells (background) */}
              {week.map((day, colIdx) => (
                <div
                  key={colIdx}
                  className={cn(
                    "bg-white border border-slate-200 rounded-xl pt-1.5 pb-1 px-1.5 min-h-[90px]",
                    !isCurrentMonth(day) && "opacity-40 bg-slate-50",
                    isToday(day) && "border-blue-300 bg-blue-50"
                  )}
                >
                  <div className={cn(
                    "text-xs font-mono w-6 h-6 flex items-center justify-center rounded-full",
                    isToday(day) ? "bg-blue-600 text-white font-bold" : "text-slate-400"
                  )}>
                    {day.getDate()}
                  </div>
                  {overflowByDay[colIdx] > 0 && (
                    <div className="mt-auto text-[10px] text-slate-400 px-0.5 pt-1">
                      +{overflowByDay[colIdx]} more
                    </div>
                  )}
                </div>
              ))}

              {/* Event bars — absolutely positioned over the grid */}
              <div className="absolute inset-0 pointer-events-none" style={{ paddingTop: "28px" }}>
                {visibleSpans.map((span, i) => {
                  const status = getContractStatus(span.client);
                  const barColor = COLOR_BAR[span.client.color] || "bg-violet-500";

                  // Position: each col is 1/7 of width
                  const colW = 100 / 7;
                  const left = span.startCol * colW;
                  const width = (span.endCol - span.startCol + 1) * colW;
                  const top = span.lane * 22; // 22px per lane
                  const gapPx = 2; // gap between cols

                  return (
                    <div
                      key={`${span.client.id}-${i}`}
                      className={cn(
                        "absolute h-5 flex items-center overflow-hidden cursor-pointer hover:brightness-125 transition-brightness pointer-events-auto",
                        barColor,
                        span.startsThisWeek ? "rounded-l" : "rounded-l-none",
                        span.endsThisWeek || !span.client.contractEnd ? "rounded-r" : "rounded-r-none"
                      )}
                      style={{
                        left: `calc(${left}% + ${gapPx}px)`,
                        width: `calc(${width}% - ${gapPx * 2}px)`,
                        top: top,
                      }}
                      onClick={() => onEditClient(span.client)}
                      title={span.client.name}
                    >
                      {span.startsThisWeek && (
                        <span className="text-[10px] font-medium text-white px-1.5 truncate whitespace-nowrap leading-none">
                          {span.client.name}
                        </span>
                      )}
                      {!span.client.contractEnd && span.endCol === 6 && (
                        <div className="absolute right-0 top-0 bottom-0 w-3"
                          style={{ background: "repeating-linear-gradient(90deg, transparent 0, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Client legend */}
      <div className="flex-shrink-0 mt-3 pt-3 border-t border-slate-200">
        <div className="flex flex-wrap gap-2">
          {clients.map(client => {
            const status = getContractStatus(client);
            return (
              <button
                key={client.id}
                onClick={() => onEditClient(client)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", COLOR_BAR[client.color] || "bg-violet-500")} />
                <span className="text-xs text-slate-700 font-medium">{client.name}</span>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full ml-0.5",
                  STATUS_STYLES[status as keyof typeof STATUS_STYLES]?.pill || "bg-slate-100 text-slate-500"
                )}>
                  {status.replace("_", " ")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
