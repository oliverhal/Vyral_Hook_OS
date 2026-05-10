"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Flame, Search, ExternalLink, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { FORMAT_COLORS } from "@/types";
import type { ValidatedHook, WeekValidatedHook } from "@/types";

interface Props {
  weekId: string;
  campaignId: string;
  selected: WeekValidatedHook[];
  target: number;
  onChange: () => void;
  disabled?: boolean;
}

export default function ValidatedPicker({ weekId, campaignId, selected, target, onChange, disabled }: Props) {
  const [library, setLibrary] = useState<ValidatedHook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}/validated`)
      .then((r) => r.json())
      .then((data) => { setLibrary(data); setLoading(false); });
  }, [campaignId]);

  const selectedIds = new Set(selected.map((s) => s.validatedHookId));

  async function toggle(validatedHookId: string) {
    if (disabled || busy) return;
    setBusy(validatedHookId);

    if (selectedIds.has(validatedHookId)) {
      await fetch(`/api/weeks/${weekId}/validated/${validatedHookId}`, { method: "DELETE" });
    } else {
      await fetch(`/api/weeks/${weekId}/validated`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validatedHookId }),
      });
    }

    setBusy(null);
    onChange();
  }

  const filtered = library
    .filter((h) => h.hookText.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      // Selected first, then least recently used, then unused
      const aSel = selectedIds.has(a.id);
      const bSel = selectedIds.has(b.id);
      if (aSel !== bSel) return aSel ? -1 : 1;
      const aLast = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bLast = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      return aLast - bLast;
    });

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          <h3 className="font-semibold text-slate-800 text-sm">Validated hooks</h3>
          <span className={cn(
            "badge text-xs",
            selected.length === target ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
          )}>
            {selected.length} / {target}
          </span>
        </div>
        <Link
          href={`/campaigns/${campaignId}/validated`}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Manage library
        </Link>
      </div>

      {library.length === 0 && !loading ? (
        <div className="text-center py-6">
          <div className="text-3xl mb-2">🔥</div>
          <p className="text-sm text-slate-500 mb-2">No validated hooks for this campaign yet</p>
          <Link
            href={`/campaigns/${campaignId}/validated`}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            Add or import them →
          </Link>
        </div>
      ) : (
        <>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search library..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:bg-white transition-colors"
            />
          </div>

          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-lg" />)}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {filtered.map((hook) => {
                const isSelected = selectedIds.has(hook.id);
                const order = selected.find((s) => s.validatedHookId === hook.id)?.selectedOrder;
                const formatColor = FORMAT_COLORS[hook.format] ?? "bg-slate-100 text-slate-600";

                return (
                  <button
                    key={hook.id}
                    onClick={() => toggle(hook.id)}
                    disabled={disabled || busy === hook.id}
                    className={cn(
                      "w-full text-left p-2.5 rounded-lg border transition-all",
                      isSelected
                        ? "bg-orange-50 border-orange-300 ring-1 ring-orange-200"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                      disabled && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5",
                        isSelected ? "bg-orange-500 border-orange-500 text-white" : "border-slate-300"
                      )}>
                        {isSelected && (order != null ? (
                          <span className="text-[10px] font-bold">{order}</span>
                        ) : <Check className="w-3 h-3" />)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={cn("badge text-[10px] py-0", formatColor)}>{hook.format}</span>
                          {hook.timesUsed > 0 && (
                            <span className="text-[10px] text-slate-400">Used {hook.timesUsed}x</span>
                          )}
                          {hook.referenceVideo && (
                            <a
                              href={hook.referenceVideo}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-slate-400 hover:text-blue-600"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-800 leading-snug">{hook.hookText}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
