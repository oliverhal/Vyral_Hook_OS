"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Link2, ExternalLink, Check, AlertTriangle, Loader2, ArrowRight, Megaphone } from "lucide-react";
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
  copyNudge: (row: ArtieRow) => void;
  programme?: "artie" | "ecosia";
  bonusEnabled?: boolean; // false: this programme pays no bonuses — hide every bonus element
}

export default function ArtieCreatorRow({ row, cycleKey, currency, expanded, onToggle, onChanged, notify, copyLink, copyNudge, programme = "artie", bonusEnabled = true }: Props) {
  const [detail, setDetail] = useState<ArtieDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);
  // The parent re-creates `notify` every render; keep the latest in a ref so loading
  // doesn't re-fire (and loop on an error toast) every time the parent re-renders.
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  const maxCount = Math.max(1, ...["instagram", "tiktok", "facebook"].map((p) => row.perPlatform[p] ?? 0));
  const attention = (row.discrepancy ? 1 : 0) + (row.trackingGaps.length > 0 ? 1 : 0);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/${programme}/creators/${row.id}?cycle=${cycleKey}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok) setDetail(json); else notifyRef.current(json?.error ?? "Couldn't load details", false);
  }, [row.id, cycleKey, programme]);

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
          {row.pace.expected > 0 && <p className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap" title={`Expected so far at the daily target${row.pace.startedThisCycle ? ", counted from their first post" : ""}`}>of {row.pace.expected}</p>}
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
          {row.pace.status === "behind" && <span className="badge bg-rose-100 text-rose-700" title={`${row.counted} unique videos vs ${row.pace.expected} expected so far`}>{Math.abs(row.pace.delta)} behind pace</span>}
          {row.pace.status === "on_track" && <span className="badge bg-sky-50 text-sky-700" title={`${row.counted} vs ${row.pace.expected} expected — within 10%`}>on track</span>}
          {row.pace.status === "ahead" && row.pace.delta > 0 && <span className="badge bg-emerald-100 text-emerald-700" title={`${row.counted} vs ${row.pace.expected} expected so far`}>{row.pace.delta} ahead</span>}
          {row.pace.startedThisCycle && <span className="badge bg-violet-50 text-violet-700" title="Posted for the first time partway through this cycle — the expected count starts from that first post">first post · {row.startDate && new Date(row.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}</span>}
          {row.leavingAfter && <span className="badge bg-amber-50 text-amber-700" title="Removed from the payroll sheet — kept until the pay cycle closes + 2 days so it can still be reviewed and paid">leaving {new Date(row.leavingAfter).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
          {bonusEnabled && row.bonus.pendingChecks > 0 && <span className="badge bg-amber-100 text-amber-800" title="The same video is on Instagram and Facebook — the accounts may be linked">IG+FB check</span>}
          {row.trackingGaps.length > 0 && <span className="badge bg-slate-200 text-slate-600" title="A handle on the sheet has no videos in ViralDeck">not tracked: {row.trackingGaps.map((g) => PLATFORM_SHORT[g] ?? g).join(", ")}</span>}
          {attention === 0 && row.pace.status !== "behind" && <span className="badge bg-emerald-50 text-emerald-700"><Check className="inline w-3 h-3 mr-0.5" />all good</span>}
        </div>

        <div className="text-right w-44 flex-shrink-0">
          {row.estBase != null ? (
            <>
              <p className="font-bold text-slate-900 text-sm" title={`${row.counted} unique videos × ${money(row.ratePerVideo as number)}`}>{money(row.estBase)}</p>
              <p className="text-[11px] text-slate-400">{row.counted} × {money(row.ratePerVideo as number)}{bonusEnabled && row.bonus.approved + row.bonus.pending > 0 && <> · + {money(row.bonus.indicativeAmount)} bonus</>}</p>
            </>
          ) : <p className="text-[11px] text-slate-300">no rate on the sheet</p>}
          {bonusEnabled && row.bonus.pending > 0 && <p className="text-[11px] font-semibold text-amber-600">{row.bonus.pending} bonus{row.bonus.pending === 1 ? "" : "es"} to review</p>}
        </div>

        {row.pace.status === "behind" && (
          <button onClick={(e) => { e.stopPropagation(); copyNudge(row); }} title={`Copy a nudge message for ${row.name} — their numbers and what they're missing, with their link`}
            className="p-2 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 flex-shrink-0"><Megaphone className="w-4 h-4" /></button>
        )}
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
              {bonusEnabled && <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Bonus candidates</h3>
                {detail.candidates.length === 0 ? <p className="text-sm text-slate-400">Nothing has reached the threshold this cycle.</p> : (
                  <ul className="space-y-2">
                    {detail.candidates.map((c) => {
                      const similar = c.flags.includes("similar_views_ig_fb");
                      const overlap = c.flags.includes("possible_fb_ig_overlap");
                      const check = similar || overlap;
                      const separate = c.flags.includes("also_on_other_platform");
                      const members = [c.primary, ...c.related].filter(Boolean) as { url: string; platform: string; views: number }[];
                      const igV = members.find((m) => m.platform === "instagram")?.views, fbV = members.find((m) => m.platform === "facebook")?.views;
                      const isRejecting = rejecting?.id === c.id;
                      return (
                        <li key={c.id} className={cn("rounded-xl border p-3", check && c.status === "pending" ? "bg-amber-50/60 border-amber-300" : "bg-white border-slate-200")}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex items-center gap-2 flex-wrap">
                              <span className={cn("badge", STATUS_CLS[c.status])}>{c.status}</span>
                              <span className="text-sm font-bold">{money(c.status === "pending" ? c.initialAmount : c.approvedAmount ?? c.initialAmount)}</span>
                            </div>
                            {c.status === "pending" && !isRejecting && (
                              <div className="flex gap-1.5">
                                <button disabled={busy === c.id} onClick={() => setRejecting({ id: c.id, reason: "" })} className="btn-secondary text-xs py-1 px-2.5">Reject</button>
                                <button disabled={busy === c.id} onClick={() => act(c.id, `/api/artie/candidates/${c.id}`, "POST", { action: "approve" }, "Bonus approved")}
                                  className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1 disabled:opacity-50">{busy === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve</button>
                              </div>
                            )}
                          </div>
                          {similar ? (
                            <div className="mt-2 text-xs text-amber-900">
                              <p className="font-semibold flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> Investigate: Instagram {igV != null && fmtViews(igV)} vs Facebook {fbV != null && fmtViews(fbV)} — nearly identical views.</p>
                              <p className="mt-1">When the accounts are linked, Facebook shows its views on Instagram too, so this is probably <strong>one</strong> set of views counted twice. Check both, then approve — or reject it if they’re the same views.</p>
                            </div>
                          ) : overlap ? (
                            <div className="mt-2 text-xs text-amber-900">
                              <p className="font-semibold flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> The same video is on Instagram and Facebook{igV != null && fbV != null && <> (IG {fmtViews(igV)} · FB {fmtViews(fbV)})</>}.</p>
                              <p className="mt-1">If the accounts are linked, the bigger number may already include the Facebook views. Check before approving.</p>
                            </div>
                          ) : (
                            <p className="mt-1.5 text-sm text-slate-600">
                              Hit <strong>{fmtViews(c.maxViews)}</strong> views{c.primary && <> on <a href={c.primary.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline inline-flex items-center gap-1">{PLATFORM_LABEL[c.primary.platform] ?? c.primary.platform} <ExternalLink className="w-3 h-3" /></a></>} — qualifies for a bonus.
                              {separate && <span className="block text-xs text-slate-400 mt-0.5">Also viral on the other platform with different views, so that one is awarded as its own bonus.</span>}
                            </p>
                          )}
                          {check && <p className="mt-1 text-xs">{members.map((m, i) => <span key={m.url}>{i > 0 && " · "}<a href={m.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-700 hover:underline font-semibold">{PLATFORM_LABEL[m.platform] ?? m.platform} {fmtViews(m.views)}</a></span>)}</p>}
                          {isRejecting && (
                            <div className="mt-3 space-y-2 border-t border-slate-200 pt-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-wrap gap-1.5">
                                {["Same views as Instagram (linked accounts)", "Duplicate of another bonus", "Not eligible"].map((r) => (
                                  <button key={r} onClick={() => setRejecting({ id: c.id, reason: r })} className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold border", rejecting?.reason === r ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400")}>{r}</button>
                                ))}
                              </div>
                              <input className="input text-sm" placeholder="Reason (required)" value={rejecting?.reason ?? ""} onChange={(e) => setRejecting({ id: c.id, reason: e.target.value })} />
                              <div className="flex gap-2">
                                <button disabled={busy === c.id || !(rejecting?.reason ?? "").trim()} className="btn-primary text-xs py-1 px-3 disabled:opacity-50"
                                  onClick={async () => { await act(c.id, `/api/artie/candidates/${c.id}`, "POST", { action: "reject", reason: rejecting?.reason }, "Bonus rejected"); setRejecting(null); }}>Confirm reject</button>
                                <button className="btn-secondary text-xs py-1 px-3" onClick={() => setRejecting(null)}>Cancel</button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>}

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
                  {row.ratePerVideo != null && <>Rate {money(row.ratePerVideo)}/video{row.rateSource === "derived" ? " (monthly ÷ expected videos)" : ""} · </>}
                  {row.handles.facebook && <>FB {row.handles.facebook} · </>}{bonusEnabled && <>Correct an amount on the full page.</>}
                </p>
                <Link href={`/${programme}/${row.id}?cycle=${cycleKey}`} className="text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">Open full review <ArrowRight className="w-4 h-4" /></Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
