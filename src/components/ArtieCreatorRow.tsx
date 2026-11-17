"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Link2, ExternalLink, Check, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLATFORM_LABEL, type ArtieRow, type ArtieDetail } from "./artieTypes";
import ArtieAvatar from "./ArtieAvatar";

const PLATFORM_BAR: Record<string, string> = { instagram: "bg-fuchsia-500", tiktok: "bg-slate-800", facebook: "bg-blue-500" };
const PLATFORM_SHORT: Record<string, string> = { instagram: "IG", tiktok: "TT", facebook: "FB" };
const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-800",
  corrected: "bg-blue-100 text-blue-800", rejected: "bg-slate-200 text-slate-600",
};
const FLAG_SHORT: Record<string, string> = {
  possible_fb_ig_overlap: "IG + FB overlap", ig_views_may_include_fb: "IG may include FB views", fb_linkage_unknown: "FB link unknown",
  tiktok_only: "TikTok only", facebook_only: "Facebook only", no_ig_counterpart: "no IG match",
};
const fmtViews = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : String(n));

interface Props {
  row: ArtieRow;
  cycleKey: string;
  currency: string;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void; // refresh the list's totals after an action
  notify: (msg: string, ok?: boolean) => void;
  copyLink: (row: ArtieRow) => void;
}

