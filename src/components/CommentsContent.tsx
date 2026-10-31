"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MessageCircle, ExternalLink, RefreshCw, Loader2, Settings2, Bot, Facebook, Youtube, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  source: string;
  name: string;
  enabled: boolean;
  replyBrief: string | null;
  minViews: number;
  lookbackDays: number;
  lastSyncedAt: string | null;
  _count: { videos: number };
}

type Tab = "autoreply" | "settings";

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  facebook: "Facebook",
};

function compact(n: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export default function CommentsContent() {
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "settings" ? "settings" : "autoreply"
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/comments/projects");
    if (res.ok) setProjects(await res.json());
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function runSync(step: "videos" | "comments") {
    setSyncing(step);
    setSyncMessage(null);
    const res = await fetch(`/api/comments/cron?step=${step}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setSyncMessage(data.error ?? "Sync failed");
    else if (step === "videos") {
      const failed = data.projects.filter((p: any) => p.error).map((p: any) => `${p.project}: ${p.error}`);
      setSyncMessage(
        `Synced ${data.projects.reduce((s: number, p: any) => s + p.videos, 0)} videos over ${compactThreshold(projects)}` +
          (failed.length ? ` · failed: ${failed.join(" · ")}` : "")
      );
    }
    else setSyncMessage(`Checked comments on ${data.videos.length} videos`);
    setSyncing(null);
    loadProjects();
  }

  const enabledProjects = projects.filter((p) => p.enabled);

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-blue-600" /> Comments
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            The bot replies to &ldquo;what&apos;s the app?&rdquo; comments and real questions on 10K+ Facebook and YouTube videos, as the creator&apos;s own Page or channel.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => runSync("videos")}
            disabled={!!syncing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {syncing === "videos" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync videos
          </button>
          <button
            onClick={() => runSync("comments")}
            disabled={!!syncing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing === "comments" ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            Check comments
          </button>
        </div>
      </div>
      {syncMessage && <div className="mb-4 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-2">{syncMessage}</div>}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200">
        {[
          { id: "autoreply" as Tab, label: "Auto-reply", icon: Bot, count: undefined },
          { id: "settings" as Tab, label: "Campaigns", icon: Settings2, count: enabledProjects.length },
        ].map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <Icon className="w-4 h-4" /> {label}
            {count !== undefined && (
              <span className={cn("text-xs px-1.5 py-0.5 rounded-full", tab === id ? "bg-blue-100" : "bg-slate-100")}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {tab !== "settings" && enabledProjects.length === 0 && projects.length > 0 && (
        <EmptyState
          title="No campaigns switched on yet"
          body="Turn on the campaigns you want to track in the Campaigns tab, then hit Sync videos."
          action={<button onClick={() => setTab("settings")} className="text-sm font-medium text-blue-600">Go to Campaigns →</button>}
        />
      )}

      {tab === "autoreply" && <AutoReplyPanel />}

      {/* Campaign settings */}
      {tab === "settings" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Switch on the campaigns to track. The brief is the angle replies should take, e.g. &ldquo;i&apos;ve been using ecosia for agesss and i stg i&apos;ve planted a forest already lol&rdquo;.
          </p>
          {projects.map((p) => (
            <ProjectRow key={p.id} project={p} onSaved={loadProjects} />
          ))}
        </div>
      )}
    </div>
  );
}

interface ConnectedAccount {
  id: string;
  platform: "facebook" | "youtube";
  name: string;
  handles: string[];
  autoReply: boolean;
  dryRun: boolean;
  maxPerVideoDay: number;
  maxPerDay: number;
  connectedBy: string | null;
  lastError: string | null;
}

interface BotLogItem {
  id: string;
  text: string;
  authorHandle: string | null;
  botReplyText: string;
  botRepliedAt: string | null;
  botReplyError: string | null;
  updatedAt: string;
  video: { platform: string; creatorHandle: string | null; url: string; project: { name: string } };
}

function AutoReplyPanel() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [log, setLog] = useState<BotLogItem[]>([]);
  const [postedToday, setPostedToday] = useState(0);
  const [configured, setConfigured] = useState({ facebook: false, youtube: false });
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("error")) return `Couldn't connect: ${sp.get("error")}`;
    if (sp.get("connected")) return `Connected ${sp.get("connected")} account(s). They start in draft-only mode.`;
    if (sp.get("error") === "access_denied") return null;
    return null;
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/comments/accounts");
    if (!res.ok) return;
    const data = await res.json();
    setAccounts(data.accounts);
    setLog(data.log);
    setPostedToday(data.postedToday);
    setConfigured(data.configured);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function update(id: string, patch: Partial<ConnectedAccount>) {
    setAccounts((as) => as.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    await fetch("/api/comments/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
  }

  async function disconnect(a: ConnectedAccount) {
    if (!confirm(`Disconnect ${a.name}? The bot will stop replying as this account.`)) return;
    await fetch(`/api/comments/accounts?id=${a.id}`, { method: "DELETE" });
    load();
  }

  async function runNow() {
    setRunning(true);
    const res = await fetch("/api/comments/cron?step=reply");
    const data = await res.json().catch(() => ({}));
    setNotice(
      res.ok
        ? `Bot run: ${data.accounts.reduce((s: number, a: any) => s + a.posted, 0)} posted, ${data.accounts.reduce((s: number, a: any) => s + a.drafted, 0)} drafted`
        : data.error ?? "Bot run failed"
    );
    setRunning(false);
    load();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        The bot replies as the creator&apos;s own Facebook Page or YouTube channel, only to people asking about the app or asking a real question,
        using the suggested reply. New accounts start in <b>draft only</b>: check the drafts below, then switch to <b>Live</b>.
      </p>
      {notice && <div className="text-sm text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-2">{notice}</div>}

      <div className="flex flex-wrap items-center gap-2">
        {([
          { platform: "facebook", label: "Connect Facebook Pages", icon: Facebook, color: "bg-[#1877F2] hover:bg-[#166fe0]" },
          { platform: "youtube", label: "Connect YouTube channel", icon: Youtube, color: "bg-[#FF0000] hover:bg-[#e00000]" },
        ] as const).map(({ platform, label, icon: Icon, color }) =>
          configured[platform] ? (
            <a key={platform} href={`/api/connect/${platform}`} className={cn("flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white", color)}>
              <Icon className="w-4 h-4" /> {label}
            </a>
          ) : (
            <span key={platform} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-400" title="App credentials not set up yet">
              <Icon className="w-4 h-4" /> {label} (not set up)
            </span>
          )
        )}
        {configured.youtube && (
          <a href="/api/connect/youtube?loop=1" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
            title="After each channel, Google's picker opens again. Click Cancel when you're done.">
            <Youtube className="w-4 h-4 text-[#FF0000]" /> Connect several channels
          </a>
        )}
        <button
          onClick={runNow}
          disabled={running || accounts.every((a) => !a.autoReply)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />} Run bot now
        </button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState title="No accounts connected" body="Connect the creators' Facebook Pages and YouTube channels you manage. The person connecting needs admin access to them." />
      ) : (
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className={cn("bg-white rounded-2xl border px-5 py-3.5", a.autoReply ? "border-blue-200" : "border-slate-200")}>
              <div className="flex items-center gap-3 flex-wrap">
                {a.platform === "facebook" ? <Facebook className="w-5 h-5 text-[#1877F2]" /> : <Youtube className="w-5 h-5 text-[#FF0000]" />}
                <div className="min-w-[200px] flex-1">
                  <div className="font-semibold text-slate-900 text-sm">{a.name}</div>
                  <div className="text-xs text-slate-500">
                    matches {a.handles.map((h) => `@${h}`).join(", ")}
                    {a.connectedBy && ` · connected by ${a.connectedBy}`}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <input type="checkbox" checked={a.autoReply} onChange={(e) => update(a.id, { autoReply: e.target.checked })} className="accent-blue-600" />
                  Auto-reply
                </label>
                <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
                  {[{ v: true, l: "Draft only" }, { v: false, l: "Live" }].map(({ v, l }) => (
                    <button
                      key={l}
                      onClick={() => update(a.id, { dryRun: v })}
                      className={cn("px-2.5 py-1 rounded-md", a.dryRun === v ? (v ? "bg-white text-slate-900 shadow-sm" : "bg-green-600 text-white") : "text-slate-500")}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <label className="text-xs text-slate-500 flex items-center gap-1">
                  max/video/day
                  <input type="number" min={0} value={a.maxPerVideoDay} onChange={(e) => update(a.id, { maxPerVideoDay: Number(e.target.value) })}
                    className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-slate-800" />
                </label>
                <label className="text-xs text-slate-500 flex items-center gap-1">
                  max/day
                  <input type="number" min={0} value={a.maxPerDay} onChange={(e) => update(a.id, { maxPerDay: Number(e.target.value) })}
                    className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-slate-800" />
                </label>
                <button onClick={() => disconnect(a)} className="text-slate-400 hover:text-red-600" title="Disconnect">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {a.lastError && <div className="mt-2 text-xs text-red-600">Last error: {a.lastError}</div>}
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Bot activity <span className="font-normal text-slate-500">· {postedToday} posted in the last 24h</span></h2>
        {log.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing yet.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {log.map((l) => (
              <div key={l.id} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <span className={cn("px-2 py-0.5 rounded-full font-medium",
                    l.botReplyError ? "bg-red-100 text-red-700" : l.botRepliedAt ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600")}>
                    {l.botReplyError ? "Failed" : l.botRepliedAt ? "Posted" : "Draft"}
                  </span>
                  <span>@{l.video.creatorHandle} · {PLATFORM_LABEL[l.video.platform]} · {l.video.project.name}</span>
                  <a href={l.video.url} target="_blank" rel="noreferrer" className="ml-auto text-blue-600 flex items-center gap-1">Video <ExternalLink className="w-3 h-3" /></a>
                </div>
                <div className="text-slate-600">@{l.authorHandle ?? "someone"}: {l.text}</div>
                <div className="text-slate-900 mt-0.5">↳ {l.botReplyText}</div>
                {l.botReplyError && <div className="text-xs text-red-600 mt-0.5">{l.botReplyError}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function compactThreshold(projects: Project[]) {
  const min = Math.min(...projects.filter((p) => p.enabled).map((p) => p.minViews));
  return Number.isFinite(min) ? `${compact(min)} views` : "the threshold";
}

function ProjectRow({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const [brief, setBrief] = useState(project.replyBrief ?? "");
  const [minViews, setMinViews] = useState(project.minViews);
  const [lookbackDays, setLookbackDays] = useState(project.lookbackDays);
  const [saving, setSaving] = useState(false);
  const dirty = brief !== (project.replyBrief ?? "") || minViews !== project.minViews || lookbackDays !== project.lookbackDays;

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    await fetch("/api/comments/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: project.id, ...patch }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className={cn("bg-white rounded-2xl border px-5 py-4", project.enabled ? "border-blue-200" : "border-slate-200")}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => save({ enabled: !project.enabled })}
          className={cn("relative w-10 h-6 rounded-full transition-colors flex-shrink-0", project.enabled ? "bg-blue-600" : "bg-slate-300")}
          aria-label={project.enabled ? "Turn off" : "Turn on"}
        >
          <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", project.enabled ? "left-5" : "left-1")} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900">{project.name}</div>
          <div className="text-xs text-slate-500">
            {project.source === "viralapp" ? "viral.app" : "ViralDeck"} · {project._count.videos} videos tracked
            {project.lastSyncedAt && ` · synced ${new Date(project.lastSyncedAt).toLocaleString()}`}
          </div>
        </div>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>
      {project.enabled && (
        <div className="mt-3 flex flex-wrap gap-3 items-end">
          <label className="text-xs font-medium text-slate-600 basis-full">
            Reply brief
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={2}
              placeholder="The angle replies should take and anything they must never claim"
              className="mt-1 w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Min views
            <input type="number" value={minViews} onChange={(e) => setMinViews(Number(e.target.value))}
              className="mt-1 w-28 text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Last N days
            <input type="number" value={lookbackDays} onChange={(e) => setLookbackDays(Number(e.target.value))}
              className="mt-1 w-24 text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <button
            onClick={() => save({ replyBrief: brief, minViews, lookbackDays })}
            disabled={!dirty || saving}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-14 px-6 text-center">
      <div className="font-semibold text-slate-900">{title}</div>
      <p className="text-sm text-slate-500 mt-1">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
