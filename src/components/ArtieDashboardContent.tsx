"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, RefreshCw, Settings, AlertTriangle, Loader2, Search, Copy, Megaphone, Users, Film, Gift, Wallet, BadgeCheck, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import ArtieCreatorRow from "./ArtieCreatorRow";
import ArtieHowItWorks from "./ArtieHowItWorks";
import ArtieGoalTracker from "./ArtieGoalTracker";
import { goalFor } from "@/lib/artie/goal";
import { nudgeMessage } from "@/lib/artie/nudge";
import type { ArtieRow } from "./artieTypes";

type Row = ArtieRow;
interface Overview {
  programme?: { id: string; label: string };
  bonusEnabled?: boolean;
  targetCreators?: number | null;
  monthlyCostPerCreator?: number | null;
  cycle: { key: string; start: string; end: string; startLabel: string; endLabel: string; prevKey: string; nextKey: string; isCurrent: boolean };
  bonusSummary: { givenCount: number; givenAmount: number; pendingCount: number; pendingAmount: number; pendingLinkChecks: number; pendingPlainAmount: number; rejectedCount: number };
  creators: Row[];
  settings: {
    payrollSheetUrl: string | null; payrollClient: string; countMode: string; videosPerDay: number; showPaceToCreators: boolean; showRankToCreators: boolean; bonusThreshold: number; bonusAmount: number; currency: string;
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

export default function ArtieDashboardContent({ initialCycle = "", programme = "artie" }: { initialCycle?: string; programme?: "artie" | "ecosia" }) {
  const api = `/api/${programme}`;
  const [cycleKey, setCycleKey] = useState<string>(initialCycle);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncLabel, setSyncLabel] = useState("");
  const [approvingAll, setApprovingAll] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [form, setForm] = useState({ url: "", client: "Artie", countMode: "unique", perDay: "2", showPace: true, showRank: true, threshold: "100000", amount: "50", currency: "USD", bonusEnabled: true, cost: "", target: "" });
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "linked" | "behind" | "differ" | "untracked">("all");
  const [sort, setSort] = useState<"name" | "counted" | "pending" | "pace" | "attention">("name");
  const [links, setLinks] = useState<Record<string, string> | null>(null);

  const notify = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); };

  const load = useCallback(async (key: string) => {
    const res = await fetch(`${api}/overview${key ? `?cycle=${key}` : ""}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) { setError(json?.error ?? `Failed to load (HTTP ${res.status})`); return; }
    setError(""); setData(json);
    setForm({ url: json.settings.payrollSheetUrl ?? "", client: json.settings.payrollClient ?? "", countMode: json.settings.countMode ?? "unique", perDay: String(json.settings.videosPerDay ?? 2), showPace: json.settings.showPaceToCreators !== false, showRank: json.settings.showRankToCreators !== false, threshold: String(json.settings.bonusThreshold), amount: String(json.settings.bonusAmount), currency: json.settings.currency, bonusEnabled: json.bonusEnabled !== false, cost: json.monthlyCostPerCreator != null ? String(json.monthlyCostPerCreator) : "", target: json.targetCreators != null ? String(json.targetCreators) : "" });
    if (!json.settings.payrollSheetUrl) setShowSettings(true);
  }, [api]);

  useEffect(() => { load(cycleKey); }, [cycleKey, load]);

  async function syncNow() {
    setSyncing(true);
    // A full pass over every account takes longer than one server run allows, so each run refreshes the
    // stalest accounts first and reports how many it had to leave; keep going (up to 3 runs) until none are left.
    let json: any = null;
    for (let pass = 1; pass <= 3; pass++) {
      setSyncLabel(pass === 1 ? "Syncing…" : `Syncing… (pass ${pass} of up to 3)`);
      const res = await fetch(`${api}/cron`, { method: "POST" });
      json = await res.json().catch(() => null);
      if (!res.ok) { setSyncing(false); setSyncLabel(""); return notify(json?.error ?? `Sync failed (HTTP ${res.status})`, false); }
      if (!(json.videos?.skippedAccounts > 0)) break;
    }
    setSyncing(false); setSyncLabel("");
    const r = json.roster;
    const left = json.videos?.skippedAccounts ?? 0;
    notify(r?.error ? `Videos synced, but roster: ${r.error}` : left > 0 ? `Synced — ${left} account(s) left for the next run` : `Synced — ${json.videos.matched} posts, ${r.created} new creators`, !r?.error);
    load(cycleKey);
  }

  // Tokens are fetched on first use (not with every page load) and cached for the session.
  async function getLinks(): Promise<Record<string, string> | null> {
    if (links) return links;
    const res = await fetch(`${api}/links`, { cache: "no-store" });
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

  // A ready-to-send message for a creator who's behind, built from the same wording as their own link.
  function nudgeFor(row: Row, map: Record<string, string>): string | null {
    if (!data || !map[row.id]) return null;
    return nudgeMessage({
      firstName: row.name.split(" ")[0], link: map[row.id], pace: row.pace, rate: row.ratePerVideo, currency: data.settings.currency,
      bonusAmount: data.settings.bonusAmount, threshold: data.settings.bonusThreshold, bonusEnabled: data.bonusEnabled !== false, cycleEndLabel: data.cycle.endLabel, best: null,
    });
  }

  async function copyNudge(row: Row) {
    const map = await getLinks();
    const msg = map ? nudgeFor(row, map) : null;
    if (!msg) return notify(`${row.name} isn't behind pace — nothing to nudge`, false);
    await navigator.clipboard.writeText(msg);
    notify(`Nudge for ${row.name} copied — paste it into Slack/WhatsApp/email`);
  }

  async function copyAllNudges(rows: Row[]) {
    const map = await getLinks();
    if (!map) return;
    const blocks = rows.map((r) => { const m = nudgeFor(r, map); return m ? `=== ${r.name} ===\n${m}` : null; }).filter(Boolean);
    if (blocks.length === 0) return notify("Nobody here is behind pace", false);
    await navigator.clipboard.writeText(blocks.join("\n\n"));
    notify(`${blocks.length} nudge${blocks.length === 1 ? "" : "s"} copied — one block per creator`);
  }

  async function copyAllLinks(rows: Row[]) {
    const map = await getLinks();
    if (!map) return;
    // Name<TAB>Link per line: pastes straight into a sheet, or can be split up for messaging.
    await navigator.clipboard.writeText(rows.filter((r) => map[r.id]).map((r) => `${r.name}\t${map[r.id]}`).join("\n"));
    notify(`${rows.length} link${rows.length === 1 ? "" : "s"} copied (name + link)`);
  }

  async function approveAllPlain() {
    if (!data) return;
    const n = data.bonusSummary.pendingCount - data.bonusSummary.pendingLinkChecks;
    if (!confirm(`Approve ${n} bonus${n === 1 ? "" : "es"} that simply hit the view threshold? Any with a possible linked Instagram + Facebook account are left for you to check.`)) return;
    setApprovingAll(true);
    const res = await fetch(`${api}/candidates/bulk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cycle: data.cycle.key }) });
    const json = await res.json().catch(() => null);
    setApprovingAll(false);
    if (!res.ok) return notify(json?.error ?? "Couldn't approve", false);
    notify(`${json.approved} bonus${json.approved === 1 ? "" : "es"} approved`);
    load(cycleKey);
  }

  async function saveSettings() {
    setSaving(true);
    const res = await fetch(`${api}/settings`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payrollSheetUrl: form.url, payrollClient: form.client, countMode: form.countMode, videosPerDay: Number(form.perDay), showPaceToCreators: form.showPace, showRankToCreators: form.showRank, bonusEnabled: form.bonusEnabled, bonusThreshold: Number(form.threshold), bonusAmount: Number(form.amount), targetCreators: form.target.trim() === "" ? null : Number(form.target), monthlyCostPerCreator: form.cost.trim() === "" ? null : Number(form.cost), currency: form.currency.toUpperCase() }),
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
  const bonusOn = data.bonusEnabled !== false;
  const label = data.programme?.label ?? "Artie";
  const bonus = data.bonusSummary;
  const plainPending = bonus.pendingCount - bonus.pendingLinkChecks;
  const q = query.trim().toLowerCase().replace(/^@/, "");
  const shown = !q ? creators : creators.filter((c) =>
    [c.name, c.handles.instagram, c.handles.tiktok, c.handles.facebook].some((v) => v && v.toLowerCase().includes(q))
  );
  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: settings.currency, maximumFractionDigits: 2 }).format(n);

  const attention = (c: Row) => (c.discrepancy ? 1 : 0) + (c.trackingGaps.length > 0 ? 1 : 0);
  const predicates: Record<typeof filter, (c: Row) => boolean> = {
    all: () => true, behind: (c) => c.pace.status === "behind", linked: (c) => c.bonus.pendingChecks > 0, pending: (c) => c.bonus.pending > 0,
    differ: (c) => c.discrepancy, untracked: (c) => c.trackingGaps.length > 0,
  };
  const chipCount = (k: typeof filter) => shown.filter(predicates[k]).length;
  const sorters: Record<typeof sort, (a: Row, b: Row) => number> = {
    name: (a, b) => a.name.localeCompare(b.name), counted: (a, b) => b.counted - a.counted || a.name.localeCompare(b.name),
    pending: (a, b) => b.bonus.pending - a.bonus.pending || a.name.localeCompare(b.name),
    pace: (a, b) => (a.pace.status === "not_started" ? 1 : a.pace.delta) - (b.pace.status === "not_started" ? 1 : b.pace.delta) || a.name.localeCompare(b.name), attention: (a, b) => attention(b) - attention(a) || a.name.localeCompare(b.name),
  };
  const visible = shown.filter(predicates[filter]).sort(sorters[sort]);
  const costRows = creators.filter((c) => c.estTotal != null);
  const totals = {
    cost: costRows.reduce((n, c) => n + (c.estTotal as number), 0),
    spent: creators.reduce((n, c) => n + (c.estBase ?? 0), 0),
    noRate: creators.filter((c) => c.ratePerVideo == null).length,
    leaving: creators.filter((c) => c.leavingAfter).length,
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
          <h1 className="text-2xl font-bold text-slate-900">{label} creators</h1>
          <p className="text-sm text-slate-500 mt-1">{bonusOn ? "Posting progress and bonus review · bonuses are candidates until you approve them" : "Posting progress and creator spend"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings((s) => !s)} className="btn-secondary flex items-center gap-2"><Settings className="w-4 h-4" /> Settings</button>
          <button onClick={syncNow} disabled={syncing} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} {syncing ? syncLabel || "Syncing…" : "Sync now"}
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
            <input className="input" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder={label} />
            <p className="text-xs text-slate-400 mt-1">Only these rows are imported. Anyone marked Fired/Inactive is skipped. Leave blank to import every row.</p>
          </div>
          <div>
            <label className="label">How videos are counted</label>
            <select className="input" value={form.countMode} onChange={(e) => setForm({ ...form, countMode: e.target.value })}>
              <option value="unique">Unique videos across all platforms (a video on Instagram + TikTok counts once)</option>
              <option value="instagram">Instagram only (TikTok / Facebook-only videos don’t count)</option>
            </select>
          </div>
          <div className="max-w-xs">
            <label className="label">Videos each creator should post per day</label>
            <input className="input" value={form.perDay} onChange={(e) => setForm({ ...form, perDay: e.target.value })} />
            <p className="text-xs text-slate-400 mt-1">Used for “ahead / behind pace”, counted from the later of the cycle start and their first post (not their onboarding date). Creators with no posts yet aren’t measured.</p>
            <label className="flex items-start gap-2 mt-3 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-blue-600" checked={form.showPace} onChange={(e) => setForm({ ...form, showPace: e.target.checked })} />
              <span>Tell creators on their link when they’re <strong>behind schedule</strong> (and when they’re on track or ahead). Untick to hide pace from creators while you check the numbers — it stays visible here.</span>
            </label>
            <label className="flex items-start gap-2 mt-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-blue-600" checked={form.showRank} onChange={(e) => setForm({ ...form, showRank: e.target.checked })} />
              <span>Show a <strong>“top 10% / 25% / half of creators”</strong> badge on creators’ links — only to creators in the top half, ranked by views per day since they started (needs 10+ creators with 7+ days of activity). Nobody sees anyone else’s numbers.</span>
            </label>
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" className="mt-0.5 accent-blue-600" checked={form.bonusEnabled} onChange={(e) => setForm({ ...form, bonusEnabled: e.target.checked })} />
            <span>This programme pays <strong>view bonuses</strong>. Untick if it doesn’t — bonus detection, review and bonus figures are switched off.</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Target number of creators (what the client asked for)</label><input className="input" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="e.g. 50" /></div>
            <div><label className="label">Monthly creator budget per creator</label><input className="input" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="e.g. 500" /></div>
            <div><label className="label">Currency</label><input className="input" maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
          </div>
          {form.bonusEnabled && <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Bonus threshold (views)</label><input className="input" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} /></div>
            <div><label className="label">Indicative bonus amount</label><input className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          </div>}
          {form.bonusEnabled && <p className="text-xs text-slate-400">Changing the amount only affects bonuses detected from now on; amounts creators have already seen are kept. Confirm these against the client’s payment rules before a live cycle.</p>}
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

      <ArtieHowItWorks threshold={settings.bonusThreshold} currency={settings.currency} bonusAmount={settings.bonusAmount} bonusEnabled={bonusOn} storageKey={`${programme}-guide`} />

      {creators.length > 0 && (() => {
        const goal = goalFor({ cycle: { key: data.cycle.key, start: new Date(data.cycle.start), end: new Date(data.cycle.end), startLabel: data.cycle.startLabel, endLabel: data.cycle.endLabel }, now: new Date(),
          actualVideos: totals.counted, actualSpend: totals.cost, perDay: settings.videosPerDay, costPerCreator: data.monthlyCostPerCreator ?? null,
          targetCreators: data.targetCreators ?? creators.length });
        return <ArtieGoalTracker goal={goal} onRoster={creators.length} postingNow={creators.filter((c) => c.counted > 0).length} currency={settings.currency} isCurrent={data.cycle.isCurrent} costPerCreator={data.monthlyCostPerCreator ?? null} bonusEnabled={data.bonusEnabled !== false} />;
      })()}

      {creators.length > 0 && (
        <div className={cn("grid grid-cols-2 gap-3 mb-4", bonusOn ? "lg:grid-cols-5" : "lg:grid-cols-3")}>
          {[
            { icon: Users, label: "Active creators", value: String(creators.length), sub: totals.leaving ? `${totals.leaving} leaving after this cycle` : "on the payroll sheet", cls: "bg-blue-50 text-blue-600" },
            { icon: Film, label: "Unique videos", value: String(totals.counted), sub: "counted this cycle", cls: "bg-violet-50 text-violet-600" },
            { icon: Wallet, label: "Spent on creators", value: money(totals.spent), sub: `unique videos × rate · ${money(totals.cost)} with bonuses${totals.noRate ? ` · ${totals.noRate} have no rate` : ""}`, cls: "bg-emerald-50 text-emerald-600" },
            { icon: BadgeCheck, label: "Bonuses given", value: money(bonus.givenAmount), sub: `${bonus.givenCount} approved${bonus.rejectedCount ? ` · ${bonus.rejectedCount} rejected` : ""} this cycle`, cls: "bg-teal-50 text-teal-600" },
            { icon: Gift, label: "Bonuses to review", value: String(bonus.pendingCount), sub: bonus.pendingCount ? `${money(bonus.pendingAmount)}${bonus.pendingLinkChecks ? ` · ${bonus.pendingLinkChecks} need a link check` : ""}` : "all clear", cls: "bg-amber-50 text-amber-600" },
          ].filter((c) => bonusOn || (c.label !== "Bonuses given" && c.label !== "Bonuses to review")).map(({ icon: Icon, label: cardLabel, value, sub, cls }) => (
            <div key={cardLabel} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", cls)}><Icon className="w-5 h-5" /></div>
              <div className="min-w-0"><p className="text-xl font-black text-slate-900 leading-none truncate">{value}</p><p className="text-xs font-semibold text-slate-600 mt-1">{cardLabel}</p><p className="text-[11px] text-slate-400 truncate" title={sub}>{sub}</p></div>
            </div>
          ))}
        </div>
      )}

      {bonusOn && plainPending > 0 && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3">
          <p className="text-sm text-emerald-900">
            <strong>{plainPending} bonus{plainPending === 1 ? "" : "es"} hit {Math.round(settings.bonusThreshold / 1000)}K views</strong> and qualify — nothing else to check.
            {bonus.pendingLinkChecks > 0 && <> {bonus.pendingLinkChecks} more {bonus.pendingLinkChecks === 1 ? "has" : "have"} the same video on Instagram and Facebook and need a look first.</>}
          </p>
          <button onClick={approveAllPlain} disabled={approvingAll} className="btn-primary flex-shrink-0 flex items-center gap-2 disabled:opacity-50">
            {approvingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve {plainPending} · {money(bonus.pendingPlainAmount)}
          </button>
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
        {creators.some((c) => c.pace.status === "behind") && (
          <button onClick={() => copyAllNudges(visible.filter((c) => c.pace.status === "behind"))} disabled={!visible.some((c) => c.pace.status === "behind")}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50 text-rose-700" title="One ready-to-send message per creator who's behind pace, with their numbers and link">
            <Megaphone className="w-4 h-4" /> Copy {visible.filter((c) => c.pace.status === "behind").length} nudges
          </button>
        )}
        <button onClick={() => copyAllLinks(visible)} disabled={visible.length === 0} className="btn-secondary flex items-center gap-2 disabled:opacity-50" title="Copies name + private link for each creator shown">
          <Copy className="w-4 h-4" /> Copy {visible.length === creators.length ? "all " : `${visible.length} `}links
        </button>
      </div>
      {creators.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {([["all", "All"], ["pending", "Bonuses pending"], ["linked", "Linked IG+FB check"], ["behind", "Behind pace"], ["differ", "Counts differ"], ["untracked", "Not tracked"]] as const).filter(([k]) => bonusOn || (k !== "pending" && k !== "linked")).map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors", filter === k ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400")}>
                {label} <span className={cn("ml-1", filter === k ? "text-white/60" : "text-slate-400")}>{chipCount(k)}</span>
              </button>
            ))}
          </div>
          <label className="text-xs text-slate-500 flex items-center gap-2">Sort
            <select className="input py-1 w-auto text-xs" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="name">Name</option><option value="counted">Most videos</option>{bonusOn && <option value="pending">Pending bonuses</option>}<option value="pace">Most behind pace</option><option value="attention">Needs attention</option>
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
            onChanged={() => load(cycleKey)} notify={notify} copyLink={copyLink} copyNudge={copyNudge} programme={programme} bonusEnabled={bonusOn} />
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-3">“Counted” = unique videos: one video posted to several platforms counts once (matched by publish time and caption), and a video that only exists on one platform still counts. “Counts differ” is internal only — creators are never told they missed a cross-post.</p>
    </div>
  );
}
