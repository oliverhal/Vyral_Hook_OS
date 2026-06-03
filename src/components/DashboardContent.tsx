"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { format, isPast, formatDistanceToNow } from "date-fns";
import { ArrowRight, Clock, Plus, TrendingUp, Users, Zap } from "lucide-react";
import { cn, CAMPAIGN_COLORS, formatWeekRange } from "@/lib/utils";
import ContributionBoard from "./ContributionBoard";
import CampaignLogo from "./CampaignLogo";
import UserAvatar from "./UserAvatar";
import type { Campaign, Week, Hook, CampaignMember } from "@/types";

interface CampaignWithCurrentWeek extends Campaign {
  weeks: (Week & { hooks: Hook[] })[];
  members?: CampaignMember[];
}

interface ContributionData {
  data: { submitterName: string; weekStart: string; count: number; selected: number }[];
  members: string[];
}

export default function DashboardContent() {
  const { data: session } = useSession();
  const [campaigns, setCampaigns] = useState<CampaignWithCurrentWeek[]>([]);
  const [contributions, setContributions] = useState<ContributionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/campaigns").then((r) => r.json()),
      fetch("/api/contributions").then((r) => r.json()),
    ]).then(([c, contrib]) => {
      setCampaigns(c);
      setContributions(contrib);
      setLoading(false);
    });
  }, []);

  const user = session?.user as { name?: string; color?: string } | undefined;

  const totalHooksThisWeek = campaigns.reduce((sum, c) => sum + (c.weeks[0]?.hooks?.length ?? 0), 0);
  const totalSelected = campaigns.reduce(
    (sum, c) => sum + (c.weeks[0]?.hooks?.filter((h) => h.isSelected).length ?? 0),
    0
  );
  const activeCampaigns = campaigns.filter((c) => c.active).length;

  if (loading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-slate-200 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Hey, {user?.name ?? "there"} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {format(new Date(), "EEEE, d MMMM yyyy")} — weekly hooks dashboard
          </p>
        </div>
        <Link href="/campaigns/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <Zap className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-slate-500">Active Campaigns</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{activeCampaigns}</div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-slate-500">Hooks This Week</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{totalHooksThisWeek}</div>
        </div>
      </div>

      {/* Current Week Campaigns */}
      <h2 className="text-lg font-bold text-slate-900 mb-4">This Week's Campaigns</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
        {campaigns.map((campaign) => {
          const currentWeek = campaign.weeks[0];
          const colors = CAMPAIGN_COLORS[campaign.color] || CAMPAIGN_COLORS.blue;
          const hookCount = currentWeek?.hooks?.length ?? 0;
          const selectedCount = currentWeek?.hooks?.filter((h) => h.isSelected).length ?? 0;
          const deadline = currentWeek ? new Date(currentWeek.deadline) : null;
          const deadlinePassed = deadline ? isPast(deadline) : false;
          const deadlineSoon = deadline && !deadlinePassed
            ? (deadline.getTime() - Date.now()) / (1000 * 60 * 60) < 24
            : false;

          const submitters = currentWeek
            ? Array.from(new Set(currentWeek.hooks.map((h) => (h as { submitterName?: string }).submitterName ?? "?")))
            : [];

          return (
            <div key={campaign.id} className={cn("card overflow-hidden group hover:shadow-md transition-shadow duration-200")}>
              {/* Color strip */}
              <div className={cn("h-1.5", `bg-${campaign.color}-500`)} />

              <div className="p-5">
                {/* Campaign header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <CampaignLogo logoUrl={campaign.logoUrl} emoji={campaign.emoji} name={campaign.name} size="sm" />
                      <h3 className="font-bold text-slate-900 text-base">{campaign.name}</h3>
                    </div>
                    <p className="text-slate-400 text-xs">{campaign.clientName}</p>
                  </div>
                  <span className={cn("badge text-xs", colors.badge)}>
                    {currentWeek?.status ?? "no week"}
                  </span>
                </div>

                {/* Week range */}
                {currentWeek && (
                  <p className="text-xs text-slate-500 mb-3 font-medium">
                    {formatWeekRange(new Date(currentWeek.weekStart))}
                  </p>
                )}

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>{hookCount} / {campaign.hooksTarget} hooks</span>
                    <span>{selectedCount} selected</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", `bg-${campaign.color}-500`)}
                      style={{ width: `${Math.min(100, (hookCount / campaign.hooksTarget) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Deadline */}
                {deadline && (
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs mb-3",
                    deadlinePassed ? "text-red-500" : deadlineSoon ? "text-amber-500" : "text-slate-400"
                  )}>
                    <Clock className="w-3 h-3" />
                    {deadlinePassed
                      ? "Deadline passed"
                      : `Due ${formatDistanceToNow(deadline, { addSuffix: true })}`}
                  </div>
                )}

                {/* Campaign team */}
                {campaign.members && campaign.members.length > 0 ? (
                  <div className="mb-4 space-y-1.5">
                    {(() => {
                      const owner = campaign.members!.find(m => m.role === "owner");
                      const supporters = campaign.members!.filter(m => m.role === "supporter");
                      return (
                        <>
                          {owner && (
                            <div className="flex items-center gap-2">
                              <UserAvatar name={owner.user.name} color={owner.user.color} avatarUrl={owner.user.avatarUrl} size="xs" />
                              <span className="text-xs text-slate-700 font-medium">{owner.user.name}</span>
                              <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">owner</span>
                            </div>
                          )}
                          {supporters.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <div className="flex -space-x-1">
                                {supporters.slice(0, 4).map(m => (
                                  <UserAvatar key={m.id} name={m.user.name} color={m.user.color} avatarUrl={m.user.avatarUrl} size="xs" />
                                ))}
                              </div>
                              <span className="text-xs text-slate-400">
                                {supporters.length === 1 ? supporters[0].user.name : `${supporters.length} supporting`}
                              </span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : submitters.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-4">
                    {submitters.map((name) => (
                      <div key={name} className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center" title={name}>
                        <span className="text-xs font-semibold text-slate-600">{name.charAt(0)}</span>
                      </div>
                    ))}
                    <span className="text-xs text-slate-400 ml-1">{submitters.length} contributor{submitters.length !== 1 ? "s" : ""}</span>
                  </div>
                )}

                {/* CTA */}
                {currentWeek ? (
                  <Link
                    href={`/weeks/${currentWeek.id}`}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 transition-colors group-hover:bg-blue-600"
                  >
                    {hookCount === 0 ? "Submit Hooks" : "View & Review"}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <button
                    className="w-full py-2 rounded-xl text-sm font-medium border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
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
                    + Start This Week
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add campaign card */}
        <Link
          href="/campaigns/new"
          className="card p-5 border-dashed border-2 border-slate-200 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors min-h-[200px] group"
        >
          <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-slate-300 group-hover:border-blue-400 flex items-center justify-center transition-colors">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">Add Campaign</span>
        </Link>
      </div>

      {/* Contribution Board */}
      {contributions && contributions.members.length > 0 && (
        <div className="bg-[#0d1117] rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-white font-bold text-base">Team Contributions</h2>
              <p className="text-white/40 text-xs mt-0.5">Hook submissions over the last 20 weeks</p>
            </div>
            <div className="text-xs text-white/30">
              {contributions.data.reduce((s, d) => s + d.count, 0)} total hooks submitted
            </div>
          </div>
          <ContributionBoard
            data={contributions.data}
            members={contributions.members}
            weeks={20}
          />
        </div>
      )}
    </div>
  );
}
