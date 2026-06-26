"use client";

import { useRef, useState, useEffect } from "react";
import { X, Loader2, Plus, Trash2, Calendar, Settings, Upload, ImageOff, Users, Crown, Check } from "lucide-react";
import { format } from "date-fns";
import { cn, CAMPAIGN_COLORS } from "@/lib/utils";
import type { Campaign, Week, Hook, CampaignMember } from "@/types";
import CampaignLogo from "./CampaignLogo";

const COLORS = ["blue", "violet", "emerald", "orange", "pink", "teal", "yellow"] as const;
const EMOJIS = ["🎯", "⚡", "💪", "✨", "🚀", "💡", "🔥", "🌟", "🎬", "📱", "💰", "🏆"];

const USER_COLORS: Record<string, string> = {
  blue: "bg-blue-500", violet: "bg-violet-500", emerald: "bg-emerald-500",
  orange: "bg-orange-500", pink: "bg-pink-500", teal: "bg-teal-500",
  yellow: "bg-yellow-500", red: "bg-red-500", slate: "bg-slate-500",
};

interface TeamUser { id: string; name: string; color: string; }

interface EditCampaignModalProps {
  campaign: Campaign & { weeks: (Week & { hooks: Hook[] })[]; members?: CampaignMember[] };
  onClose: () => void;
  onSaved: () => void;
}

