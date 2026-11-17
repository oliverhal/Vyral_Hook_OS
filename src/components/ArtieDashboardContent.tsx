"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, RefreshCw, Settings, AlertTriangle, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Row {
  id: string; name: string; ratePerVideo: number | null;
  handles: { instagram: string | null; tiktok: string | null; facebook: string | null };
  counted: number; perPlatform: Record<string, number>; discrepancy: boolean; needsReview: number;
  bonus: { pending: number; approved: number; rejected: number; indicativeAmount: number };
  trackingGaps: string[];
}
interface Overview {
  cycle: { key: string; startLabel: string; endLabel: string; prevKey: string; nextKey: string; isCurrent: boolean };
  creators: Row[];
  settings: {
    payrollSheetUrl: string | null; bonusThreshold: number; bonusAmount: number; currency: string;
    lastRosterSyncAt: string | null; lastVideoSyncAt: string | null; lastSyncError: string | null;
    unmappedRows: { line: number; reason: string; cells: string[] }[];
    unmatchedAccounts: { platform: string; username: string; videos: number }[];
  };
}

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

export default function ArtieDashboardContent({ initialCycle = "" }: { initialCycle?: string }) {
  const [cycleKey, setCycleKey] = useState<string>(initialCycle);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [form, setForm] = useState({ url: "", threshold: "100000", amount: "50", currency: "USD" });
  const [saving, setSaving] = useState(false);

  const notify = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); };

  const load = useCallback(async (key: string) => {
    const res = await fetch(`/api/artie/overview${key ? `?cycle=${key}` : ""}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) { setError(json?.error ?? `Failed to load (HTTP ${res.status})`); return; }
    setError(""); setData(json);
    setForm({ url: json.settings.payrollSheetUrl ?? "", threshold: String(json.settings.bonusThreshold), amount: String(json.settings.bonusAmount), currency: json.settings.currency });
    if (!json.settings.payrollSheetUrl) setShowSettings(true);
  }, []);

  useEffect(() => { load(cycleKey); }, [cycleKey, load]);

  async function syncNow() {
    setSyncing(true);
    const res = await fetch("/api/artie/cron", { method: "POST" });
    const json = await res.json().catch(() => null);
    setSyncing(false);
    if (!res.ok) return notify(json?.error ?? `Sync failed (HTTP ${res.status})`, false);
    const r = json.roster;
    notify(r?.error ? `Videos synced, but roster: ${r.error}` : `Synced — ${json.videos.matched} posts matched, ${r.created} new creators`, !r?.error);
    load(cycleKey);
  }

  async function saveSettings() {
    setSaving(true);
    const res = await fetch("/api/artie/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payrollSheetUrl: form.url, bonusThreshold: Number(form.threshold), bonusAmount: Number(form.amount), currency: form.currency.toUpperCase() }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) return notify(json?.error ?? "Couldn't save settings", false);
    notify("Settings saved — press Sync now to pull the roster");
    load(cycleKey);
  }

  if (error) return <div className="p-8"><div className="card p-6 text-sm text-red-600">{error}</div></div>;
  if (!data) return <div className="p-8 animate-pulse space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-200 rounded-2xl" />)}</div>;

  const { cycle, creators, settings } = data;
  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: settings.currency, maximumFractionDigits: 2 }).format(n);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {toast && (
        <div className={cn("fixed top-5 right-5 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white", toast.ok ? "bg-emerald-600" : "bg-red-600")}>{toast.msg}</div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Artie creators</h1>
          <p className="text-sm text-slate-500 mt-1">Posting progress and bonus review · bonuses are candidates until you approve them</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings((s) => !s)} className="btn-secondary flex items-center gap-2"><Settings className="w-4 h-4" /> Settings</button>
          <button onClick={syncNow} disabled={syncing} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sync now
          </button>
        </div>
      </div>

      {settings.lastSyncError && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {settings.lastSyncError}
        </div>
      )}

      {showSettings && (
        <div className="card p-5 mb-6 space-y-4">
          <div>
            <label className="label">Creator payroll sheet (Google Sheets link — must be “anyone with the link can view”)</label>
            <input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/…" />
            <p className="text-xs text-slate-400 mt-1">Needs a creator-name column plus Instagram / TikTok / Facebook columns; a “rate” column is optional. Add new creators in the sheet — they appear on the next sync.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Bonus threshold (views)</label><input className="input" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} /></div>
            <div><label className="label">Indicative bonus amount</label><input className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><label className="label">Currency</label><input className="input" maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
          </div>
          <p className="text-xs text-slate-400">Changing the amount only affects bonuses detected from now on; amounts creators have already seen are kept. Confirm these against Artie’s payment rules before a live cycle.</p>
          <button onClick={saveSettings} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Saving…" : "Save settings"}</button>

          <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
            Roster synced {ago(settings.lastRosterSyncAt)} · videos synced {ago(settings.lastVideoSyncAt)} (auto-syncs every 6 hours)
          </div>
          {settings.unmappedRows.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">{settings.unmappedRows.length} sheet row(s) couldn’t be used:</p>
              <ul className="text-xs text-slate-600 space-y-0.5 max-h-32 overflow-y-auto">
                {settings.unmappedRows.map((u) => <li key={u.line}>Row {u.line}: {u.reason} — <span className="text-slate-400">{u.cells.filter(Boolean).slice(0, 3).join(" · ")}</span></li>)}
              </ul>
            </div>
          )}
          {settings.unmatchedAccounts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">Tracked in viral.app but matching no creator on the sheet (top {settings.unmatchedAccounts.length}):</p>
              <p className="text-xs text-slate-500 max-h-24 overflow-y-auto">{settings.unmatchedAccounts.map((a) => `${a.platform}:${a.username} (${a.videos})`).join(" · ")}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setCycleKey(cycle.prevKey)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft className="w-4 h-4" /></button>
        <div className="text-sm"><strong className="text-slate-900">{cycle.startLabel} → {cycle.endLabel}</strong> {cycle.isCurrent && <span className="badge bg-emerald-100 text-emerald-700 ml-2">current cycle</span>}</div>
        <button onClick={() => setCycleKey(cycle.nextKey)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight className="w-4 h-4" /></button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left px-4 py-3">Creator</th>
              <th className="text-right px-4 py-3">Counted</th>
              <th className="text-right px-4 py-3">IG / TT / FB</th>
              <th className="text-left px-4 py-3">Check</th>
              <th className="text-right px-4 py-3">Bonuses</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {creators.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No creators yet — add the payroll sheet link in Settings, then press Sync now.</td></tr>
            )}
            {creators.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><Link href={`/artie/${c.id}?cycle=${cycle.key}`} className="font-semibold text-slate-900 hover:text-blue-600">{c.name}</Link></td>
                <td className="px-4 py-3 text-right font-bold">{c.counted}</td>
                <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{c.perPlatform.instagram ?? 0} / {c.perPlatform.tiktok ?? 0} / {c.perPlatform.facebook ?? 0}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.discrepancy && <span className="badge bg-amber-100 text-amber-800">counts differ</span>}
                    {c.needsReview > 0 && <span className="badge bg-orange-100 text-orange-800">{c.needsReview} to review</span>}
                    {c.trackingGaps.length > 0 && <span className="badge bg-slate-200 text-slate-600" title="A handle on the sheet has no videos in viral.app">not tracked: {c.trackingGaps.join(", ")}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  {c.bonus.pending + c.bonus.approved + c.bonus.rejected === 0 ? <span className="text-slate-300">—</span> : (
                    <div className="text-xs">
                      <span className="font-semibold text-slate-800">{money(c.bonus.indicativeAmount)}</span>
                      <div className="text-slate-400">{c.bonus.pending > 0 && <span className="text-amber-600">{c.bonus.pending} pending </span>}{c.bonus.approved > 0 && <span className="text-emerald-600"><Check className="inline w-3 h-3" />{c.bonus.approved} </span>}{c.bonus.rejected > 0 && <span>{c.bonus.rejected} rejected</span>}</div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-3">“Counted” = unique Instagram videos, plus any TikTok/Facebook-only posts you mark as counted. “Counts differ” is internal only — creators are never told they missed a cross-post.</p>
    </div>
  );
}
