"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, ExternalLink, RotateCcw, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PostRow {
  id: string; platform: string; url: string; username: string | null; caption: string | null; publishedAt: string; views: number;
  igMatchId: string | null; matchSource: string | null; matchedToUrl: string | null;
  countDecision: string | null; decisionReason: string | null; decidedBy: string | null; needsReview: boolean;
}
interface Ev { id: string; action: string; actor: string; createdAt: string; before: { status?: string; approvedAmount?: number | null; reason?: string | null } | null; after: { status?: string; approvedAmount?: number | null; reason?: string | null } | null }
interface Cand {
  id: string; status: string; maxViews: number; initialAmount: number; approvedAmount: number | null; reason: string | null;
  reviewedBy: string | null; reviewedAt: string | null; flags: string[]; qualifiesOn: string[];
  primary: { id: string; url: string; platform: string; views: number } | null;
  related: { id: string; url: string; platform: string; views: number }[]; events: Ev[];
}
interface Detail {
  creator: { id: string; name: string; ratePerVideo: number | null; instagram: string | null; tiktok: string | null; facebook: string | null; facebookLinked: boolean | null; accessToken: string };
  cycle: { key: string; startLabel: string; endLabel: string; prevKey: string; nextKey: string; isCurrent: boolean };
  counts: { counted: number; perPlatform: Record<string, number>; discrepancy: boolean };
  currency: string; posts: PostRow[]; candidates: Cand[];
}

const PL: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook" };
const FLAG: Record<string, string> = {
  possible_fb_ig_overlap: "Instagram and Facebook versions of this video both exist — IG's view count may already include the Facebook views.",
  ig_views_may_include_fb: "This creator has a Facebook account; their Instagram views may include linked Facebook views.",
  fb_linkage_unknown: "We don't know whether this creator's Facebook and Instagram are linked (set it below).",
  tiktok_only: "Only found on TikTok.", facebook_only: "Only found on Facebook.",
  no_ig_counterpart: "No matching Instagram post found — check it isn't a missed cross-post before paying.",
};
const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-800",
  corrected: "bg-blue-100 text-blue-800", rejected: "bg-slate-200 text-slate-600",
};
const fmtViews = (n: number) => n.toLocaleString("en-US");

