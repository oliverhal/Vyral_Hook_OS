"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { isPast } from "date-fns";
import {
  ArrowLeft, Check, CheckCircle2, ChevronDown, ChevronUp,
  Clock, Sparkles, Users, AlertCircle, Hash, Layers, Link as LinkIcon, Share2
} from "lucide-react";
import { cn, CAMPAIGN_COLORS, formatWeekRange, formatDeadline } from "@/lib/utils";
import HookCard from "./HookCard";
import HookForm from "./HookForm";
import BulkImportModal from "./BulkImportModal";
import ExportPanel from "./ExportPanel";
import ValidatedPicker from "./ValidatedPicker";
import WeekHistoryPanel from "./WeekHistoryPanel";
import type { Hook, WeekWithHooks, WeekMode } from "@/types";

type FilterType = "all" | "mine" | "selected";

export default function WeekView({ weekId }: { weekId: string }) {
  const { data: session } = useSession();
  const [week, setWeek] = useState<WeekWithHooks | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [filterContributor, setFilterContributor] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const currentUser = session?.user as { name?: string; role?: string } | undefined;
  const isAdmin = currentUser?.role === "admin";

  const fetchWeek = useCallback(async () => {
    const data = await fetch(`/api/weeks/${weekId}`).then((r) => r.json());
    setWeek(data);
    setLoading(false);
  }, [weekId]);

  useEffect(() => {
    fetchWeek();
    const interval = setInterval(fetchWeek, 20000);
    return () => clearInterval(interval);
  }, [fetchWeek]);

  async function toggleSelect(hookId: string, selected: boolean) {
    if (!week) return;

    // Mark hook as selected/deselected
    const updated = week.hooks.map((h) =>
      h.id === hookId ? { ...h, isSelected: selected } : h
    );

    // Renumber all selected hooks sequentially — new hook goes last, rest keep their relative order
    const nowSelected = updated
      .filter((h) => h.isSelected)
      .sort((a, b) => {
        if (a.id === hookId) return 1;
        if (b.id === hookId) return -1;
        return (a.selectedOrder ?? 99) - (b.selectedOrder ?? 99);
      });

    const orderMap = new Map(nowSelected.map((h, i) => [h.id, i + 1]));

    const finalHooks = updated.map((h) => ({
      ...h,
      selectedOrder: h.isSelected ? (orderMap.get(h.id) ?? null) : null,
    }));

    setWeek((w) => w ? { ...w, hooks: finalHooks } : w);

    // Persist all changed hooks to backend
    const changed = finalHooks.filter((h) => {
      const orig = week.hooks.find((o) => o.id === h.id);
      return orig && (orig.isSelected !== h.isSelected || orig.selectedOrder !== h.selectedOrder);
    });

    await Promise.all(changed.map((h) =>
      fetch(`/api/hooks/${h.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isSelected: h.isSelected,
          selectedOrder: h.selectedOrder,
          status: h.isSelected ? "selected" : "submitted",
        }),
      })
    ));
  }

  async function deleteHook(hookId: string) {
    if (!confirm("Delete this hook?")) return;
    await fetch(`/api/hooks/${hookId}`, { method: "DELETE" });
    setWeek((w) => w ? { ...w, hooks: w.hooks.filter((h) => h.id !== hookId) } : w);
  }

  async function generateCaption(hookId: string) {
    if (!week) return;
    const hook = week.hooks.find((h) => h.id === hookId);
    if (!hook) return;

    const res = await fetch("/api/generate-caption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hookText: hook.hookText,
        caption: hook.caption,
        format: hook.format,
        campaignName: week.campaign.name,
        clientName: week.campaign.clientName,
        hashtags: week.campaign.hashtags,
      }),
    });

    if (!res.ok) {
      alert("AI caption failed. Check ANTHROPIC_API_KEY in .env");
      return;
    }

    const { caption } = await res.json();

    await fetch(`/api/hooks/${hookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiCaption: caption }),
    });

    setWeek((w) => w ? {
      ...w,
      hooks: w.hooks.map((h) => h.id === hookId ? { ...h, aiCaption: caption } : h),
    } : w);
  }

  async function generateAllCaptions() {
    if (!week) return;
    const selected = week.hooks.filter((h) => h.isSelected && !h.aiCaption);
    for (const hook of selected) {
      await generateCaption(hook.id);
    }
  }

  async function handleViralToggle(hookId: string, wentViral: boolean) {
    setWeek((w) => w ? {
      ...w,
      hooks: w.hooks.map((h) => h.id === hookId ? { ...h, wentViral } : h),
    } : w);
  }

  function handleEditHook(hookId: string, updates: Partial<Hook>) {
    setWeek((w) => w ? {
      ...w,
      hooks: w.hooks.map((h) => h.id === hookId ? { ...h, ...updates } : h),
    } : w);
  }

  async function updateWeekStatus(status: string) {
    setStatusUpdating(true);
    await fetch(`/api/weeks/${weekId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setWeek((w) => w ? { ...w, status: status as WeekWithHooks["status"] } : w);
    setStatusUpdating(false);
  }

  async function changeMode(newMode: WeekMode) {
    if (!week) return;
    await fetch(`/api/weeks/${weekId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: newMode }),
    });
    setWeek((w) => w ? { ...w, mode: newMode } : w);
  }

  if (loading || !week) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        <div className="h-20 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 h-96 bg-slate-200 rounded-2xl" />
          <div className="col-span-3 h-96 bg-slate-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  const colors = CAMPAIGN_COLORS[week.campaign.color] || CAMPAIGN_COLORS.blue;
  const deadline = new Date(week.deadline);
  const deadlinePassed = isPast(deadline);
  const mode = week.mode || "mixed";

  // Targets
  const expTarget = mode === "bulk"
    ? week.campaign.hooksTarget + week.campaign.validatedTarget
    : week.campaign.hooksTarget;
  const valTarget = mode === "bulk" ? 0 : week.campaign.validatedTarget;
  const totalTarget = expTarget + valTarget;

  const filteredHooks = week.hooks.filter((h) => {
    if (filterContributor && h.submitterName !== filterContributor) return false;
    if (filter === "mine") return h.submitterName === currentUser?.name;
    if (filter === "selected") return h.isSelected;
    return true;
  });

  const selectedHooks = [...week.hooks]
    .filter((h) => h.isSelected)
    .sort((a, b) => (a.selectedOrder ?? 99) - (b.selectedOrder ?? 99));

  const selectedValidated = week.selectedValidated ?? [];
  const totalSelected = selectedHooks.length + selectedValidated.length;

  const submitterGroups = week.hooks.reduce<Record<string, Hook[]>>((acc, h) => {
    if (!acc[h.submitterName]) acc[h.submitterName] = [];
    acc[h.submitterName].push(h);
    return acc;
  }, {});

  const captionsNeeded = selectedHooks.filter((h) => !h.aiCaption).length;

  return (
    <>
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          All Campaigns
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">{week.campaign.emoji}</span>
              <h1 className="text-2xl font-bold text-slate-900">{week.campaign.name}</h1>
              <span className={cn("badge", colors.badge)}>{week.campaign.clientName}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span className="font-medium">{formatWeekRange(new Date(week.weekStart))}</span>
              <span className="text-slate-300">·</span>
              <span className={cn("flex items-center gap-1", deadlinePassed && "text-red-500")}>
                <Clock className="w-3.5 h-3.5" />
                {formatDeadline(deadline)}
              </span>
              <span className="text-slate-300">·</span>
              <span>{totalSelected} / {totalTarget} hooks selected</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              {linkCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
              {linkCopied ? "Link copied!" : "Share"}
            </button>
            {selectedHooks.length > 0 && captionsNeeded > 0 && (
              <button
                onClick={generateAllCaptions}
                className="flex items-center gap-2 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Generate {captionsNeeded} caption{captionsNeeded !== 1 ? "s" : ""}
              </button>
            )}
            {week.status !== "finalized" && (
              <button
                onClick={() => updateWeekStatus("finalized")}
                disabled={statusUpdating}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Finalize Week
              </button>
            )}
            <span className={cn(
              "badge text-xs font-semibold",
              week.status === "finalized" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
            )}>
              {week.status}
            </span>
          </div>
        </div>
      </div>

      {/* Mode toggle */}
      {week.status !== "finalized" && (
        <div className="mb-4 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <Layers className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div className="flex-1 text-xs text-slate-600">
            <span className="font-semibold">This week's mix:</span>{" "}
            {mode === "mixed"
              ? `${week.campaign.hooksTarget} new experimental + ${week.campaign.validatedTarget} from validated library`
              : `${week.campaign.hooksTarget + week.campaign.validatedTarget} new experimental (no validated this week)`}
          </div>
          <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-slate-200">
            {(["mixed", "bulk"] as WeekMode[]).map((m) => (
              <button
                key={m}
                onClick={() => changeMode(m)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  mode === m ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {m === "mixed" ? "Mixed" : "Bulk"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hashtags preview */}
      {week.campaign.hashtags && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <Hash className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-500 leading-relaxed">{week.campaign.hashtags}</p>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-blue-500 transition-all duration-700"
            style={{ width: `${(Math.min(selectedHooks.length, expTarget) / totalTarget) * 100}%` }}
          />
          <div
            className="h-full bg-orange-500 transition-all duration-700"
            style={{ width: `${(Math.min(selectedValidated.length, valTarget) / totalTarget) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1.5">
          <span>
            <span className="text-blue-500">●</span> {selectedHooks.length}/{expTarget} experimental
            {valTarget > 0 && (
              <>
                {" · "}
                <span className="text-orange-500">●</span> {selectedValidated.length}/{valTarget} validated
              </>
            )}
          </span>
          <span>Total target: {totalTarget}</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Left panel */}
        <div className="col-span-2 space-y-5">
          {week.status !== "finalized" && (
            <div className="space-y-2">
              <button
                onClick={() => setShowForm(!showForm)}
                className={cn(
                  "w-full flex items-center justify-between px-5 py-3 rounded-2xl border-2 text-sm font-semibold transition-all duration-200",
                  showForm
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-dashed border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600"
                )}
              >
                <span>{showForm ? "Hide form" : "+ Submit experimental hook"}</span>
                {showForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowBulkImport(true)}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-500 hover:text-violet-600 hover:border-violet-300 hover:bg-violet-50 text-sm font-medium transition-all duration-200"
              >
                <span>⚡</span>
                <span>Bulk import from sheet</span>
              </button>
            </div>
          )}

          {showForm && (
            <div className="animate-slide-up">
              <HookForm
                weekId={weekId}
                teamMembers={[]}
                onSuccess={() => { fetchWeek(); setShowForm(false); }}
              />
            </div>
          )}

          {/* Sheet URLs */}
          <div className="card p-4 space-y-4">
            {/* New hooks sheet */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <LinkIcon className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-slate-700">New hooks sheet</span>
              </div>
              {isAdmin ? (
                <input
                  className="input text-xs"
                  placeholder="https://docs.google.com/spreadsheets/..."
                  defaultValue={week.newHooksSheetUrl ?? ""}
                  onBlur={async (e) => {
                    const val = e.target.value.trim() || null;
                    if (val === (week.newHooksSheetUrl ?? null)) return;
                    await fetch(`/api/weeks/${weekId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ newHooksSheetUrl: val }),
                    });
                    fetchWeek();
                  }}
                />
              ) : week.newHooksSheetUrl ? (
                <a href={week.newHooksSheetUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline truncate block">
                  {week.newHooksSheetUrl}
                </a>
              ) : (
                <p className="text-xs text-slate-400">No sheet linked yet</p>
              )}
            </div>

            <div className="border-t border-slate-100" />

            {/* Validated hooks sheet — campaign-level, shared across all weeks */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <LinkIcon className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-semibold text-slate-700">Validated hooks sheet</span>
              </div>
              <p className="text-[10px] text-slate-400 mb-2">Saved for all weeks in this campaign</p>
              {isAdmin ? (
                <input
                  className="input text-xs"
                  placeholder="https://docs.google.com/spreadsheets/..."
                  defaultValue={week.campaign.validatedSheetUrl ?? ""}
                  onBlur={async (e) => {
                    const val = e.target.value.trim() || null;
                    if (val === (week.campaign.validatedSheetUrl ?? null)) return;
                    await fetch(`/api/campaigns/${week.campaignId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ validatedSheetUrl: val }),
                    });
                    fetchWeek();
                  }}
                />
              ) : week.campaign.validatedSheetUrl ? (
                <a href={week.campaign.validatedSheetUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-orange-600 hover:underline truncate block">
                  {week.campaign.validatedSheetUrl}
                </a>
              ) : (
                <p className="text-xs text-slate-400">No sheet linked yet</p>
              )}
            </div>
          </div>

          {/* Validated picker — only in mixed mode */}
          {mode === "mixed" && (
            <ValidatedPicker
              weekId={weekId}
              campaignId={week.campaignId}
              selected={selectedValidated}
              target={valTarget}
              onChange={fetchWeek}
              disabled={week.status === "finalized"}
            />
          )}

          {/* Contributor summary */}
          {Object.keys(submitterGroups).length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-800 text-sm">Contributors</h3>
                </div>
                {filterContributor && (
                  <button
                    onClick={() => setFilterContributor(null)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Show all
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {Object.entries(submitterGroups).map(([name, hooks]) => {
                  const selected = hooks.filter((h) => h.isSelected).length;
                  const isActive = filterContributor === name;
                  return (
                    <button
                      key={name}
                      onClick={() => setFilterContributor(isActive ? null : name)}
                      className={cn(
                        "w-full flex items-center justify-between px-2 py-2 rounded-xl transition-colors text-left",
                        isActive ? "bg-blue-50" : "hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center", isActive ? "bg-blue-600" : "bg-blue-100")}>
                          <span className={cn("text-xs font-bold", isActive ? "text-white" : "text-blue-700")}>{name.charAt(0)}</span>
                        </div>
                        <span className={cn("text-sm font-medium", isActive ? "text-blue-700" : "text-slate-700")}>{name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{hooks.length} hooks</span>
                        {selected > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                            <Check className="w-3 h-3" />
                            {selected}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {deadlinePassed && week.status !== "finalized" && (
            <div className="flex items-start justify-between gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-red-700">Deadline passed</div>
                  <div className="text-xs text-red-500 mt-0.5">Finalize whenever you're ready — no minimum required.</div>
                </div>
              </div>
              <button
                onClick={() => updateWeekStatus("finalized")}
                disabled={statusUpdating}
                className="flex-shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Finalize now
              </button>
            </div>
          )}

          <ExportPanel
            weekId={weekId}
            campaign={week.campaign}
            weekStart={week.weekStart}
            newHooksSheetUrl={week.newHooksSheetUrl}
            validatedSheetUrl={week.campaign.validatedSheetUrl}
            selectedHooks={selectedHooks}
            selectedValidated={selectedValidated}
          />

          <WeekHistoryPanel campaignId={week.campaignId} currentWeekId={weekId} />
        </div>

        {/* Right: hooks list */}
        <div className="col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-slate-200 w-fit">
              {(["all", "mine", "selected"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 capitalize",
                    filter === f ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {f === "mine" ? "My Hooks"
                    : f === "selected" ? `Selected (${selectedHooks.length})`
                      : `All (${week.hooks.length})`}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400">
              {filterContributor ? `${filterContributor}'s hooks` : "Experimental hooks"}
            </span>
          </div>

          {filteredHooks.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-3">🪝</div>
              <div className="text-slate-500 text-sm">
                {filter === "mine"
                  ? "You haven't submitted any hooks this week."
                  : filter === "selected"
                    ? `No hooks selected yet. Click any hook to select it (target: ${expTarget}).`
                    : "No hooks yet. Be the first to submit!"}
              </div>
              {filter !== "selected" && week.status !== "finalized" && (
                <button onClick={() => setShowForm(true)} className="mt-4 btn-primary inline-flex">
                  Submit First Hook
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHooks.map((hook) => (
                <HookCard
                  key={hook.id}
                  hook={hook}
                  campaign={week.campaign}
                  onSelect={week.status !== "finalized" ? toggleSelect : undefined}
                  onDelete={week.status !== "finalized" ? deleteHook : undefined}
                  onEdit={week.status !== "finalized" && (isAdmin || hook.submitterName === currentUser?.name) ? handleEditHook : undefined}
                  onGenerateCaption={hook.isSelected ? generateCaption : undefined}
                  onViralToggle={isAdmin ? handleViralToggle : undefined}
                  showSubmitter
                  selectable={week.status !== "finalized"}
                  rank={hook.isSelected ? hook.selectedOrder ?? undefined : undefined}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

    {showBulkImport && (
      <BulkImportModal
        weekId={weekId}
        onClose={() => setShowBulkImport(false)}
        onSuccess={() => { fetchWeek(); }}
      />
    )}
    </>
  );
}