export default function EditCampaignModal({ campaign, onClose, onSaved }: EditCampaignModalProps) {
  const [tab, setTab] = useState<"settings" | "weeks" | "team">("settings");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(campaign.logoUrl ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: campaign.name,
    clientName: campaign.clientName,
    description: campaign.description ?? "",
    color: campaign.color,
    emoji: campaign.emoji,
    hooksTarget: campaign.hooksTarget,
    validatedTarget: campaign.validatedTarget,
    hashtags: campaign.hashtags ?? "",
    contractEndDate: campaign.contractEndDate ? campaign.contractEndDate.slice(0, 10) : "",
  });

  // Team state
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(
    campaign.members?.find(m => m.role === "owner")?.userId ?? null
  );
  const [supporterIds, setSupporterIds] = useState<string[]>(
    campaign.members?.filter(m => m.role === "supporter").map(m => m.userId) ?? []
  );
  const [teamSaving, setTeamSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/users").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setTeamUsers(data.filter((u: TeamUser & { active: boolean }) => u.active));
    });
  }, []);

  async function saveTeam() {
    setTeamSaving(true);
    await fetch(`/api/campaigns/${campaign.id}/members`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId, supporterIds }),
    });
    setTeamSaving(false);
    onSaved();
  }

  // Week management state
  const [weeks, setWeeks] = useState(campaign.weeks);
  const [newWeekDate, setNewWeekDate] = useState("");
  const [addingWeek, setAddingWeek] = useState(false);
  const [weekSaving, setWeekSaving] = useState<string | null>(null);

  function setField(field: string, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          clientName: form.clientName,
          description: form.description || null,
          color: form.color,
          emoji: form.emoji,
          hooksTarget: form.hooksTarget,
          validatedTarget: form.validatedTarget,
          hashtags: form.hashtags || null,
          contractEndDate: form.contractEndDate ? new Date(form.contractEndDate).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSaved();
      onClose();
    } catch {
      setError("Failed to save campaign.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/campaigns/${campaign.id}/logo`, { method: "POST", body: fd });
    const data = await res.json();
    if (data.logoUrl) { setLogoUrl(data.logoUrl); onSaved(); }
    setLogoUploading(false);
  }

  async function removeLogo() {
    await fetch(`/api/campaigns/${campaign.id}/logo`, { method: "DELETE" });
    setLogoUrl(null);
    onSaved();
  }

  async function addWeek() {
    if (!newWeekDate) return;
    setAddingWeek(true);
    try {
      const res = await fetch("/api/weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id, weekStart: newWeekDate }),
      });
      if (!res.ok) throw new Error("Failed to add week");
      const week = await res.json();
      setWeeks((w) => [week, ...w]);
      setNewWeekDate("");
      onSaved();
    } catch {
      setError("Failed to add week.");
    } finally {
      setAddingWeek(false);
    }
  }

  async function updateWeekDeadline(weekId: string, deadline: string) {
    setWeekSaving(weekId);
    try {
      await fetch(`/api/weeks/${weekId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadline: new Date(deadline).toISOString() }),
      });
      setWeeks((ws) => ws.map((w) => w.id === weekId ? { ...w, deadline } : w));
      onSaved();
    } finally {
      setWeekSaving(null);
    }
  }

  async function updateWeekStart(weekId: string, weekStart: string) {
    setWeekSaving(weekId);
    try {
      await fetch(`/api/weeks/${weekId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: new Date(weekStart).toISOString() }),
      });
      setWeeks((ws) => ws.map((w) => w.id === weekId ? { ...w, weekStart } : w));
      onSaved();
    } finally {
      setWeekSaving(null);
    }
  }

  async function deleteWeek(weekId: string) {
    const week = weeks.find((w) => w.id === weekId);
    const hookCount = week?.hooks?.length ?? 0;
    if (!confirm(hookCount > 0
      ? `This week has ${hookCount} hooks. Delete it and all its hooks?`
      : "Delete this week?"
    )) return;

    setWeekSaving(weekId);
    try {
      await fetch(`/api/weeks/${weekId}`, { method: "DELETE" });
      setWeeks((ws) => ws.filter((w) => w.id !== weekId));
      onSaved();
    } finally {
      setWeekSaving(null);
    }
  }

  const previewColors = CAMPAIGN_COLORS[form.color] || CAMPAIGN_COLORS.blue;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-xl">{form.emoji}</span>
            <div>
              <h2 className="font-bold text-slate-900 text-base">{form.name}</h2>
              <p className="text-xs text-slate-400">{form.clientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {[
            { id: "settings", label: "Campaign settings", icon: Settings },
            { id: "weeks", label: `Weeks (${weeks.length})`, icon: Calendar },
            { id: "team", label: "Team", icon: Users },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id as "settings" | "weeks")}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2",
                tab === id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "settings" ? (
            <div className="space-y-5">
              {/* Preview + Logo upload */}
              <div className={cn("p-4 rounded-xl border flex items-center gap-3", previewColors.bg, previewColors.border)}>
                <CampaignLogo logoUrl={logoUrl} emoji={form.emoji} name={form.name} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className={cn("font-bold text-base", previewColors.text)}>{form.name || "Campaign Name"}</div>
                  <div className="text-sm text-slate-500">{form.clientName || "Client Name"}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={logoUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-colors"
                  >
                    {logoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {logoUrl ? "Replace logo" : "Upload logo"}
                  </button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-colors"
                    >
                      <ImageOff className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Campaign name *</label>
                  <input className="input" value={form.name} onChange={(e) => setField("name", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Client name *</label>
                  <input className="input" value={form.clientName} onChange={(e) => setField("clientName", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Description</label>
                  <textarea className="textarea" rows={2} value={form.description} onChange={(e) => setField("description", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Hashtags</label>
                  <textarea className="textarea" rows={2} placeholder="#hashtag1 #hashtag2" value={form.hashtags} onChange={(e) => setField("hashtags", e.target.value)} />
                </div>
                <div>
                  <label className="label">New hooks / week</label>
                  <select className="input" value={form.hooksTarget} onChange={(e) => setField("hooksTarget", parseInt(e.target.value))}>
                    {[3, 5, 7, 10, 14].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Validated hooks / week</label>
                  <select className="input" value={form.validatedTarget} onChange={(e) => setField("validatedTarget", parseInt(e.target.value))}>
                    {[0, 3, 5, 7, 10].map((n) => <option key={n} value={n}>{n === 0 ? "0 (none)" : n}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Contract end date <span className="font-normal text-slate-400 normal-case">(auto-archives when reached)</span></label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      className="input flex-1"
                      value={form.contractEndDate}
                      onChange={e => setField("contractEndDate", e.target.value)}
                    />
                    {form.contractEndDate && (
                      <button type="button" onClick={() => setField("contractEndDate", "")} className="btn-secondary text-xs text-slate-400">
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="label">Emoji</label>
                  <select className="input" value={form.emoji} onChange={(e) => setField("emoji", e.target.value)}>
                    {EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setField("color", color)}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          `bg-${color}-500`,
                          form.color === color ? "border-slate-900 scale-110" : "border-transparent"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add new week */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-xs font-semibold text-blue-700 mb-3">Add a new week</p>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    className="input flex-1 text-sm"
                    value={newWeekDate}
                    onChange={(e) => setNewWeekDate(e.target.value)}
                  />
                  <button
                    onClick={addWeek}
                    disabled={!newWeekDate || addingWeek}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    {addingWeek ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add week
                  </button>
                </div>
              </div>

              {/* Existing weeks */}
              {weeks.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No weeks yet — add one above.</p>
              ) : (
                <div className="space-y-2">
                  {[...weeks].sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()).map((week) => {
                    const hookCount = week.hooks?.length ?? 0;
                    const statusColors: Record<string, string> = {
                      open: "bg-emerald-100 text-emerald-700",
                      reviewing: "bg-amber-100 text-amber-700",
                      finalized: "bg-slate-100 text-slate-600",
                    };
                    const isSaving = weekSaving === week.id;

                    return (
                      <div key={week.id} className="border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className={cn("badge text-xs", statusColors[week.status] ?? "bg-slate-100 text-slate-600")}>
                              {week.status}
                            </span>
                            <span className="text-xs text-slate-400">{hookCount} hooks</span>
                          </div>
                          <button
                            onClick={() => deleteWeek(week.id)}
                            disabled={isSaving}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-slate-500 mb-1 block">Week starts</label>
                            <input
                              type="date"
                              className="input text-xs"
                              defaultValue={week.weekStart.split("T")[0]}
                              onBlur={(e) => {
                                if (e.target.value && e.target.value !== week.weekStart.split("T")[0]) {
                                  updateWeekStart(week.id, e.target.value);
                                }
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-500 mb-1 block">Deadline</label>
                            <input
                              type="date"
                              className="input text-xs"
                              defaultValue={week.deadline.split("T")[0]}
                              onBlur={(e) => {
                                if (e.target.value && e.target.value !== week.deadline.split("T")[0]) {
                                  updateWeekDeadline(week.id, e.target.value);
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "team" && (
            <div className="space-y-6">
              {/* Owner */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-slate-800">Campaign owner</span>
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => setOwnerId(null)}
                    className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left",
                      !ownerId ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-slate-500">—</span>
                    </div>
                    <span className="text-sm text-slate-500">No owner assigned</span>
                  </button>
                  {teamUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => setOwnerId(u.id)}
                      className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left",
                        ownerId === u.id ? "border-amber-400 bg-amber-50" : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0", USER_COLORS[u.color] || "bg-slate-500")}>
                        <span className="text-xs font-bold text-white">{u.name.charAt(0)}</span>
                      </div>
                      <span className="text-sm font-medium text-slate-800 flex-1">{u.name}</span>
                      {ownerId === u.id && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Supporters */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-slate-800">Supporting team</span>
                  <span className="text-xs text-slate-400">(select all that apply)</span>
                </div>
                <div className="space-y-1">
                  {teamUsers.filter(u => u.id !== ownerId).map(u => {
                    const isSelected = supporterIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => setSupporterIds(prev =>
                          isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                        )}
                        className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left",
                          isSelected ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0", USER_COLORS[u.color] || "bg-slate-500")}>
                          <span className="text-xs font-bold text-white">{u.name.charAt(0)}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-800 flex-1">{u.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </button>
                    );
                  })}
                  {teamUsers.filter(u => u.id !== ownerId).length === 0 && (
                    <p className="text-sm text-slate-400 py-4 text-center">
                      {ownerId ? "No other team members to assign." : "No team members found."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {tab === "settings" && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 font-medium">
              Cancel
            </button>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        )}
        {tab === "weeks" && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            <p className="text-xs text-slate-400">Changes to weeks save automatically when you leave the field.</p>
          </div>
        )}
        {tab === "team" && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 font-medium">Cancel</button>
            <button
              onClick={saveTeam}
              disabled={teamSaving}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {teamSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {teamSaving ? "Saving..." : "Save team"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
