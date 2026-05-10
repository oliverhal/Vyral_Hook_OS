"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Flame, History } from "lucide-react";
import { cn, formatWeekRange } from "@/lib/utils";
import { FORMAT_COLORS } from "@/types";

interface HistoryHook {
  id: string;
  hookText: string;
  format: string;
  submitterName: string;
  isSelected: boolean;
  wentViral: boolean;
}

interface HistoryWeek {
  id: string;
  weekStart: string;
  status: string;
  hooks: HistoryHook[];
}

export default function WeekHistoryPanel({
  campaignId,
  currentWeekId,
}: {
  campaignId: string;
  currentWeekId: string;
}) {
  const [weeks, setWeeks] = useState<HistoryWeek[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!panelOpen || weeks.length > 0) return;
    setLoading(true);
    fetch(`/api/weeks?campaignId=${campaignId}`)
      .then((r) => r.json())
      .then((data: HistoryWeek[]) => {
        const past = data
          .filter((w) => w.status === "finalized" && w.id !== currentWeekId)
          .slice(0, 10);
        setWeeks(past);
        if (past.length > 0) setExpanded(past[0].id);
      })
      .finally(() => setLoading(false));
  }, [panelOpen, campaignId, currentWeekId, weeks.length]);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setPanelOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Previous weeks</span>
        </div>
        {panelOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {panelOpen && (
        <div className="border-t border-slate-100">
          {loading && (
            <div className="px-5 py-4 text-sm text-slate-400">Loading...</div>
          )}
          {!loading && weeks.length === 0 && (
            <div className="px-5 py-4 text-sm text-slate-400">No finalized weeks yet.</div>
          )}
          {weeks.map((week) => {
            const selected = week.hooks.filter((h) => h.isSelected);
            const isOpen = expanded === week.id;
            return (
              <div key={week.id} className="border-b border-slate-100 last:border-0">
                <button
                  onClick={() => setExpanded(isOpen ? null : week.id)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-700">
                      {formatWeekRange(new Date(week.weekStart))}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {selected.length} selected · {week.hooks.filter((h) => h.wentViral).length} viral
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-3 space-y-2">
                    {selected.length === 0 ? (
                      <p className="text-xs text-slate-400 px-1">No hooks selected this week.</p>
                    ) : (
                      selected.map((hook) => (
                        <div key={hook.id} className="bg-slate-50 rounded-xl px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-slate-700 leading-snug flex-1">{hook.hookText}</p>
                            {hook.wentViral && (
                              <Flame className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", FORMAT_COLORS[hook.format] ?? "bg-slate-100 text-slate-600")}>
                              {hook.format}
                            </span>
                            <span className="text-[10px] text-slate-400">{hook.submitterName}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
