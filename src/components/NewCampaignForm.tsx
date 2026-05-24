"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn, CAMPAIGN_COLORS } from "@/lib/utils";

const COLORS = ["blue", "violet", "emerald", "orange", "pink", "teal", "yellow"] as const;
const EMOJIS = ["🎯", "⚡", "💪", "✨", "🚀", "💡", "🔥", "🌟", "🎬", "📱", "💰", "🏆"];

export default function NewCampaignForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    clientName: "",
    description: "",
    color: "blue",
    emoji: "🎯",
    hooksTarget: 7,
    validatedTarget: 7,
    firstWeekStart: "",
  });

  function setField(field: string, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.clientName) {
      setError("Campaign name and client name are required.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setError("Failed to create campaign.");
      setLoading(false);
      return;
    }
    router.push("/campaigns");
  }

  const previewColors = CAMPAIGN_COLORS[form.color] || CAMPAIGN_COLORS.blue;

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">New Campaign</h1>
        <p className="text-slate-500 text-sm mt-1">Set up a new client campaign for weekly hook distribution.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {/* Preview */}
        <div className={cn("p-4 rounded-xl border flex items-center gap-3", previewColors.bg, previewColors.border)}>
          <span className="text-3xl">{form.emoji}</span>
          <div>
            <div className={cn("font-bold text-base", previewColors.text)}>
              {form.name || "Campaign Name"}
            </div>
            <div className="text-sm text-slate-500">{form.clientName || "Client Name"}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Campaign name *</label>
            <input
              className="input"
              placeholder='e.g. "TechPro Max Q2"'
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              required
            />
          </div>
          <div className="col-span-2">
            <label className="label">Client name *</label>
            <input
              className="input"
              placeholder='e.g. "TechPro Inc."'
              value={form.clientName}
              onChange={(e) => setField("clientName", e.target.value)}
              required
            />
          </div>
          <div className="col-span-2">
            <label className="label">Description</label>
            <textarea
              className="textarea"
              rows={2}
              placeholder="What's this campaign about?"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>

          <div>
            <label className="label">New experimental hooks / week</label>
            <select className="input" value={form.hooksTarget} onChange={(e) => setField("hooksTarget", parseInt(e.target.value))}>
              <option value={7}>7</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={14}>14</option>
            </select>
          </div>

          <div>
            <label className="label">Validated hooks / week</label>
            <select className="input" value={form.validatedTarget} onChange={(e) => setField("validatedTarget", parseInt(e.target.value))}>
              <option value={7}>7</option>
              <option value={0}>0 (none)</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="label">First week starts</label>
            <input
              className="input"
              type="date"
              value={form.firstWeekStart}
              onChange={(e) => setField("firstWeekStart", e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Sets the first open week so the team can start submitting hooks straight away. Leave blank to add weeks manually later.
            </p>
          </div>

          <div className="col-span-2">
            <label className="label">Emoji</label>
            <select className="input" value={form.emoji} onChange={(e) => setField("emoji", e.target.value)}>
              {EMOJIS.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="label">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((color) => {
                const c = CAMPAIGN_COLORS[color];
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setField("color", color)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      `bg-${color}-500`,
                      form.color === color ? "border-slate-900 scale-110" : "border-transparent"
                    )}
                    title={color}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl border border-red-100">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Creating..." : "Create Campaign"}
          </button>
        </div>
      </form>
    </div>
  );
}
