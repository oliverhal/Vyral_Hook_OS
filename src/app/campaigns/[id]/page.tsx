"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { cn, CAMPAIGN_COLORS } from "@/lib/utils";
import { FORMAT_COLORS } from "@/types";
import type { Campaign, Week, Hook } from "@/types";
import { ChevronDown, ChevronUp, Archive, CheckCircle2, Clock, ArrowLeft } from "lucide-react";

type CampaignFull = Campaign & {
  weeks: (Week & { hooks: Hook[] })[];
  _count?: { weeks: number };
};

function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function WeekSection({ week }: { week: Week & { hooks: Hook[] } }) {
  const [open, setOpen] = useState(true);
  const selected = week.hooks.filter(h => h.isSelected);
  const rest = week.hooks.filter(h => !h.isSelected);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold text-slate-800">
            {fmt(week.weekStart)}
          </div>
          <span className={cn(
            "badge text-xs",
            week.status === "finalized" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
            week.status === "reviewing" ? "bg-blue-50 text-blue-700 border-blue-200" :
            "bg-amber-50 text-amber-700 border-amber-200"
          )}>
            {week.status}
          </span>
          <span className="text-xs text-slate-400">{week.hooks.length} hooks · {selected.length} selected</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && week.hooks.length > 0 && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {/* Selected hooks first */}
          {selected.map(hook => (
            <HookRow key={hook.id} hook={hook} />
          ))}
          {rest.map(hook => (
            <HookRow key={hook.id} hook={hook} />
          ))}
        </div>
      )}

      {open && week.hooks.length === 0 && (
        <p className="px-5 py-4 text-sm text-slate-400 border-t border-slate-100">No hooks submitted this week.</p>
      )}
    </div>
  );
}

function HookRow({ hook }: { hook: Hook }) {
  return (
    <div className={cn(
      "flex items-start gap-3 px-5 py-3.5",
      hook.isSelected ? "bg-emerald-50/50" : "hover:bg-slate-50/50"
    )}>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm leading-snug", hook.isSelected ? "font-semibold text-slate-800" : "text-slate-700")}>
          {hook.hookText}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={cn("badge text-xs border", FORMAT_COLORS[hook.format] || "bg-slate-100 text-slate-600 border-slate-200")}>
            {hook.format}
          </span>
          <span className="text-xs text-slate-400">{hook.submitterName}</span>
          {hook.wentViral && (
            <span className="badge bg-orange-50 text-orange-600 border-orange-200 text-xs">viral</span>
          )}
        </div>
      </div>
      {hook.isSelected && (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
      )}
    </div>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/campaigns/${id}`)
      .then(r => r.json())
      .then(data => { setCampaign(data); setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 max-w-4xl mx-auto space-y-4 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}
        </div>
      </AppShell>
    );
  }

  if (!campaign) {
    return (
      <AppShell>
        <div className="p-8 text-center text-slate-400">Campaign not found.</div>
      </AppShell>
    );
  }

  const colors = CAMPAIGN_COLORS[campaign.color] || CAMPAIGN_COLORS.blue;
  const totalHooks = campaign.weeks.reduce((s, w) => s + w.hooks.length, 0);
  const selectedHooks = campaign.weeks.reduce((s, w) => s + w.hooks.filter(h => h.isSelected).length, 0);
  const isArchived = !campaign.active;

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto">

        {/* Back */}
        <Link href={isArchived ? "/archive" : "/campaigns"} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {isArchived ? "Back to Archive" : "Back to Campaigns"}
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0", colors.bg)}>
            {campaign.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{campaign.name}</h1>
              {isArchived && (
                <span className="flex items-center gap-1 badge bg-slate-100 text-slate-500 border border-slate-200">
                  <Archive className="w-3 h-3" /> archived
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm mt-0.5">{campaign.clientName}</p>
          </div>
          <div className="flex gap-6 text-right flex-shrink-0">
            <div>
              <p className="text-xl font-bold text-slate-900">{campaign.weeks.length}</p>
              <p className="text-xs text-slate-400">weeks</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{totalHooks}</p>
              <p className="text-xs text-slate-400">hooks</p>
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-600">{selectedHooks}</p>
              <p className="text-xs text-slate-400">selected</p>
            </div>
          </div>
        </div>

        {/* Weeks */}
        {campaign.weeks.length === 0 ? (
          <div className="card p-12 text-center">
            <Clock className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p className="text-slate-400 text-sm">No weeks recorded for this campaign.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...campaign.weeks]
              .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())
              .map(week => (
                <WeekSection key={week.id} week={week} />
              ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
