"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, RefreshCw, Settings, AlertTriangle, Loader2, Search, Copy, Users, Film, Gift, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import ArtieCreatorRow from "./ArtieCreatorRow";
import type { ArtieRow } from "./artieTypes";

type Row = ArtieRow;
interface Overview {
  cycle: { key: string; startLabel: string; endLabel: string; prevKey: string; nextKey: string; isCurrent: boolean };
  creators: Row[];
  settings: {
    payrollSheetUrl: string | null; payrollClient: string; bonusThreshold: number; bonusAmount: number; currency: string;
    lastRosterSyncAt: string | null; lastVideoSyncAt: string | null; lastSyncError: string | null;
    unmappedRows: { line: number; reason: string; label: string }[];
    unmatchedAccounts: { platform: string; username: string }[];
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
  const [form, setForm] = useState({ url: "", client: "Artie", threshold: "100000", amount: "50", currency: "USD" });
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "differ" | "untracked">("all");
  const [sort, setSort] = useState<"name" | "counted" | "pending" | "attention">("name");
  const [links, setLinks] = useState<Record<string, string> | null>(null);

  const notify = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); };

  const load = useCallback(async (key: string) => {
    const res = await fetch(`/api/artie/overview${key ? `?cycle=${key}` : ""}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) { setError(json?.error ?? `Failed to load (HTTP ${res.status})`); return; }
    setError(""); setData(json);
    setForm({ url: json.settings.payrollSheetUrl ?? "", client: json.settings.payrollClient ?? "", threshold: String(json.settings.bonusThreshold), amount: String(json.settings.bonusAmount), currency: json.settings.currency });
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

  // Tokens are fetched on first use (not with every page load) and cached for the session.
  async function getLinks(): Promise<Record<string, string> | null> {
    if (links) return links;
    const res = await fetch("/api/artie/links", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) { notify(json?.error ?? "Couldn't load links", false); return null; }
    const map: Record<string, string> = {};
    for (const l of json.links as { id: string; token: string }[]) map[l.id] = `${window.location.origin}/progress/${l.token}`;
    setLinks(map);
    return map;
  }

  async function copyLink(row: Row) {
    const map = await getLinks();
    if (!map?.[row.id]) return;
    await navigator.clipboard.writeText(map[row.id]);
    notify(`Link for ${row.name} copied`);
  }

  async function copyAllLinks(rows: Row[]) {
    const map = await getLinks();
    if (!map) return;
    // Name<TAB>Link per line: pastes straight into a sheet, or can be split up for messaging.
    await navigator.clipboard.writeText(rows.filter((r) => map[r.id]).map((r) => `${r.name}\t${map[r.id]}`).join("\n"));
    notify(`${rows.length} link${rows.length === 1 ? "" : "s"} copied (name + link)`);
  }

  async function saveSettings() {
    setSaving(true);
    const res = await fetch("/api/artie/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payrollSheetUrl: form.url, payrollClient: form.client, bonusThreshold: Number(form.threshold), bonusAmount: Number(form.amount), currency: form.currency.toUpperCase() }),
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
  const q = query.trim().toLowerCase().replace(/^@/, "");
  const shown = !q ? creators : creators.filter((c) =>
    [c.name, c.handles.instagram, c.handles.tiktok, c.handles.facebook].some((v) => v && v.toLowerCase().includes(q))
  );
  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: settings.currency, maximumFractionDigits: 2 }).format(n);

  const attention = (c: Row) => (c.discrepancy ? 1 : 0) + (c.trackingGaps.length > 0 ? 1 : 0);
  const predicates: Record<typeof filter, (c: Row) => boolean> = {
    all: () => true, pending: (c) => c.bonus.pending > 0,
    differ: (c) => c.discrepancy, untracked: (c) => c.trackingGaps.length > 0,
  };
  const chipCount = (k: typeof filter) => shown.filter(predicates[k]).length;
  const sorters: Record<typeof sort, (a: Row, b: Row) => number> = {
    name: (a, b) => a.name.localeCompare(b.name), counted: (a, b) => b.counted - a.counted || a.name.localeCompare(b.name),
    pending: (a, b) => b.bonus.pending - a.bonus.pending || a.name.localeCompare(b.name), attention: (a, b) => attention(b) - attention(a) || a.name.localeCompare(b.name),
  };
  const visible = shown.filter(predicates[filter]).sort(sorters[sort]);
  const totals = {
    counted: creators.reduce((n, c) => n + c.counted, 0),
    pending: creators.reduce((n, c) => n + c.bonus.pending, 0),
    indicative: creators.reduce((n, c) => n + c.bonus.indicativeAmount, 0),
    attention: creators.filter((c) => attention(c) > 0).length,
  };

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
          <div>
            <label className="label">Programme to import (matches the sheet’s “Client Name” column)</label>
            <input className="input" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="Artie" />
            <p className="text-xs text-slate-400 mt-1">Only these rows are imported. Anyone marked Fired/Inactive is skipped. Leave blank to import every row.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Bonus threshold (views)</label><input className="input" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} /></div>
            <div><label className="label">Indicative bonus amount</label><input className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><label className="label">Currency</label><input className="input" maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
          </div>
          <p className="text-xs text-slate-400">Changing the amount only affects bonuses detected from now on; amounts creators have already seen are kept. Confirm these against Artie’s payment rules before a live cycle.</p>
          <button onClick={saveSettings} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Saving…" : "Save settings"}</button>

          <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
            Roster synced {ago(settings.lastRosterSyncAt)} · videos synced {ago(settings.lastVideoSyncAt)} (auto-syncs twice a day)
          </div>
          {settings.unmappedRows.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">{settings.unmappedRows.length} sheet row(s) couldn’t be used:</p>
              <ul className="text-xs text-slate-600 space-y-0.5 max-h-32 overflow-y-auto">
                {settings.unmappedRows.map((u) => <li key={u.line}>Row {u.line}: {u.reason} — <span className="text-slate-400">{u.label}</span></li>)}
              </ul>
            </div>
          )}
          {settings.unmatchedAccounts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">Tracked in ViralDeck but matching no creator on the sheet ({settings.unmatchedAccounts.length}):</p>
              <p className="text-xs text-slate-500 max-h-24 overflow-y-auto">{settings.unmatchedAccounts.map((a) => `${a.platform}:${a.username}`).join(" · ")}</p>
            </div>
          )}
        </div>
      )}

      {creators.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users, label: "Active creators", value: String(creators.length), sub: "on the payroll sheet", cls: "bg-blue-50 text-blue-600" },
            { icon: Film, label: "Videos counted", value: String(totals.counted), sub: "this cycle", cls: "bg-violet-50 text-violet-600" },
            { icon: Gift, label: "Bonuses to review", value: String(totals.pending), sub: `${money(totals.indicative)} indicative`, cls: "bg-amber-50 text-amber-600" },
            { icon: ShieldAlert, label: "Need attention", value: String(totals.attention), sub: "counts differ / not tracked", cls: "bg-orange-50 text-orange-600" },
          ].map(({ icon: Icon, label, value, sub, cls }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", cls)}><Icon className="w-5 h-5" /></div>
              <div className="min-w-0"><p className="text-2xl font-black text-slate-900 leading-none">{value}</p><p className="text-xs font-semibold text-slate-600 mt-1">{label}</p><p className="text-[11px] text-slate-400 truncate">{sub}</p></div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setCycleKey(cycle.prevKey)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft className="w-4 h-4" /></button>
        <div className="text-sm"><strong className="text-slate-900">{cycle.startLabel} → {cycle.endLabel}</strong> {cycle.isCurrent && <span className="badge bg-emerald-100 text-emerald-700 ml-2">current cycle</span>}</div>
        <button onClick={() => setCycleKey(cycle.nextKey)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight className="w-4 h-4" /></button>
        <div className="flex-1" />
        <div className="relative w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Search creators or @handles…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button onClick={() => copyAllLinks(visible)} disabled={visible.length === 0} className="btn-secondary flex items-center gap-2 disabled:opacity-50" title="Copies name + private link for each creator shown">
          <Copy className="w-4 h-4" /> Copy {visible.length === creators.length ? "all " : `${visible.length} `}links
        </button>
      </div>
      {creators.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {([["all", "All"], ["pending", "Bonuses pending"], ["differ", "Counts differ"], ["untracked", "Not tracked"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors", filter === k ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400")}>
                {label} <span className={cn("ml-1", filter === k ? "text-white/60" : "text-slate-400")}>{chipCount(k)}</span>
              </button>
            ))}
          </div>
          <label className="text-xs text-slate-500 flex items-center gap-2">Sort
            <select className="input py-1 w-auto text-xs" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="name">Name</option><option value="counted">Most videos</option><option value="pending">Pending bonuses</option><option value="attention">Needs attention</option>
            </select>
          </label>
        </div>
      )}
      {q && <p className="text-xs text-slate-400 -mt-2 mb-3">{visible.length} of {creators.length} creators match “{query.trim()}”</p>}

      <div className="space-y-2.5">
        {creators.length === 0 && (
          <div className="card px-4 py-12 text-center text-slate-400 text-sm">No creators yet — add the payroll sheet link in Settings, then press Sync now.</div>
        )}
        {creators.length > 0 && visible.length === 0 && (
          <div className="card px-4 py-12 text-center text-slate-400 text-sm">No creators match{q ? ` “${query.trim()}”` : " this filter"}.</div>
        )}
        {visible.map((c) => (
          <ArtieCreatorRow key={c.id} row={c} cycleKey={cycle.key} currency={settings.currency}
            expanded={expandedId === c.id} onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
            onChanged={() => load(cycleKey)} notify={notify} copyLink={copyLink} />
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-3">“Counted” = unique Instagram videos, plus any TikTok/Facebook-only posts you mark as counted. “Counts differ” is internal only — creators are never told they missed a cross-post.</p>
    </div>
  );
}
