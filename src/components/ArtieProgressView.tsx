import type { CreatorProgress, ProgressBonusItem } from "@/lib/artie/views";
import ArtieAvatar from "./ArtieAvatar";

const PLATFORM: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook" };

const STATE: Record<ProgressBonusItem["state"], { label: string; cls: string }> = {
  under_review: { label: "Awaiting review", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-800" },
  adjusted: { label: "Adjusted after review", cls: "bg-blue-100 text-blue-800" },
  not_approved: { label: "Not approved after review", cls: "bg-slate-200 text-slate-600" },
};

export default function ArtieProgressView({ progress: p }: { progress: CreatorProgress }) {
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: p.currency, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const views = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));
  const first = p.name.split(" ")[0];
  const threshold = views(p.bonusThreshold);

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-5">
      <div className="max-w-xl mx-auto space-y-5">
        <header className="flex items-center gap-4">
          <ArtieAvatar name={p.name} url={p.avatarUrl} size={64} className="ring-2 ring-white shadow-sm" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Artie creator progress</p>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">Hi {first} 👋</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Current cycle: <strong className="text-slate-700">{p.cycle.startLabel} → {p.cycle.endLabel}</strong>
            </p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Unique videos</p>
            <p className="text-4xl font-black text-slate-900 mt-2">{p.countedVideos}</p>
            <p className="text-xs text-slate-400 mt-1">counted this cycle · a video on several platforms counts once</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{threshold}+ view bonuses</p>
            <p className="text-4xl font-black text-slate-900 mt-2">{p.bonusCount}</p>
            <p className="text-xs text-slate-400 mt-1">
              {p.bonusCount ? <>Indicative: <strong className="text-slate-600">{money(p.indicativeBonus)}</strong></> : "none yet"}
            </p>
          </div>
        </section>

        {p.pace.expected > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-900">Posting pace</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                p.pace.status === "behind" ? "bg-rose-100 text-rose-700" : p.pace.status === "on_track" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>
                {p.pace.status === "behind" ? `${Math.abs(p.pace.delta)} behind` : p.pace.status === "on_track" ? "On track" : p.pace.status === "ahead" ? "Ahead of pace" : "Just started"}
              </span>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full ${p.pace.status === "behind" ? "bg-rose-400" : p.pace.status === "on_track" ? "bg-sky-400" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, Math.round((p.pace.actual / Math.max(1, p.pace.expected)) * 100))}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              <strong className="text-slate-700">{p.pace.actual}</strong> of <strong className="text-slate-700">{p.pace.expected}</strong> videos expected so far at {p.pace.perDay} a day
              {p.pace.startedThisCycle && p.pace.startLabel && <> — counted from when you joined on {p.pace.startLabel}</>}.
            </p>
            <p className="text-sm text-slate-700 mt-2">
              {p.pace.status === "behind" ? `Posting ${p.pace.perDay} a day from here keeps you moving back towards the target.`
                : p.pace.status === "ahead" ? "You're ahead of the daily target — nice work! 🎉"
                : p.pace.status === "on_track" ? "You're right on track — keep it up!" : "Welcome aboard! Your target starts from your first day."}
            </p>
          </section>
        )}

        {p.potential && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Potential earnings this cycle</p>
            <p className="text-4xl font-black text-slate-900 mt-2">{money(p.potential.total)}</p>
            <p className="text-xs text-slate-500 mt-2">
              {p.potential.videos} unique video{p.potential.videos === 1 ? "" : "s"} × {money(p.potential.rate)} = {money(p.potential.base)}
              {p.potential.bonus > 0 && <> + {money(p.potential.bonus)} in bonuses</>}
            </p>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900">Videos that reached {threshold} views</h2>
          {p.bonusItems.length === 0 ? (
            <p className="text-sm text-slate-400 mt-3">No videos have reached {threshold} views in this cycle yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {p.bonusItems.map((b) => (
                <li key={b.url} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-600 hover:underline">
                      {PLATFORM[b.platform] ?? b.platform} video · {views(b.views)} views
                    </a>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Posted {new Date(b.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATE[b.state].cls}`}>{STATE[b.state].label}</span>
                    <p className="text-sm font-bold text-slate-800 mt-1">
                      {b.state === "not_approved" ? "—" : money(b.amount)}
                    </p>
                    {b.previouslyShown != null && (
                      <p className="text-[11px] text-slate-400">previously shown {money(b.previouslyShown)}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs leading-relaxed text-amber-900 space-y-2">
          <p><strong>These figures are indicative, not a payment promise.</strong> They show what you could earn this cycle so far from your videos and your per-video rate. Final numbers are checked and approved by the team at the end of the cycle.</p>
          <p>Bonuses apply to eligible <strong>unique</strong> videos. If the same video is posted on both Instagram and Facebook, the views can overlap, so the final total may change after review.</p>
        </section>

        {p.previousCycles.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900">Previous cycles</h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {p.previousCycles.map((c) => (
                <li key={c.key} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-slate-700">{c.startLabel} → {c.endLabel}</p>
                    <p className="text-xs text-slate-400">{c.countedVideos} videos counted</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-700">{c.bonusCount} bonus{c.bonusCount === 1 ? "" : "es"} · {money(c.bonusAmount)}</p>
                    {c.awaitingReview > 0 && <p className="text-xs text-amber-600">{c.awaitingReview} still awaiting review</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-center text-[11px] text-slate-400 pt-2">This is your private link — please don&apos;t share it.</p>
      </div>
    </main>
  );
}