export default function ArtieCreatorRow({ row, cycleKey, currency, expanded, onToggle, onChanged, notify, copyLink }: Props) {
  const [detail, setDetail] = useState<ArtieDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // The parent re-creates `notify` every render; keep the latest in a ref so loading
  // doesn't re-fire (and loop on an error toast) every time the parent re-renders.
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  const maxCount = Math.max(1, ...["instagram", "tiktok", "facebook"].map((p) => row.perPlatform[p] ?? 0));
  const attention = (row.discrepancy ? 1 : 0) + (row.trackingGaps.length > 0 ? 1 : 0);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/artie/creators/${row.id}?cycle=${cycleKey}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok) setDetail(json); else notifyRef.current(json?.error ?? "Couldn't load details", false);
  }, [row.id, cycleKey]);

  // Fetch when opened; refetch if the cycle changes while open.
  useEffect(() => { if (expanded) loadDetail(); else setDetail(null); }, [expanded, loadDetail]);

  async function act(key: string, url: string, method: string, body: unknown, okMsg: string) {
    setBusy(key);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) return notify(json?.error ?? `Failed (HTTP ${res.status})`, false);
    notify(okMsg);
    await Promise.all([loadDetail(), Promise.resolve(onChanged())]);
  }

  const topPosts = detail ? [...detail.posts].sort((a, b) => b.views - a.views).slice(0, 6) : [];

  return (
    <div className={cn("bg-white rounded-2xl border transition-all", expanded ? "border-blue-200 shadow-md" : "border-slate-200 hover:border-slate-300 hover:shadow-sm")}>
      {/* Summary row — click anywhere to expand */}
      <div role="button" tabIndex={0} aria-expanded={expanded} onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none">
        <ArtieAvatar name={row.name} url={row.avatarUrl} size={44} />

        <div className="min-w-0 w-56">
          <p className="font-semibold text-slate-900 truncate">{row.name}</p>
          <p className="text-xs text-slate-400 truncate">
            {[row.handles.instagram && `@${row.handles.instagram}`, row.handles.tiktok && `tt/${row.handles.tiktok}`].filter(Boolean).join(" · ") || "no handles"}
          </p>
        </div>

        <div className="text-center w-16 flex-shrink-0">
          <p className="text-2xl font-black text-slate-900 leading-none">{row.counted}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-1" title="Unique videos: a video posted to several platforms counts once">unique</p>
        </div>

        {/* Mini per-platform bars */}
        <div className="hidden md:block w-40 flex-shrink-0 space-y-1">
          {(["instagram", "tiktok", "facebook"] as const).map((p) => (
            <div key={p} className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-slate-400 w-5">{PLATFORM_SHORT[p]}</span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={cn("h-full rounded-full", PLATFORM_BAR[p])} style={{ width: `${((row.perPlatform[p] ?? 0) / maxCount) * 100}%` }} /></div>
              <span className="text-[10px] tabular-nums text-slate-500 w-6 text-right">{row.perPlatform[p] ?? 0}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
          {row.discrepancy && <span className="badge bg-amber-100 text-amber-800">counts differ</span>}
          {row.trackingGaps.length > 0 && <span className="badge bg-slate-200 text-slate-600" title="A handle on the sheet has no videos in ViralDeck">not tracked: {row.trackingGaps.map((g) => PLATFORM_SHORT[g] ?? g).join(", ")}</span>}
          {attention === 0 && <span className="badge bg-emerald-50 text-emerald-700"><Check className="inline w-3 h-3 mr-0.5" />all good</span>}
        </div>

        <div className="text-right w-32 flex-shrink-0">
          {row.bonus.pending + row.bonus.approved + row.bonus.rejected === 0 ? <span className="text-slate-300 text-sm">no bonuses</span> : (
            <>
              <p className="font-bold text-slate-900 text-sm">{money(row.bonus.indicativeAmount)}</p>
              <p className="text-[11px] text-slate-400">
                {row.bonus.pending > 0 && <span className="text-amber-600 font-semibold">{row.bonus.pending} pending </span>}
                {row.bonus.approved > 0 && <span className="text-emerald-600 font-semibold">{row.bonus.approved} approved</span>}
              </p>
            </>
          )}
        </div>

        <button onClick={(e) => { e.stopPropagation(); copyLink(row); }} title={`Copy ${row.name}'s private link`}
          className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex-shrink-0"><Link2 className="w-4 h-4" /></button>
        <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform flex-shrink-0", expanded && "rotate-180 text-blue-500")} />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/60 rounded-b-2xl">
          {loading && !detail && <div className="flex items-center gap-2 text-sm text-slate-400 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading {row.name}…</div>}
          {detail && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Bonuses */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Bonus candidates</h3>
                {detail.candidates.length === 0 ? <p className="text-sm text-slate-400">Nothing has reached the threshold this cycle.</p> : (
                  <ul className="space-y-2">
                    {detail.candidates.map((c) => (
                      <li key={c.id} className="bg-white rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-2 flex-wrap">
                            <span className={cn("badge", STATUS_CLS[c.status])}>{c.status}</span>
                            {c.primary && <a href={c.primary.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-sm font-semibold text-blue-600 hover:underline inline-flex items-center gap-1">{PLATFORM_LABEL[c.primary.platform] ?? c.primary.platform} · {fmtViews(c.maxViews)} <ExternalLink className="w-3 h-3" /></a>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-sm font-bold">{money(c.status === "pending" ? c.initialAmount : c.approvedAmount ?? c.initialAmount)}</span>
                            {c.status === "pending" && (
                              <button disabled={busy === c.id} onClick={() => act(c.id, `/api/artie/candidates/${c.id}`, "POST", { action: "approve" }, "Bonus approved")}
                                className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1 disabled:opacity-50">{busy === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve</button>
                            )}
                          </div>
                        </div>
                        {c.flags.length > 0 && <p className="text-[11px] text-amber-700 mt-1.5 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />{c.flags.map((f) => FLAG_SHORT[f] ?? f).join(" · ")}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Needs review + recent posts */}
              <section className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Top posts this cycle</h3>
                  {topPosts.length === 0 ? <p className="text-sm text-slate-400">No posts found in this cycle.</p> : (
                    <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                      {topPosts.map((p) => (
                        <li key={p.id} className="px-3 py-2 flex items-center justify-between gap-2 text-sm">
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1.5">
                            <span className={cn("w-1.5 h-1.5 rounded-full", PLATFORM_BAR[p.platform] ?? "bg-slate-300")} />{PLATFORM_LABEL[p.platform] ?? p.platform}
                            {p.igMatchId && <span className="text-[10px] text-slate-400">cross-post</span>}
                          </a>
                          <span className="text-xs text-slate-400">{new Date(p.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                          <span className="text-xs font-semibold tabular-nums text-slate-700 w-14 text-right">{fmtViews(p.views)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <div className="lg:col-span-2 flex items-center justify-between pt-1 border-t border-slate-200/70">
                <p className="text-xs text-slate-400">
                  {row.ratePerVideo != null && <>Rate {money(row.ratePerVideo)}/video · </>}
                  {row.handles.facebook && <>FB {row.handles.facebook} · </>}Reject or correct a bonus on the full page.
                </p>
                <Link href={`/artie/${row.id}?cycle=${cycleKey}`} className="text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">Open full review <ArrowRight className="w-4 h-4" /></Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
