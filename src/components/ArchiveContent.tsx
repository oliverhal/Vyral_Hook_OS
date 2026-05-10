"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Search, Flame, ExternalLink, Filter } from "lucide-react";
import { cn, CAMPAIGN_COLORS } from "@/lib/utils";
import { FORMAT_COLORS, HOOK_FORMATS } from "@/types";
import type { Hook, Campaign } from "@/types";

interface ArchiveHook extends Omit<Hook, "week"> {
  week: {
    id: string;
    weekStart: string;
    campaignId: string;
    campaign: Campaign;
  };
}

export default function ArchiveContent() {
  const { data: session } = useSession();
  const [hooks, setHooks] = useState<ArchiveHook[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [viralOnly, setViralOnly] = useState(false);

  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  useEffect(() => {
    fetch("/api/campaigns").then((r) => r.json()).then((data) => setCampaigns(data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (campaignFilter) params.set("campaignId", campaignFilter);
    if (formatFilter) params.set("format", formatFilter);
    if (viralOnly) params.set("viral", "true");
    if (search) params.set("search", search);

    const timeout = setTimeout(() => {
      fetch(`/api/archive?${params}`).then((r) => r.json()).then((data) => {
        setHooks(data);
        setLoading(false);
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [campaignFilter, formatFilter, viralOnly, search]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Hook Archive</h1>
        <p className="text-sm text-slate-500">Every hook ever submitted across all campaigns</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hooks or submitters..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors"
          />
        </div>

        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors"
        >
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
          ))}
        </select>

        <select
          value={formatFilter}
          onChange={(e) => setFormatFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors"
        >
          <option value="">All formats</option>
          {HOOK_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        <button
          onClick={() => setViralOnly(!viralOnly)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border transition-colors",
            viralOnly
              ? "bg-orange-50 border-orange-300 text-orange-700"
              : "bg-white border-slate-200 text-slate-500 hover:border-orange-300 hover:text-orange-600"
          )}
        >
          <Flame className="w-4 h-4" />
          Viral only
        </button>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="text-xs text-slate-400 mb-4">
          {hooks.length} hook{hooks.length !== 1 ? "s" : ""} found
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}
        </div>
      ) : hooks.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-4xl mb-3">🪝</div>
          <div className="text-slate-500 text-sm">No hooks found</div>
        </div>
      ) : (
        <div className="space-y-2">
          {hooks.map((hook) => {
            const formatColor = FORMAT_COLORS[hook.format] ?? "bg-slate-100 text-slate-600";
            const campaignColors = CAMPAIGN_COLORS[hook.week.campaign.color] || CAMPAIGN_COLORS.blue;
            const voteScore = (hook.votes ?? []).reduce((sum, v) => sum + v.value, 0);

            return (
              <div key={hook.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={cn("badge text-xs", formatColor)}>{hook.format}</span>
                      <span className={cn("badge text-xs", campaignColors.badge)}>
                        {hook.week.campaign.emoji} {hook.week.campaign.name}
                      </span>
                      {hook.wentViral && (
                        <span className="badge text-xs bg-orange-100 text-orange-700 flex items-center gap-1">
                          <Flame className="w-3 h-3" /> Viral
                        </span>
                      )}
                      {hook.isSelected && (
                        <span className="badge text-xs bg-emerald-100 text-emerald-700">Selected</span>
                      )}
                    </div>

                    <p className="font-semibold text-slate-900 text-sm leading-snug">{hook.hookText}</p>

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs text-slate-400">{hook.submitterName}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400">
                        {new Date(hook.week.weekStart).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {voteScore !== 0 && (
                        <>
                          <span className="text-xs text-slate-300">·</span>
                          <span className={cn("text-xs font-semibold", voteScore > 0 ? "text-emerald-600" : "text-red-500")}>
                            {voteScore > 0 ? "+" : ""}{voteScore} votes
                          </span>
                        </>
                      )}
                      {(hook.commentCount ?? 0) > 0 && (
                        <>
                          <span className="text-xs text-slate-300">·</span>
                          <span className="text-xs text-slate-400">{hook.commentCount} comment{hook.commentCount !== 1 ? "s" : ""}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {hook.referenceVideo && (
                      <a
                        href={hook.referenceVideo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <Link
                      href={`/weeks/${hook.weekId}`}
                      className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      View week →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
