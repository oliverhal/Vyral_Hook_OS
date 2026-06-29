"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Search, Flame, ExternalLink, Check, Loader2, ChevronDown, ChevronUp, Archive, RotateCcw } from "lucide-react";
import { cn, CAMPAIGN_COLORS } from "@/lib/utils";
import { FORMAT_COLORS, HOOK_FORMATS } from "@/types";
import type { Hook, Campaign, Week } from "@/types";

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
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [weekFilter, setWeekFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [viralOnly, setViralOnly] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);
  const [validated, setValidated] = useState<Set<string>>(new Set());

  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  const [archivedCampaigns, setArchivedCampaigns] = useState<(Campaign & { _count: { weeks: number } })[]>([]);
  const [showArchivedCampaigns, setShowArchivedCampaigns] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  async function restoreCampaign(id: string) {
    setRestoring(id);
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true, contractEndDate: null }),
    });
    setArchivedCampaigns(prev => prev.filter(c => c.id !== id));
    setRestoring(null);
  }

  useEffect(() => {
    // Auto-archive first (via the campaigns fetch), then load archived list
    fetch("/api/campaigns/auto-archive", { method: "POST" })
      .finally(() => {
        fetch("/api/campaigns").then((r) => r.json()).then((data) => setCampaigns(data));
        fetch("/api/campaigns/archived").then((r) => r.json()).then((data) => setArchivedCampaigns(data));
      });
  }, []);

  // Fetch weeks when campaign changes
  useEffect(() => {
    setWeekFilter("");
    if (!campaignFilter) { setWeeks([]); return; }
    fetch(`/api/weeks?campaignId=${campaignFilter}`)
      .then((r) => r.json())
      .then((data) => setWeeks(Array.isArray(data) ? data : []));
  }, [campaignFilter]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (weekFilter) params.set("weekId", weekFilter);
    else if (campaignFilter) params.set("campaignId", campaignFilter);
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
  }, [campaignFilter, weekFilter, formatFilter, viralOnly, search]);

  async function quickValidate(hook: ArchiveHook) {
    if (!isAdmin || validating || validated.has(hook.id)) return;
    setValidating(hook.id);
    try {
      await Promise.all([
        fetch(`/api/campaigns/${hook.week.campaignId}/validated`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hookText: hook.hookText,
            format: hook.format,
            caption: hook.caption,
            referenceVideo: hook.referenceVideo,
            recordingNotes: hook.recordingNotes,
            sourceHookId: hook.id,
          }),
        }),
        fetch(`/api/hooks/${hook.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wentViral: true }),
        }),
      ]);
      setValidated((prev) => { const next = new Set(prev); next.add(hook.id); return next; });
      setHooks(prev => prev.map(h => h.id === hook.id ? { ...h, wentViral: true } : h));
    } catch {}
    setValidating(null);
  }

  function formatWeekLabel(weekStart: string) {
    return new Date(weekStart).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Hook Archive</h1>
        <p className="text-sm text-slate-500">Every hook ever submitted across all campaigns</p>
      </div>

      {/* Archived campaigns */}
      {archivedCampaigns.length > 0 && (
        <div className="mb-8">
          <button
            onClick={() => setShowArchivedCampaigns(v => !v)}
            className="flex items-center gap-2 mb-3 group"
          >
            <Archive className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-600">Archived campaigns ({archivedCampaigns.length})</span>
            {showArchivedCampaigns ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          {showArchivedCampaigns && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {archivedCampaigns.map(c => {
                const colors = CAMPAIGN_COLORS[c.color] || CAMPAIGN_COLORS.blue;
                return (
                  <div key={c.id} className="card p-4 flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity">
                    <Link href={`/campaigns/${c.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0", colors.bg)}>
                        {c.emoji}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                        <p className="text-xs text-slate-400 truncate">{c.clientName} · {c._count.weeks} weeks</p>
                      </div>
                    </Link>
                    <button
                      onClick={() => restoreCampaign(c.id)}
                      disabled={restoring === c.id}
                      title="Restore campaign"
                      className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition-colors disabled:opacity-50"
                    >
                      {restoring === c.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <RotateCcw className="w-3.5 h-3.5" />}
                      Restore
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hooks or submitters..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors"
          />
        </div>

        {/* Campaign */}
        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors"
        >
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Week — only shown when a campaign is selected */}
        {campaignFilter && weeks.length > 0 && (
          <select
            value={weekFilter}
            onChange={(e) => setWeekFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors"
          >
            <option value="">All weeks</option>
            {[...weeks]
              .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())
              .map((w) => (
                <option key={w.id} value={w.id}>
                  Week of {formatWeekLabel(w.weekStart)}
                </option>
              ))}
          </select>
        )}

        {/* Format */}
        <select
          value={formatFilter}
          onChange={(e) => setFormatFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors"
        >
          <option value="">All formats</option>
          {HOOK_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        {/* Viral */}
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
          {weekFilter && weeks.length > 0 && (() => {
            const w = weeks.find(x => x.id === weekFilter);
            return w ? <span className="ml-1">· week of {formatWeekLabel(w.weekStart)}</span> : null;
          })()}
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
            const isValidated = validated.has(hook.id);
            const isValidating = validating === hook.id;

            return (
              <div key={hook.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={cn("badge text-xs", formatColor)}>{hook.format}</span>
                      <span className={cn("badge text-xs", campaignColors.badge)}>
                        {hook.week.campaign.name}
                      </span>
                      <span className="badge text-xs bg-slate-100 text-slate-500">
                        {formatWeekLabel(hook.week.weekStart)}
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

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Quick validate button — admins only */}
                    {isAdmin && (
                      <button
                        onClick={() => quickValidate(hook)}
                        disabled={isValidating || isValidated}
                        title={isValidated ? "Added to validated hooks" : "Add to validated hooks"}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                          isValidated
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                        )}
                      >
                        {isValidating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isValidated ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Flame className="w-3.5 h-3.5" />
                        )}
                        {isValidated ? "Validated" : "Validate"}
                      </button>
                    )}

                    {hook.referenceVideo && (
                      <a
                        href={hook.referenceVideo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Reference video"
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
