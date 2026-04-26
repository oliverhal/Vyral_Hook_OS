"use client";

import { useEffect, useState } from "react";
import { Flame, Trash2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { FORMAT_COLORS } from "@/types";
import type { Campaign, ValidatedHook } from "@/types";

interface Props {
  campaign: Campaign;
  isAdmin?: boolean;
}

export default function ValidatedLibrary({ campaign, isAdmin }: Props) {
  const [hooks, setHooks] = useState<ValidatedHook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/campaigns/${campaign.id}/validated`)
      .then((r) => r.json())
      .then((data) => { setHooks(data); setLoading(false); });
  }, [campaign.id]);

  async function removeValidated(id: string) {
    if (!confirm("Remove from validated library?")) return;
    await fetch(`/api/validated/${id}`, { method: "DELETE" });
    setHooks((prev) => prev.filter((h) => h.id !== id));
  }

  const filtered = hooks.filter((h) =>
    h.hookText.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold text-slate-900">Validated Hooks</h2>
          <span className="badge bg-orange-100 text-orange-700 text-xs">{hooks.length}</span>
        </div>
        <p className="text-xs text-slate-400">Hooks that went viral — proven to work</p>
      </div>

      {hooks.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search validated hooks..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🔥</div>
          <div className="text-slate-500 text-sm font-medium">No validated hooks yet</div>
          <div className="text-slate-400 text-xs mt-1">
            When a hook goes viral, mark it with the flame icon in the week view and it will appear here.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((hook) => {
            const formatColor = FORMAT_COLORS[hook.format] ?? "bg-slate-100 text-slate-600";
            return (
              <div key={hook.id} className="card p-4 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={cn("badge text-xs", formatColor)}>{hook.format}</span>
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                    </div>
                    <p className="font-semibold text-slate-900 text-sm leading-snug">{hook.hookText}</p>
                    {hook.notes && (
                      <p className="text-xs text-slate-500 mt-1">{hook.notes}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {hook.addedBy && (
                        <span className="text-xs text-slate-400">Added by {hook.addedBy.name}</span>
                      )}
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400">
                        {new Date(hook.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => removeValidated(hook.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