export default function ArtieCreatorDetail({ id, initialCycle }: { id: string; initialCycle: string }) {
  const [cycleKey, setCycleKey] = useState(initialCycle);
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, { mode: "reject" | "correct" | null; reason: string; amount: string }>>({});
  const [postReason, setPostReason] = useState<Record<string, string>>({});

  const notify = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    const res = await fetch(`/api/artie/creators/${id}${cycleKey ? `?cycle=${cycleKey}` : ""}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) { setError(json?.error ?? `Failed to load (HTTP ${res.status})`); return; }
    setError(""); setD(json);
  }, [id, cycleKey]);
  useEffect(() => { load(); }, [load]);

  async function call(url: string, method: string, body: unknown, key: string, okMsg: string) {
    setBusy(key);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) { notify(json?.error ?? `Failed (HTTP ${res.status})`, false); return false; }
    notify(okMsg); await load(); return true;
  }

  const decide = async (c: Cand, action: string, extra: Record<string, unknown> = {}) => {
    const ok = await call(`/api/artie/candidates/${c.id}`, "POST", { action, ...extra }, c.id, `Bonus ${action === "reopen" ? "reopened" : action + (action.endsWith("e") ? "d" : "ed")}`);
    if (ok) setForm((f) => ({ ...f, [c.id]: { mode: null, reason: "", amount: "" } }));
  };

  if (error) return <div className="p-8"><div className="card p-6 text-sm text-red-600">{error}</div></div>;
  if (!d) return <div className="p-8 animate-pulse"><div className="h-40 bg-slate-200 rounded-2xl" /></div>;

  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: d.currency }).format(n);
  const link = typeof window !== "undefined" ? `${window.location.origin}/progress/${d.creator.accessToken}` : "";
  const igPosts = d.posts.filter((p) => p.platform === "instagram");
  const needsReview = d.posts.filter((p) => p.needsReview);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {toast && <div className={cn("fixed top-5 right-5 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white", toast.ok ? "bg-emerald-600" : "bg-red-600")}>{toast.msg}</div>}

      <div>
        <Link href={`/artie?cycle=${d.cycle.key}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3"><ArrowLeft className="w-4 h-4" /> All creators</Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{d.creator.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {[d.creator.instagram && `IG @${d.creator.instagram}`, d.creator.tiktok && `TikTok @${d.creator.tiktok}`, d.creator.facebook && `FB ${d.creator.facebook}`].filter(Boolean).join(" · ")}
              {d.creator.ratePerVideo != null && <> · rate {money(d.creator.ratePerVideo)}/video</>}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => setCycleKey(d.cycle.prevKey)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft className="w-4 h-4" /></button>
            <strong>{d.cycle.startLabel} → {d.cycle.endLabel}</strong>
            <button onClick={() => setCycleKey(d.cycle.nextKey)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5"><p className="label">Counted videos</p><p className="text-3xl font-black mt-1">{d.counts.counted}</p></div>
        <div className="card p-5 col-span-2">
          <p className="label">Posts found in this cycle</p>
          <p className="text-sm mt-2 text-slate-700">Instagram <strong>{d.counts.perPlatform.instagram ?? 0}</strong> · TikTok <strong>{d.counts.perPlatform.tiktok ?? 0}</strong> · Facebook <strong>{d.counts.perPlatform.facebook ?? 0}</strong></p>
          {d.counts.discrepancy && <p className="text-xs text-amber-700 mt-2">The counts differ — could be a missed cross-post or a platform-specific post. Check below before approving.</p>}
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <p className="label">Creator’s private link</p>
        <div className="flex gap-2">
          <input readOnly className="input text-xs font-mono" value={link} onFocus={(e) => e.currentTarget.select()} />
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => { navigator.clipboard.writeText(link); notify("Link copied"); }}><Copy className="w-4 h-4" /> Copy</button>
          <button className="btn-secondary flex items-center gap-1.5" disabled={busy === "regen"}
            onClick={() => { if (confirm("This permanently disables the current link. The creator will need the new one. Continue?")) call(`/api/artie/creators/${d.creator.id}`, "PATCH", { regenerateToken: true }, "regen", "New link created — old one no longer works"); }}>
            <RotateCcw className="w-4 h-4" /> Regenerate
          </button>
        </div>
        {d.creator.facebook && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">Facebook linked to Instagram?</span>
            <select className="input w-auto py-1" value={d.creator.facebookLinked === null ? "" : String(d.creator.facebookLinked)}
              onChange={(e) => call(`/api/artie/creators/${d.creator.id}`, "PATCH", { facebookLinked: e.target.value === "" ? null : e.target.value === "true" }, "fb", "Saved")}>
              <option value="">Don’t know</option><option value="true">Yes, linked</option><option value="false">No, separate</option>
            </select>
            <span className="text-xs text-slate-400">Takes effect on the next sync.</span>
          </div>
        )}
      </div>

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Bonus candidates</h2>
        <p className="text-xs text-slate-500 mb-3">Detected automatically. Nothing is paid until you approve it; the creator sees the amount as indicative.</p>
        {d.candidates.length === 0 && <div className="card p-5 text-sm text-slate-400">No video has reached the threshold in this cycle.</div>}
        <div className="space-y-3">
          {d.candidates.map((c) => {
            const f = form[c.id] ?? { mode: null, reason: "", amount: "" };
            const set = (patch: Partial<typeof f>) => setForm((s) => ({ ...s, [c.id]: { ...f, ...patch } }));
            return (
              <div key={c.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("badge", STATUS_CLS[c.status])}>{c.status}</span>
                      {c.primary && <a href={c.primary.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline inline-flex items-center gap-1">{PL[c.primary.platform] ?? c.primary.platform} · {fmtViews(c.primary.views)} views <ExternalLink className="w-3 h-3" /></a>}
                      <span className="text-xs text-slate-400">qualifies on {c.qualifiesOn.map((p) => PL[p] ?? p).join(" + ")}</span>
                    </div>
                    {c.related.length > 0 && (
                      <p className="text-xs text-slate-500 mt-1">Also posted as: {c.related.map((r, i) => <span key={r.id}>{i > 0 && ", "}<a className="text-blue-600 hover:underline" href={r.url} target="_blank" rel="noopener noreferrer">{PL[r.platform] ?? r.platform} ({fmtViews(r.views)})</a></span>)}</p>
                    )}
                    {c.flags.length > 0 && <ul className="mt-2 space-y-0.5">{c.flags.map((fl) => <li key={fl} className="text-xs text-amber-700">⚠ {FLAG[fl] ?? fl}</li>)}</ul>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold">{money(c.status === "pending" ? c.initialAmount : c.approvedAmount ?? c.initialAmount)}</p>
                    {c.status !== "pending" && c.approvedAmount !== c.initialAmount && <p className="text-xs text-slate-400">creator first saw {money(c.initialAmount)}</p>}
                    {c.reviewedBy && <p className="text-xs text-slate-400">by {c.reviewedBy}</p>}
                  </div>
                </div>
                {c.reason && <p className="text-xs text-slate-600 mt-2 bg-slate-50 rounded-lg px-3 py-2">Reason: {c.reason}</p>}

                {f.mode ? (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    {f.mode === "correct" && <input className="input" placeholder={`Corrected amount (${d.currency})`} value={f.amount} onChange={(e) => set({ amount: e.target.value })} />}
                    <input className="input" placeholder="Reason (required)" value={f.reason} onChange={(e) => set({ reason: e.target.value })} />
                    <div className="flex gap-2">
                      <button className="btn-primary" disabled={busy === c.id} onClick={() => decide(c, f.mode!, { reason: f.reason, amount: f.amount })}>Confirm {f.mode}</button>
                      <button className="btn-secondary" onClick={() => set({ mode: null })}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {c.status !== "approved" && <button className="btn-primary flex items-center gap-1.5" disabled={busy === c.id} onClick={() => decide(c, "approve")}><Check className="w-4 h-4" /> Approve</button>}
                    {c.status !== "rejected" && <button className="btn-secondary" onClick={() => set({ mode: "reject" })}>Reject</button>}
                    <button className="btn-secondary" onClick={() => set({ mode: "correct", amount: String(c.approvedAmount ?? c.initialAmount) })}>Correct amount</button>
                    {c.status !== "pending" && <button className="btn-secondary" disabled={busy === c.id} onClick={() => decide(c, "reopen")}>Reopen</button>}
                  </div>
                )}

                {c.events.length > 0 && (
                  <details className="mt-3 text-xs text-slate-500">
                    <summary className="cursor-pointer">History ({c.events.length})</summary>
                    <ul className="mt-2 space-y-1">
                      {c.events.map((e) => (
                        <li key={e.id}>{new Date(e.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} — <strong>{e.action}</strong> by {e.actor}
                          {e.after?.status && <> → {e.after.status}{e.after.approvedAmount != null && ` (${money(e.after.approvedAmount)})`}</>}{e.after?.reason && <> — “{e.after.reason}”</>}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {needsReview.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Posts to review ({needsReview.length})</h2>
          <p className="text-xs text-slate-500 mb-3">On TikTok/Facebook but no matching Instagram post. Not counted until you decide — it might be a missed cross-post, or a genuine platform-specific video.</p>
          <div className="card divide-y divide-slate-100">
            {needsReview.map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 text-sm">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline">{PL[p.platform] ?? p.platform} · {fmtViews(p.views)} views</a>
                  <span className="text-xs text-slate-400 ml-2">{new Date(p.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  {p.caption && <p className="text-xs text-slate-500 truncate max-w-md">{p.caption}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <input className="input py-1 w-44 text-xs" placeholder="Reason (optional)" value={postReason[p.id] ?? ""} onChange={(e) => setPostReason((s) => ({ ...s, [p.id]: e.target.value }))} />
                  <button className="btn-primary text-xs" disabled={busy === p.id} onClick={() => call(`/api/artie/posts/${p.id}`, "PATCH", { countDecision: "count", reason: postReason[p.id] }, p.id, "Counted")}>Count it</button>
                  <button className="btn-secondary text-xs" disabled={busy === p.id} onClick={() => call(`/api/artie/posts/${p.id}`, "PATCH", { countDecision: "ignore", reason: postReason[p.id] }, p.id, "Ignored")}>Don’t count</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">All posts this cycle ({d.posts.length})</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
              <th className="text-left px-4 py-2.5">Platform</th><th className="text-left px-4 py-2.5">Posted</th><th className="text-right px-4 py-2.5">Views</th><th className="text-left px-4 py-2.5">Cross-post of</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {d.posts.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5"><a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{PL[p.platform] ?? p.platform}</a>
                    {p.countDecision && <span className="badge bg-slate-100 text-slate-600 ml-2">{p.countDecision === "count" ? "counted by " : "ignored by "}{p.decidedBy}</span>}</td>
                  <td className="px-4 py-2.5 text-slate-500">{new Date(p.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtViews(p.views)}</td>
                  <td className="px-4 py-2.5">
                    {p.platform === "instagram" ? <span className="text-slate-300">—</span> : (
                      <select className="input py-1 text-xs" value={p.igMatchId ?? ""} disabled={busy === p.id}
                        onChange={(e) => call(`/api/artie/posts/${p.id}`, "PATCH", { igMatchId: e.target.value || null }, p.id, "Match updated")}>
                        <option value="">Not a cross-post{p.matchSource === "manual" && !p.igMatchId ? " (set by you)" : ""}</option>
                        {igPosts.map((ig) => <option key={ig.id} value={ig.id}>IG · {new Date(ig.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {fmtViews(ig.views)} views</option>)}
                      </select>
                    )}
                    {p.igMatchId && p.matchSource === "auto" && <span className="text-[10px] text-slate-400 ml-1">auto-matched</span>}
                  </td>
                </tr>
              ))}
              {d.posts.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No posts found in this cycle. If this creator has posted, their accounts may not be tracked in viral.app yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
