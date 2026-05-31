"use client";

import { useEffect, useState } from "react";
import { Loader2, X, Check, History, ChevronDown, ChevronUp } from "lucide-react";
import { cn, formatWeekRange } from "@/lib/utils";
import { FORMAT_COLORS } from "@/types";

interface PreviousHook {
  id: string;
  hookText: string;
  format: string;
  submitterName: string;
  caption: string;
  referenceVideo: string | null;
  week: { id: string; weekStart: string };
}

interface PreviousHooksPickerProps {
  weekId: string;
  onAdded: () => void;
}

export default function PreviousHooksPicker({ weekId, onAdded }: PreviousHooksPickerProps) {
  const [open, setOpen] = useState(false);
  const [hooks, setHooks] = useState<PreviousHook[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);

  async function load() {
    setLoading(true);
    const data = await fetch(`/api/weeks/${weekId}/unused-hooks`).then((r) => r.json());
    setHooks(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function addToWeek() {
    if (selected.size === 0) return;
    setAdding(true);
    await fetch(`/api/weeks/${weekId}/unused-hooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hookIds: Array.from(selected) }),
    });
    setAdding(false);
    setDone(true);
    setSelected(new Set());
    onAdded();
    setTimeout(() => { setDone(false); setOpen(false); }, 1500);
  }

  // Group hooks by week
  const byWeek = hooks.reduce<Record<string, PreviousHook[]>>((acc, h) => {
    const key = h.week.weekStart;
    if (!acc[key]) acc[key] = [];
    acc[key].push(h);
    return acc;
  }, {});

  const weekKeys = Object.keys(byWeek).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  function handleOpen() {
    setOpen(true);
    if (hooks.length === 0) load();
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <History className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">Carry forward from previous weeks</div>
            <div className="text-xs text-slate-400 mt-0.5">Browse unused hooks and add them to this week</div>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : hooks.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-400">No unused hooks from previous weeks.</p>
            </div>
          ) : (
            <>
              {/* Hook list grouped by week */}
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
                {weekKeys.map((weekStart) => (
                  <div key={weekStart}>
                    <div className="px-5 py-2 bg-slate-50 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">
                        {formatWeekRange(new Date(weekStart))}
                      </span>
                      <button
                        onClick={() => {
                          const ids = byWeek[weekStart].map((h) => h.id);
                          const allSelected = ids.every((id) => selected.has(id));
                          setSelected((prev) => {
                            const next = new Set(prev);
                            ids.forEach((id) => allSelected ? next.delete(id) : next.add(id));
                            return next;
                          });
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {byWeek[weekStart].every((h) => selected.has(h.id)) ? "Deselect all" : "Select all"}
                      </button>
                    </div>
                    {byWeek[weekStart].map((hook) => {
                      const isSelected = selected.has(hook.id);
                      return (
                        <div
                          key={hook.id}
                          onClick={() => toggle(hook.id)}
                          className={cn(
                            "flex items-start gap-3 px-5 py-3 cursor-pointer transition-colors",
                            isSelected ? "bg-blue-50 hover:bg-blue-100/70" : "hover:bg-slate-50"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                            isSelected ? "bg-blue-600 border-blue-600" : "border-slate-300"
                          )}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-800 leading-snug">{hook.hookText}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", FORMAT_COLORS[hook.format] ?? "bg-slate-100 text-slate-600")}>
                                {hook.format}
                              </span>
                              <span className="text-[10px] text-slate-400">{hook.submitterName}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
                <span className="text-xs text-slate-500">
                  {selected.size > 0 ? `${selected.size} hook${selected.size !== 1 ? "s" : ""} selected` : "Select hooks to carry forward"}
                </span>
                <button
                  onClick={addToWeek}
                  disabled={selected.size === 0 || adding || done}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50",
                    done ? "bg-emerald-600 text-white" : "btn-primary"
                  )}
                >
                  {adding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {done && <Check className="w-3.5 h-3.5" />}
                  {done ? "Added!" : adding ? "Adding..." : `Add ${selected.size || ""} to this week`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
