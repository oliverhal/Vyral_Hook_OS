"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, Plus, Flame, Settings } from "lucide-react";
import { cn, CAMPAIGN_COLORS, formatWeekRange } from "@/lib/utils";
import type { Campaign, Week, Hook, CampaignMember } from "@/types";
import EditCampaignModal from "./EditCampaignModal";
import CampaignLogo from "./CampaignLogo";

const USER_COLORS: Record<string, string> = {
  blue: "bg-blue-500", violet: "bg-violet-500", emerald: "bg-emerald-500",
  orange: "bg-orange-500", pink: "bg-pink-500", teal: "bg-teal-500",
  yellow: "bg-yellow-500", red: "bg-red-500", slate: "bg-slate-500",
};

interface CampaignFull extends Campaign {
  weeks: (Week & { hooks: Hook[] })[];
  members?: CampaignMember[];
}

export default function CampaignsContent() {
  const [campaigns, setCampaigns] = useState<CampaignFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CampaignFull | null>(null);

  function fetchCampaigns() {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data) => { setCampaigns(data); setLoading(false); });
  }

  useEffect(() => { fetchCampaigns(); }, []);

  if (loading) {
    return <div className="p-8 animate-pulse space-y-4">
      {[1, 2].map(i => <div key={i} className="h-48 bg-slate-200 rounded-2xl" />)}
    </div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-slate-500 text-sm mt-1">{campaigns.length} active campaign{campaigns.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/campaigns/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      <div className="space-y-6">
        {campaigns.map((campaign) => {
          const colors = CAMPAIGN_COLORS[campaign.color] || CAMPAIGN_COLORS.blue;
          return (
            <div key={campaign.id} className="card overflow-hidden">
              {/* Header */}
              <div className={cn("px-6 py-4 border-b border-slate-100 flex items-center justify-between", colors.bg)}>
                <div className="flex items-center gap-3">
                  <CampaignLogo logoUrl={campaign.logoUrl} emoji={campaign.emoji} name={campaign.name} size="md" />
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">{campaign.name}</h2>
                    <p className="text-slate-500 text-sm">{campaign.clientName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Team avatars */}
                  {campaign.members && campaign.members.length > 0 && (
                    <div className="flex items-center gap-1">
                      {campaign.members.slice(0, 5).map(m => (
                        <div
                          key={m.id}
                          className={cn("w-7 h-7 rounded-full flex items-center justify-center border-2 border-white -ml-1 first:ml-0", USER_COLORS[m.user.color] || "bg-slate-500")}
                          title={`${m.user.name} (${m.role})`}
                        >
                          {m.role === "owner" && (
                            <span className="text-[9px] font-bold text-white">{m.user.name.charAt(0)}</span>
                          )}
                          {m.role === "supporter" && (
                            <span className="text-[9px] font-bold text-white opacity-80">{m.user.name.charAt(0)}</span>
                          )}
                        </div>
                      ))}
                      {campaign.members.length > 5 && (
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center border-2 border-white -ml-1">
                          <span className="text-[9px] font-bold text-slate-600">+{campaign.members.length - 5}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <span className={cn("badge", colors.badge)}>
                    Target: {campaign.hooksTarget} hooks/week
                  </span>
                  <Link
                    href={`/campaigns/${campaign.id}/validated`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    Validated
                  </Link>
                  <button
                    onClick={() => setEditing(campaign)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Edit
                  </button>
                </div>
              </div>

              {/* Description */}
              {campaign.description && (
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
                  <p className="text-sm text-slate-600">{campaign.description}</p>
                </div>
              )}

              {/* Weeks */}
              <div className="divide-y divide-slate-100">
                {campaign.weeks.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-slate-400 text-sm mb-3">No weeks yet for this campaign</p>
                    <button
                      className="btn-secondary text-xs"
                      onClick={async () => {
                        const monday = new Date();
                        monday.setDate(monday.getDate() - monday.getDay() + 1);
                        await fetch("/api/weeks", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ campaignId: campaign.id, weekStart: monday.toISOString() }),
                        });
                        window.location.reload();
                      }}
                    >
                      + Start current week
                    </button>
                  </div>
                ) : (
                  campaign.weeks.map((week) => {
                    const hookCount = week.hooks?.length ?? 0;
                    const selectedCount = week.hooks?.filter((h) => h.isSelected).length ?? 0;
                    const statusColors: Record<string, string> = {
                      open: "bg-emerald-100 text-emerald-700",
                      reviewing: "bg-amber-100 text-amber-700",
                      finalized: "bg-slate-100 text-slate-600",
                    };

                    return (
                      <div key={week.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {formatWeekRange(new Date(week.weekStart))}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Deadline: {format(new Date(week.deadline), "EEE d MMM, h:mmaaa")}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-medium text-slate-700">{hookCount} hooks</div>
                            <div className="text-xs text-slate-400">{selectedCount} selected</div>
                          </div>
                          <span className={cn("badge", statusColors[week.status] ?? "bg-slate-100 text-slate-600")}>
                            {week.status}
                          </span>
                          <Link href={`/weeks/${week.id}`} className="btn-ghost flex items-center gap-1.5">
                            View
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <EditCampaignModal
          campaign={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { fetchCampaigns(); }}
        />
      )}
    </div>
  );
}
